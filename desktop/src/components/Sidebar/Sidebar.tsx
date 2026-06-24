import { useMemo } from 'react';
import { useStore } from '../../stores/context';
import { useTheme } from '@/hooks/useTheme';

const FILTERS = [
  { id: 'all', icon: '⭐', label: '收藏的笔记' },
  { id: 'pinned', icon: '📌', label: '已固定' },
  { id: 'recent', icon: '🕘', label: '最近查看' },
] as const;

interface SidebarProps {
  onNewNote?: () => void;
}

export function Sidebar({ onNewNote }: SidebarProps) {
  const {
    searchQuery,
    setSearchQuery,
    currentFilter,
    setCurrentFilter,
    activeNotebook,
    setActiveNotebook,
    notebooks,
    notes,
    favoriteCount,
    totalCount,
    searchResultCount,
    setIsGraphOpen,
    selectNote,
    currentNoteId,
  } = useStore();
  const { theme, toggleTheme } = useTheme();

  const tags = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach((note) => note.meta.tags.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1)));
    return Array.from(map.entries()).slice(0, 24);
  }, [notes]);

  const visibleNotes = useMemo(() => notes.slice(0, 30), [notes]);

  return (
    <aside className="sidebar">
      <header className="sidebar-top">
        <div className="brand-block">
          <div className="brand-logo">✦</div>
          <div className="brand-copy">
            <strong>NoteForge</strong>
            <span>Offline Desktop</span>
          </div>
        </div>
        <div className="sidebar-actions">
          <button className="icon-button" onClick={toggleTheme} title="切换颜色主题">
            {theme === 'light' ? '◐' : '◑'}
          </button>
          <button className="icon-button" onClick={() => setIsGraphOpen(true)} title="打开图谱视图">♢</button>
        </div>
      </header>

      <div className="sidebar-search">
        <span>🔍</span>
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索笔记..." />
        <kbd>⌘K</kbd>
      </div>

      <button className="new-note-button" onClick={onNewNote}>＋ 新建笔记</button>

      <section className="sidebar-section notebooks-section">
        <button className="section-heading" type="button">
          <span>笔记本</span>
          <span>⌄</span>
        </button>
        <div className="notebook-list">
          {notebooks.map((notebook) => (
            <button
              key={notebook.id}
              className={notebook.id === activeNotebook ? 'notebook-item active' : 'notebook-item'}
              onClick={() => setActiveNotebook(notebook.id)}
            >
              <span className="notebook-icon">{notebook.icon}</span>
              <span className="notebook-name">{notebook.name}</span>
              <span className="notebook-count">{notebook.noteCount}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section filters-section">
        <button className="section-heading" type="button">
          <span>筛选</span>
          <span>⌄</span>
        </button>
        <div className="filter-list">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              className={filter.id === currentFilter ? 'filter-item active' : 'filter-item'}
              onClick={() => setCurrentFilter(filter.id)}
            >
              <span>{filter.icon}</span>
              <span>{filter.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section tags-section">
        <div className="section-heading static">
          <span>标签</span>
        </div>
        <div className="tag-strip">
          {tags.map(([tag, count]) => (
            <button key={tag} className="tag-pill" title={`#${tag} · ${count} 篇`}>
              #{tag}
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-notes">
        <div className="section-heading static notes-heading">
          <span>最近笔记</span>
          <span>{searchResultCount ?? totalCount} 条</span>
        </div>
        <div className="sidebar-note-scroll">
          {visibleNotes.map((note) => (
            <button
              key={note.meta.id}
              className={note.meta.id === currentNoteId ? 'sidebar-note active' : 'sidebar-note'}
              onClick={() => selectNote(note.meta.id)}
            >
              <div className="sidebar-note-title">
                <span>{note.meta.isPinned ? '📌' : note.meta.isFavorite ? '⭐' : ''}</span>
                <strong>{note.meta.title}</strong>
              </div>
              <p>{note.content.replace(/[#*`>-]/g, '').slice(0, 42)}...</p>
              <div className="sidebar-note-meta">
                <span>{formatRelativeTime(note.meta.updatedAt)}</span>
                <span>{note.meta.wordCount} 字</span>
                {note.meta.backlinks > 0 && <span>🔗 {note.meta.backlinks}</span>}
              </div>
            </button>
          ))}
        </div>
      </section>

      <footer className="sidebar-status">
        <span className="sync-dot" />
        <span>已同步</span>
        <span>{favoriteCount} 收藏</span>
      </footer>
    </aside>
  );
}

function formatRelativeTime(time: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}
