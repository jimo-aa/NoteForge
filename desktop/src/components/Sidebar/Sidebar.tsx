import { useMemo, useState } from 'react';
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
import type { EntityModalState } from '@/components/Modals/EntityModal';

interface SidebarProps {
  onNewNote?: () => void;
  onNewNotebook?: () => void;
  onManage?: () => void;
  onDraftRecovery?: () => void;
  onAbout?: () => void;
}

export function Sidebar({ onNewNote, onNewNotebook, onManage, onDraftRecovery, onAbout }: SidebarProps) {
  const { t } = useTranslation();
  const { searchQuery, setSearchQuery, currentFilter, setCurrentFilter, activeNotebook, setActiveNotebook, notebooks, tags, favoriteCount, totalCount, searchResultCount, setIsGraphOpen, selectNote, currentNoteId, activeTags, setActiveTags, filteredNotes, setContextMenu } = useStore();
  const { user, isAuthenticated, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const openNotebookModal = () => onNewNotebook?.();

  const { theme, toggleTheme } = useTheme();

  const visibleNotes = useMemo(() => filteredNotes.slice(0, 30), [filteredNotes]);

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
      <section className="sidebar-section notebooks-section"><button className="section-heading" type="button"><span>{t('sidebarExtra.notebookSection')}</span><span>⌄</span></button><div className="notebook-list">{notebooks.map((notebook) => (<button key={notebook.id} className={notebook.id === activeNotebook ? 'notebook-item active' : 'notebook-item'} onClick={() => setActiveNotebook(notebook.id)} onContextMenu={(e) => { if (notebook.id === 'all') return; e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: null, notebookId: notebook.id, kind: 'notebook' }); }}><span className="notebook-icon">{notebook.icon}</span><span className="notebook-name">{notebook.name}</span><span className="notebook-count">{notebook.noteCount}</span></button>))}</div></section>
      <section className="sidebar-section filters-section"><button className="section-heading" type="button"><span>{t('sidebarExtra.filterSection')}</span><span>⌄</span></button><div className="filter-list">{filterList.map((filter) => (<button key={filter.id} className={filter.id === currentFilter ? 'filter-item active' : 'filter-item'} onClick={() => setCurrentFilter(filter.id)}><Icon type={filter.iconType} /><span>{filter.label}</span></button>))}</div></section>
      <section className="sidebar-section tags-section"><div className="section-heading static"><span>{t('sidebarExtra.tagSection')}</span></div><div className="tag-grid">{tags.length === 0 ? <div className="tag-empty"><div className="tag-empty__title">{t('sidebar.noTags')}</div><div className="tag-empty__desc">{t('sidebar.noTagsDesc')}</div></div> : <>{tags.map((tag) => { const selected = activeTags.includes(tag); return (<button key={tag} className={selected ? 'tag-pill active' : 'tag-pill'} onClick={() => { setActiveTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]); setCurrentFilter('tag'); }} title={`#${tag}`}>#{tag}</button>); })}<div className="tag-empty tag-empty--inline"><div className="tag-empty__title">{t('sidebarExtra.tagFilterTitle')}</div><div className="tag-empty__desc">{t('sidebar.tagFilterHint')}</div></div></>}</div></section>
      <section className="sidebar-notes"><div className="section-heading static notes-heading"><span>{t('sidebar.recentNotes')}</span><span>{t('sidebarExtra.notesCount', { count: searchResultCount ?? totalCount })}</span></div><div className="sidebar-note-scroll">{visibleNotes.length === 0 ? <div className="sidebar-empty">{t('sidebar.noNotes')}</div> : visibleNotes.map((note) => (<button key={note.meta.id} className={note.meta.id === currentNoteId ? 'sidebar-note active' : 'sidebar-note'} onClick={() => selectNote(note.meta.id)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: note.meta.id, notebookId: null, kind: 'note' }); }}><div className="sidebar-note-title"><span>{note.meta.isPinned ? <Icon type="gudin" /> : note.meta.isFavorite ? <Icon type="shoucang" /> : ''}</span><strong>{note.meta.title}</strong></div><p>{note.content.replace(/[#*`>-]/g, '').slice(0, 42)}...</p><div className="sidebar-note-meta"><span>{formatTime(note.meta.updatedAt)}</span></div></button>))}</div></section>
      <footer className="sidebar-status">
        <SyncIndicator />
        <span>{t('sidebarExtra.favoriteCount', { count: favoriteCount })}</span>
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
