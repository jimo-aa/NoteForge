import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../stores/context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/stores/authStore';
import { SearchBox } from '@/components/Sidebar/SearchBox';
import { LanguageSwitcher } from '@/components/Common/LanguageSwitcher';
import { Icon } from '@/components/Common/Icon';
import { SyncIndicator } from '@/components/Common/SyncIndicator';
import { AuthModal } from '@/components/Modals/AuthModal';
import { formatTime } from '@/utils/markdown';
import { SYNTAX_DEMO_ID } from '@/stores/useNoteStore';
import { tauriInvoke } from '@/utils/invoke';
import { ScannedTree } from '@/components/Sidebar/ScannedTree';
import type { Note } from '@/types';

interface SidebarProps {
  onNewNote?: () => void;
  onNewNotebook?: () => void;
  onManage?: () => void;
  onDraftRecovery?: () => void;
  onAbout?: () => void;
}

interface TreeNotebookNode {
  id: string;
  name: string;
  icon: string;
  color: string;
  notes: Note[];
  expanded: boolean;
}

interface TreeRootNode {
  path: string;
  name: string;
  notebooks: TreeNotebookNode[];
  expanded: boolean;
}

type CollapsibleSection = 'notebooks' | 'filters' | 'tags';

/** Render a colored dot or notebook SVG for notebook display */
function NotebookDisplayIcon({ icon, color, size = 16 }: { icon: string; color: string; size?: number }) {
  if (icon.length <= 2 && /[\u{1F000}-\u{1FFFF}]/u.test(icon)) {
    return (
      <span
        className="notebook-color-dot"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color || 'var(--accent)',
          flexShrink: 0,
        }}
      />
    );
  }
  return <Icon type="notebook" size={size} className="notebook-svg-icon" />;
}

export function Sidebar({ onNewNote, onNewNotebook, onManage, onDraftRecovery, onAbout }: SidebarProps) {
  const { t } = useTranslation();
  const { currentFilter, setCurrentFilter, activeNotebook, setActiveNotebook, notebooks, tags, totalCount, searchResultCount, setIsGraphOpen, selectNote, currentNoteId, activeTags, setActiveTags, filteredNotes, setContextMenu } = useStore();
  const { user, isAuthenticated, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<CollapsibleSection, boolean>>({
    notebooks: false,
    filters: true,
    tags: true,
  });
  const [storageRoots, setStorageRoots] = useState<string[]>([]);
  const [treeRoots, setTreeRoots] = useState<TreeRootNode[]>([]);
  const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(window.localStorage.getItem('noteforge:sidebar-width') || '280', 10);
    return Math.max(220, Math.min(420, saved));
  });
  const isResizing = useRef(false);

  // Sync CSS custom property so grid column matches sidebar width exactly
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
    try { window.localStorage.setItem('noteforge:sidebar-width', String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  // ── Sidebar resize via drag handle ──
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (me: MouseEvent) => {
      if (!isResizing.current) return;
      const newW = Math.max(220, Math.min(420, startW + (me.clientX - startX)));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = 'none';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  // Fetch storage roots on mount
  const fetchStorageRoots = useCallback(async () => {
    try {
      const roots = await tauriInvoke<string[]>('list_storage_roots');
      setStorageRoots(roots ?? []);
    } catch { /* storage not configured */ }
  }, []);

  useEffect(() => {
    void fetchStorageRoots();
    const handler = () => { void fetchStorageRoots(); };
    window.addEventListener('noteforge:storage-changed', handler);
    return () => {
      window.removeEventListener('noteforge:storage-changed', handler);
    };
  }, [fetchStorageRoots]);

  // Build tree from filteredNotes + notebooks
  const visibleNotes = useMemo(() => filteredNotes.slice(0, 30), [filteredNotes]);

  const toggleTreeRoot = useCallback(() => {
    setTreeRoots(prev => prev.map(r => ({ ...r, expanded: !r.expanded })));
  }, []);

  const toggleTreeNotebook = useCallback((notebookId: string) => {
    setExpandedNotebooks(prev => ({ ...prev, [notebookId]: !prev[notebookId] }));
  }, []);

  useEffect(() => {
    if (storageRoots.length === 0) return;
    const primaryRoot = storageRoots[0]!;
    const rootName = primaryRoot.split(/[/\\]/).filter(Boolean).pop() || primaryRoot;
    const noteBooks = notebooks.filter(nb => nb.id !== 'all');
    const nbNodes: TreeNotebookNode[] = noteBooks.map(nb => {
      const noteList = filteredNotes.filter(n => (n.meta.notebookId || 'default') === nb.id);
      return {
        id: nb.id,
        name: nb.name,
        icon: nb.icon || '',
        color: nb.color || 'var(--accent)',
        notes: noteList,
        expanded: nb.id in expandedNotebooks ? expandedNotebooks[nb.id]! : activeNotebook === nb.id,
      };
    }).filter(nb => nb.notes.length > 0);
    setTreeRoots(nbNodes.length > 0
      ? [{ path: primaryRoot, name: rootName, notebooks: nbNodes, expanded: true }]
      : []);
  }, [storageRoots, notebooks, filteredNotes, activeNotebook, expandedNotebooks]);

  const toggleSection = useCallback((section: CollapsibleSection) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const openNotebookModal = () => onNewNotebook?.();

  const { theme, toggleTheme } = useTheme();

  const filterList = [
    { id: 'all' as const, iconType: 'all-notes' as const, label: t('sidebarExtra.filterAll') },
    { id: 'favorites' as const, iconType: 'star' as const, label: t('sidebarExtra.filterFavorites') },
    { id: 'pinned' as const, iconType: 'pin' as const, label: t('sidebarExtra.filterPinned') },
    { id: 'recent' as const, iconType: 'recent' as const, label: t('sidebarExtra.filterRecent') },
  ] as const;

  return (
    <aside
      ref={sidebarRef}
      className="sidebar sidebar--compact"
    >
      {/* ── Resize handle ── */}
      <div className="sidebar-resize-handle" onMouseDown={handleResizeStart} />

      <header className="sidebar-top">
        <div className="brand-block">
          <div className="brand-logo"><Icon type="logo" size={18} /></div>
          <div className="brand-copy"><strong>NoteForge</strong><span>{t('app.subtitle')}</span></div>
        </div>
        <div className="sidebar-actions">
          <LanguageSwitcher />
          <button className="icon-button" onClick={toggleTheme} title={t('sidebarExtra.themeTitle')}>
            <Icon type={theme === 'light' ? 'sun' : 'moon'} size={16} />
          </button>
          <button className="icon-button" onClick={() => setIsGraphOpen(true)} title={t('sidebarExtra.graphTitle')}>
            <Icon type="graph" size={16} />
          </button>
        </div>
      </header>

      <div className="sidebar-search"><SearchBox /></div>

      <div className="sidebar-action-buttons">
        <button className="new-note-button" onClick={onNewNote}>
          <Icon type="plus" size={16} />
          <span>{t('sidebar.newNote')}</span>
        </button>
        <button className="new-notebook-button" onClick={openNotebookModal}>
          <Icon type="notebook" size={15} />
          <span>{t('sidebar.newNotebook')}</span>
        </button>
      </div>

      {/* Notebooks section */}
      <section className={`sidebar-section notebooks-section${collapsedSections.notebooks ? ' collapsed' : ''}`}>
        <button className="section-heading" type="button" onClick={() => toggleSection('notebooks')}>
          <span className="section-heading-label">
            <Icon type="notebook" size={14} />
            <span>{t('sidebarExtra.notebookSection')}</span>
          </span>
          <span className={`section-chevron${collapsedSections.notebooks ? ' collapsed' : ''}`}>
            <Icon type="chevron-down" size={14} />
          </span>
        </button>
        {!collapsedSections.notebooks && (
          <div className="notebook-list">
            {notebooks.map((notebook) => {
              const isEmoji = notebook.icon.length <= 2 && /[\u{1F000}-\u{1FFFF}]/u.test(notebook.icon);
              return (
                <button
                  key={notebook.id}
                  className={notebook.id === activeNotebook ? 'notebook-item active' : 'notebook-item'}
                  onClick={() => setActiveNotebook(notebook.id)}
                  onContextMenu={(e) => {
                    if (notebook.id === 'all') return;
                    e.preventDefault();
                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: null, notebookId: notebook.id, kind: 'notebook' });
                  }}
                >
                  {notebook.id === 'all' ? (
                    <Icon type="all-notes" size={16} className="notebook-icon" />
                  ) : isEmoji ? (
                    <span
                      className="notebook-color-dot"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: notebook.color || 'var(--accent)',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <Icon type="notebook" size={15} className="notebook-icon" />
                  )}
                  <span className="notebook-name">{notebook.name}</span>
                  <span className="notebook-count">{notebook.noteCount}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Filters section */}
      <section className={`sidebar-section filters-section${collapsedSections.filters ? ' collapsed' : ''}`}>
        <button className="section-heading" type="button" onClick={() => toggleSection('filters')}>
          <span className="section-heading-label">
            <Icon type="filter" size={14} />
            <span>{t('sidebarExtra.filterSection')}</span>
          </span>
          <span className={`section-chevron${collapsedSections.filters ? ' collapsed' : ''}`}>
            <Icon type="chevron-down" size={14} />
          </span>
        </button>
        {!collapsedSections.filters && (
          <div className="filter-list">
            {filterList.map((filter) => (
              <button
                key={filter.id}
                className={filter.id === currentFilter ? 'filter-item active' : 'filter-item'}
                onClick={() => setCurrentFilter(filter.id)}
              >
                <Icon type={filter.iconType} size={16} />
                <span>{filter.label}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Tags section */}
      <section className={`sidebar-section tags-section${collapsedSections.tags ? ' collapsed' : ''}`}>
        <button className="section-heading" type="button" onClick={() => toggleSection('tags')}>
          <span className="section-heading-label">
            <Icon type="tag" size={14} />
            <span>{t('sidebarExtra.tagSection')}</span>
          </span>
          <span className={`section-chevron${collapsedSections.tags ? ' collapsed' : ''}`}>
            <Icon type="chevron-down" size={14} />
          </span>
        </button>
        {!collapsedSections.tags && (
          <div className="tag-grid">
            {tags.length === 0 ? (
              <div className="tag-empty">
                <div className="tag-empty__title">{t('sidebar.noTags')}</div>
                <div className="tag-empty__desc">{t('sidebar.noTagsDesc')}</div>
              </div>
            ) : (
              <>
                {tags.map((tag) => {
                  const selected = activeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      className={selected ? 'tag-pill active' : 'tag-pill'}
                      onClick={() => {
                        setActiveTags((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                        );
                        setCurrentFilter('tag');
                      }}
                      title={`#${tag}`}
                    >
                      #{tag}
                    </button>
                  );
                })}
                <div className="tag-empty tag-empty--inline">
                  <div className="tag-empty__title">{t('sidebarExtra.tagFilterTitle')}</div>
                  <div className="tag-empty__desc">{t('sidebar.tagFilterHint')}</div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Notes list */}
      <section className="sidebar-notes">
        <div className="section-heading static notes-heading">
          <span className="section-heading-label">
            <Icon type="note" size={14} />
            <span>{t('sidebar.recentNotes')}</span>
          </span>
          <span className="notes-count">{searchResultCount ?? totalCount}</span>
        </div>
        <div className="sidebar-note-scroll">
          {/* Syntax Demo */}
          <button
            className={`sidebar-note sidebar-note--syntax${currentNoteId === SYNTAX_DEMO_ID ? ' active' : ''}`}
            onClick={() => selectNote(SYNTAX_DEMO_ID)}
            title="查看 Markdown 语法展示"
          >
            <div className="sidebar-note-title">
              <Icon type="note" size={15} className="syntax-demo-icon" />
              <strong>Markdown 语法展示</strong>
              <span className="syntax-demo-badge">参考</span>
            </div>
            <p>完整展示所有支持的 Markdown 语法及渲染效果</p>
            <div className="sidebar-note-meta">
              <span>内置参考文档</span>
            </div>
          </button>

          {/* Tree: storage roots → notebooks */}
          {treeRoots.length > 0 ? (
            treeRoots.map((root) => (
              <div key={root.path} className="storage-tree-root" style={{ marginBottom: 4 }}>
                <button className="storage-tree-toggle" onClick={toggleTreeRoot}>
                  <span className="storage-tree-arrow">
                    <Icon type={root.expanded ? 'chevron-down' : 'chevron-right'} size={10} />
                  </span>
                  <Icon type={root.expanded ? 'folder-open' : 'folder'} size={15} />
                  <span className="storage-tree-name">{root.name}</span>
                  <span className="storage-tree-count">{root.notebooks.reduce((s, nb) => s + nb.notes.length, 0)}</span>
                </button>
                {root.expanded && root.notebooks.map((nb) => (
                  <div key={nb.id} style={{ paddingLeft: 12 }}>
                    <button className="storage-tree-toggle" onClick={() => toggleTreeNotebook(nb.id)}>
                      <span className="storage-tree-arrow">
                        <Icon type={nb.expanded ? 'chevron-down' : 'chevron-right'} size={8} />
                      </span>
                      <NotebookDisplayIcon icon={nb.icon} color={nb.color} size={13} />
                      <span className="storage-tree-name" style={{ fontSize: 12 }}>{nb.name}</span>
                      <span className="storage-tree-count">{nb.notes.length}</span>
                    </button>
                    {nb.expanded && nb.notes.map(note => (
                      <button
                        key={note.meta.id}
                        className={note.meta.id === currentNoteId ? 'sidebar-note active' : 'sidebar-note'}
                        style={{ padding: '7px 10px', marginTop: 1 }}
                        onClick={() => selectNote(note.meta.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: note.meta.id, notebookId: nb.id, kind: 'note' });
                        }}
                      >
                        <div className="sidebar-note-title">
                          <span>
                            {note.meta.isPinned ? <Icon type="pin" size={12} /> : note.meta.isFavorite ? <Icon type="star" size={12} /> : null}
                          </span>
                          <strong style={{ fontSize: 13 }}>{note.meta.title}</strong>
                        </div>
                        <p style={{ fontSize: 11 }}>{note.content.replace(/[#*`>-]/g, '').slice(0, 36)}...</p>
                        <div className="sidebar-note-meta" style={{ fontSize: 11 }}>
                          <span>{formatTime(note.meta.updatedAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))
          ) : visibleNotes.length === 0 ? (
            <div className="sidebar-empty">{t('sidebar.noNotes')}</div>
          ) : (
            visibleNotes.map((note) => (
              <button
                key={note.meta.id}
                className={note.meta.id === currentNoteId ? 'sidebar-note active' : 'sidebar-note'}
                onClick={() => selectNote(note.meta.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: note.meta.id, notebookId: null, kind: 'note' });
                }}
              >
                <div className="sidebar-note-title">
                  <span>
                    {note.meta.isPinned ? <Icon type="pin" size={13} /> : note.meta.isFavorite ? <Icon type="star" size={13} /> : null}
                  </span>
                  <strong>{note.meta.title}</strong>
                </div>
                <p>{note.content.replace(/[#*`>-]/g, '').slice(0, 42)}...</p>
                <div className="sidebar-note-meta">
                  <span>{formatTime(note.meta.updatedAt)}</span>
                </div>
              </button>
            ))
          )}

          {/* Imported directories */}
          {storageRoots.length > 1 && (
            <div className="scanned-section" style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div className="section-heading static" style={{ marginBottom: 4 }}>
                <span className="section-heading-label">
                  <Icon type="folder" size={14} />
                  <span>{t('sidebar.importedDirs')}</span>
                </span>
              </div>
              {storageRoots.slice(1).map((rootPath) => (
                <ScannedTree key={rootPath} rootPath={rootPath} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="sidebar-status">
        <SyncIndicator />
        <div className="sidebar-status__spacer" />
        {isAuthenticated ? (
          <button className="sidebar-manage-btn" onClick={logout} title={t('sidebar.loggedIn', { username: user?.username ?? '' })}>
            <Icon type="user" size={14} />
            <span className="sidebar-manage-btn__label">{user?.username}</span>
          </button>
        ) : (
          <button className="sidebar-manage-btn auth-btn" onClick={() => setAuthOpen(true)} title={t('sidebar.loginTitle')}>
            <Icon type="user" size={14} />
          </button>
        )}
        <button className="sidebar-manage-btn" onClick={onManage} title={t('sidebarExtra.manageTitle')}>
          <Icon type="gear" size={14} />
        </button>
        <button className="sidebar-manage-btn" onClick={onDraftRecovery} title={t('sidebarExtra.draftTitle')}>
          <Icon type="draft" size={14} />
        </button>
        <button className="sidebar-manage-btn" onClick={onAbout} title={t('about.title')}>
          <Icon type="info" size={14} />
        </button>
      </footer>
      {authOpen && <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />}
    </aside>
  );
}
