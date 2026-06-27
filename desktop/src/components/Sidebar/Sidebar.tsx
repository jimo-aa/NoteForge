import { useMemo } from 'react';
import { useStore } from '../../stores/context';
import { useTheme } from '@/hooks/useTheme';
import { SearchBox } from '@/components/Sidebar/SearchBox';
import { Icon } from '@/components/Common/Icon';
import { formatTime } from '@/utils/markdown';
import type { EntityModalState } from '@/components/Modals/EntityModal';

const FILTERS = [
  { id: 'all', iconType: 'zuijin' as const, label: '全部笔记' },
  { id: 'favorites', iconType: 'shoucang' as const, label: '收藏的笔记' },
  { id: 'pinned', iconType: 'gudin' as const, label: '已固定' },
  { id: 'recent', iconType: 'zuijin' as const, label: '最近查看' },
] as const;

interface SidebarProps {
  onNewNote?: () => void;
  onNewNotebook?: () => void;
  onManage?: () => void;
  onDraftRecovery?: () => void;
}

export function Sidebar({ onNewNote, onNewNotebook, onManage, onDraftRecovery }: SidebarProps) {
  const { searchQuery, setSearchQuery, currentFilter, setCurrentFilter, activeNotebook, setActiveNotebook, notebooks, tags, favoriteCount, totalCount, searchResultCount, setIsGraphOpen, selectNote, currentNoteId, activeTags, setActiveTags, filteredNotes, setContextMenu } = useStore();

  const openNotebookModal = () => onNewNotebook?.();

  const { theme, toggleTheme } = useTheme();

  const visibleNotes = useMemo(() => filteredNotes.slice(0, 30), [filteredNotes]);

  return (
    <aside className="sidebar sidebar--compact">
      <header className="sidebar-top"><div className="brand-block"><div className="brand-logo">✦</div><div className="brand-copy"><strong>NoteForge</strong><span>Offline Desktop</span></div></div><div className="sidebar-actions"><button className="icon-button" onClick={toggleTheme} title="切换颜色主题">{theme === 'light' ? '◐' : '◑'}</button><button className="icon-button" onClick={() => setIsGraphOpen(true)} title="打开图谱视图">♢</button></div></header>
      <div className="sidebar-search"><SearchBox /></div>
      <button className="new-note-button" onClick={onNewNote}>＋ 新建笔记</button>
      <button className="new-notebook-button" onClick={openNotebookModal}>＋ 新建笔记本</button>
      <section className="sidebar-section notebooks-section"><button className="section-heading" type="button"><span>笔记本</span><span>⌄</span></button><div className="notebook-list">{notebooks.map((notebook) => (<button key={notebook.id} className={notebook.id === activeNotebook ? 'notebook-item active' : 'notebook-item'} onClick={() => setActiveNotebook(notebook.id)} onContextMenu={(e) => { if (notebook.id === 'all') return; e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: null, notebookId: notebook.id, kind: 'notebook' }); }}><span className="notebook-icon">{notebook.icon}</span><span className="notebook-name">{notebook.name}</span><span className="notebook-count">{notebook.noteCount}</span></button>))}</div></section>
      <section className="sidebar-section filters-section"><button className="section-heading" type="button"><span>筛选</span><span>⌄</span></button><div className="filter-list">{FILTERS.map((filter) => (<button key={filter.id} className={filter.id === currentFilter ? 'filter-item active' : 'filter-item'} onClick={() => setCurrentFilter(filter.id)}><Icon type={filter.iconType} /><span>{filter.label}</span></button>))}</div></section>
      <section className="sidebar-section tags-section"><div className="section-heading static"><span>标签</span></div><div className="tag-grid">{tags.length === 0 ? <div className="tag-empty"><div className="tag-empty__title">暂无标签</div><div className="tag-empty__desc">创建笔记并添加标签后，会在这里显示可筛选的标签。</div></div> : <>{tags.map((tag) => { const selected = activeTags.includes(tag); return (<button key={tag} className={selected ? 'tag-pill active' : 'tag-pill'} onClick={() => { setActiveTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]); setCurrentFilter('tag'); }} title={`#${tag}`}>#{tag}</button>); })}<div className="tag-empty tag-empty--inline"><div className="tag-empty__title">标签筛选</div><div className="tag-empty__desc">支持多选，未选中任何标签时将默认展示全部文件列表。</div></div></>}</div></section>
      <section className="sidebar-notes"><div className="section-heading static notes-heading"><span>最近笔记</span><span>{searchResultCount ?? totalCount} 条</span></div><div className="sidebar-note-scroll">{visibleNotes.length === 0 ? <div className="sidebar-empty">暂无笔记</div> : visibleNotes.map((note) => (<button key={note.meta.id} className={note.meta.id === currentNoteId ? 'sidebar-note active' : 'sidebar-note'} onClick={() => selectNote(note.meta.id)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: note.meta.id, notebookId: null, kind: 'note' }); }}><div className="sidebar-note-title"><span>{note.meta.isPinned ? <Icon type="gudin" /> : note.meta.isFavorite ? <Icon type="shoucang" /> : ''}</span><strong>{note.meta.title}</strong></div><p>{note.content.replace(/[#*`>-]/g, '').slice(0, 42)}...</p><div className="sidebar-note-meta"><span>{formatTime(note.meta.updatedAt)}</span></div></button>))}</div></section>
      <footer className="sidebar-status">
        <span className="sync-dot" />
        <span>已同步</span>
        <span>{favoriteCount} 收藏</span>
        <button className="sidebar-manage-btn" onClick={onManage} title="管理笔记本和标签">⚙</button>
        <button className="sidebar-manage-btn" onClick={onDraftRecovery} title="恢复草稿">📝</button>
      </footer>
    </aside>
  );
}
