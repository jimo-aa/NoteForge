import { useMemo, useState, useCallback, useEffect } from 'react';
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

  // Fetch storage roots on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const roots = await tauriInvoke<string[]>('list_storage_roots');
        if (!cancelled) setStorageRoots(roots ?? []);
      } catch { /* storage not configured */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build tree from filteredNotes + notebooks whenever either changes
  const visibleNotes = useMemo(() => filteredNotes.slice(0, 30), [filteredNotes]);

  const toggleTreeRoot = useCallback((index: number) => {
    setTreeRoots(prev => prev.map((r, i) => i === index ? { ...r, expanded: !r.expanded } : r));
  }, []);

  const toggleTreeNotebook = useCallback((rootIdx: number, nbIdx: number) => {
    setTreeRoots(prev => prev.map((r, ri) => ri !== rootIdx ? r : {
      ...r,
      notebooks: r.notebooks.map((nb, ni) => ni === nbIdx ? { ...nb, expanded: !nb.expanded } : nb),
    }));
  }, []);

  useEffect(() => {
    if (storageRoots.length === 0) return;
    const tree: TreeRootNode[] = storageRoots.map(rootPath => {
      const rootName = rootPath.split(/[/\\]/).filter(Boolean).pop() || rootPath;
      // Find notebooks that have notes in this root (match by notebookId-derived path)
      const noteBooks = notebooks.filter(nb => nb.id !== 'all');
      const nbNodes: TreeNotebookNode[] = noteBooks.map(nb => {
        const noteList = visibleNotes.filter(n => (n.meta.notebookId || 'default') === nb.id);
        return {
          id: nb.id,
          name: nb.name,
          icon: nb.icon || '📓',
          notes: noteList,
          expanded: activeNotebook === nb.id,
        };
      }).filter(nb => nb.notes.length > 0);
      return { path: rootPath, name: rootName, notebooks: nbNodes, expanded: true };
    }).filter(r => r.notebooks.length > 0);
    setTreeRoots(tree);
  }, [storageRoots, notebooks, visibleNotes, activeNotebook]);

  const toggleSection = useCallback((section: CollapsibleSection) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const openNotebookModal = () => onNewNotebook?.();

  const { theme, toggleTheme } = useTheme();

  const filterList = [
    { id: 'all', iconType: 'zuijin' as const, label: t('sidebarExtra.filterAll') },
    { id: 'favorites', iconType: 'shoucang' as const, label: t('sidebarExtra.filterFavorites') },
    { id: 'pinned', iconType: 'gudin' as const, label: t('sidebarExtra.filterPinned') },
    { id: 'recent', iconType: 'zuijin' as const, label: t('sidebarExtra.filterRecent') },
  ] as const;

  return (
    <aside className="sidebar sidebar--compact">
      <header className="sidebar-top">
        <div className="brand-block">
          <div className="brand-logo">✦</div>
          <div className="brand-copy"><strong>NoteForge</strong><span>{t('app.subtitle')}</span></div>
        </div>
        <div className="sidebar-actions">
          <LanguageSwitcher />
          <button className="icon-button" onClick={toggleTheme} title={t('sidebarExtra.themeTitle')}>{theme === 'light' ? '◐' : '◑'}</button>
          <button className="icon-button" onClick={() => setIsGraphOpen(true)} title={t('sidebarExtra.graphTitle')}>♢</button>
        </div>
      </header>
      <div className="sidebar-search"><SearchBox /></div>
      <button className="new-note-button" onClick={onNewNote}>{t('sidebar.newNote')}</button>
      <button className="new-notebook-button" onClick={openNotebookModal}>{t('sidebar.newNotebook')}</button>

      {/* Notebooks section — collapsible */}
      <section className={`sidebar-section notebooks-section${collapsedSections.notebooks ? ' collapsed' : ''}`}>
        <button className="section-heading" type="button" onClick={() => toggleSection('notebooks')}>
          <span>{t('sidebarExtra.notebookSection')}</span>
          <span className={`section-chevron${collapsedSections.notebooks ? ' collapsed' : ''}`}>⌄</span>
        </button>
        {!collapsedSections.notebooks && (
          <div className="notebook-list">
            {notebooks.map((notebook) => (
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
                <span className="notebook-icon">{notebook.icon}</span>
                <span className="notebook-name">{notebook.name}</span>
                <span className="notebook-count">{notebook.noteCount}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Filters section — collapsible */}
      <section className={`sidebar-section filters-section${collapsedSections.filters ? ' collapsed' : ''}`}>
        <button className="section-heading" type="button" onClick={() => toggleSection('filters')}>
          <span>{t('sidebarExtra.filterSection')}</span>
          <span className={`section-chevron${collapsedSections.filters ? ' collapsed' : ''}`}>⌄</span>
        </button>
        {!collapsedSections.filters && (
          <div className="filter-list">
            {filterList.map((filter) => (
              <button
                key={filter.id}
                className={filter.id === currentFilter ? 'filter-item active' : 'filter-item'}
                onClick={() => setCurrentFilter(filter.id)}
              >
                <Icon type={filter.iconType} /><span>{filter.label}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Tags section — collapsible */}
      <section className={`sidebar-section tags-section${collapsedSections.tags ? ' collapsed' : ''}`}>
        <button className="section-heading" type="button" onClick={() => toggleSection('tags')}>
          <span>{t('sidebarExtra.tagSection')}</span>
          <span className={`section-chevron${collapsedSections.tags ? ' collapsed' : ''}`}>⌄</span>
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

      {/* Notes list — always visible (takes remaining space) */}
      <section className="sidebar-notes">
        <div className="section-heading static notes-heading">
          <span>{t('sidebar.recentNotes')}</span>
          <span>{t('sidebarExtra.notesCount', { count: searchResultCount ?? totalCount })}</span>
        </div>
        <div className="sidebar-note-scroll">
          {/* ── Syntax Demo: clickable note item ── */}
          <button
            className={`sidebar-note sidebar-note--syntax${currentNoteId === SYNTAX_DEMO_ID ? ' active' : ''}`}
            onClick={() => selectNote(SYNTAX_DEMO_ID)}
            title="查看 Markdown 语法展示"
          >
            <div className="sidebar-note-title">
              <span className="syntax-demo-icon">✦</span>
              <strong>Markdown 语法展示</strong>
              <span className="syntax-demo-badge">不可编辑</span>
            </div>
            <p>完整展示所有支持的 Markdown 语法及渲染效果</p>
            <div className="sidebar-note-meta">
              <span>⚡ 内置参考文档</span>
            </div>
          </button>

          {/* ── Tree: notes organized under storage roots → notebooks ── */}
          {treeRoots.length > 0 ? (
            treeRoots.map((root, ri) => (
              <div key={root.path} className="storage-tree-root" style={{ marginBottom: 4 }}>
                <button className="storage-tree-toggle" onClick={() => toggleTreeRoot(ri)}>
                  <span className="storage-tree-arrow">{root.expanded ? '▼' : '▶'}</span>
                  <span className="storage-tree-folder">📁</span>
                  <span className="storage-tree-name">{root.name}</span>
                  <span className="storage-tree-count">{root.notebooks.reduce((s, nb) => s + nb.notes.length, 0)}</span>
                </button>
                {root.expanded && root.notebooks.map((nb, ni) => (
                  <div key={nb.id} style={{ paddingLeft: 12 }}>
                    <button className="storage-tree-toggle" onClick={() => toggleTreeNotebook(ri, ni)}>
                      <span className="storage-tree-arrow" style={{ fontSize: 7 }}>{nb.expanded ? '▼' : '▶'}</span>
                      <span className="storage-tree-folder" style={{ fontSize: 12 }}>{nb.icon}</span>
                      <span className="storage-tree-name" style={{ fontSize: 11 }}>{nb.name}</span>
                      <span className="storage-tree-count">{nb.notes.length}</span>
                    </button>
                    {nb.expanded && nb.notes.map(note => (
                      <button
                        key={note.meta.id}
                        className={note.meta.id === currentNoteId ? 'sidebar-note active' : 'sidebar-note'}
                        style={{ padding: '8px 10px', marginTop: 2 }}
                        onClick={() => selectNote(note.meta.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: note.meta.id, notebookId: nb.id, kind: 'note' });
                        }}
                      >
                        <div className="sidebar-note-title">
                          <span>{note.meta.isPinned ? <Icon type="gudin" /> : note.meta.isFavorite ? <Icon type="shoucang" /> : ''}</span>
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
                  <span>{note.meta.isPinned ? <Icon type="gudin" /> : note.meta.isFavorite ? <Icon type="shoucang" /> : ''}</span>
                  <strong>{note.meta.title}</strong>
                </div>
                <p>{note.content.replace(/[#*`>-]/g, '').slice(0, 42)}...</p>
                <div className="sidebar-note-meta">
                  <span>{formatTime(note.meta.updatedAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <footer className="sidebar-status">
        <SyncIndicator />
        {isAuthenticated ? (
          <button className="sidebar-manage-btn" onClick={logout} title={t('sidebar.loggedIn', { username: user?.username ?? '' })}>{user?.username} ⏻</button>
        ) : (
          <button className="sidebar-manage-btn auth-btn" onClick={() => setAuthOpen(true)} title={t('sidebar.loginTitle')}>{t('sidebar.login')}</button>
        )}
        <button className="sidebar-manage-btn" onClick={onManage} title={t('sidebarExtra.manageTitle')}>⚙</button>
        <button className="sidebar-manage-btn" onClick={onDraftRecovery} title={t('sidebarExtra.draftTitle')}>📝</button>
        <button className="sidebar-manage-btn" onClick={onAbout} title={t('about.title')}>ℹ</button>
      </footer>
      {authOpen && <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />}
    </aside>
  );
}
