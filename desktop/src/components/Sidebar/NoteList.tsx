import { useStore } from '@/stores/context';
import { formatTime } from '@/utils/markdown';

export function NoteList() {
  const store = useStore();

  if (store.filteredNotes.length === 0) {
    return (
      <div className="note-list-empty">
        <div className="empty-state empty-state--notes">
          <div className="empty-state__icon">⌘</div>
          <h2>暂无笔记</h2>
          <p>当前筛选条件下没有可显示的笔记。</p>
          <div className="empty-state__hint">可以尝试切换筛选、清空搜索或新建一条笔记。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-view" style={{ gap: 12 }}>
      {store.filteredNotes.map(note => (
        <div
          key={note.meta.id}
          className={`note-card${note.meta.id === store.currentNoteId ? ' note-card--active' : ''}`}
          onClick={() => store.selectNote(note.meta.id)}
          onContextMenu={e => {
            e.preventDefault();
            store.setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              noteId: note.meta.id,
              notebookId: null,
              kind: 'note',
            });
          }}
          draggable
        >
          <div className="note-card__title">
            <strong>{highlight(note.meta.title, store.searchQuery)}</strong>
            <div>{note.meta.isPinned ? '📌' : note.meta.isFavorite ? '⭐' : ''}</div>
          </div>
          <div className="preview">{note.content.slice(0, 120)}</div>
          <div className="note-card__meta">
            <span>{formatTime(note.meta.updatedAt)}</span>
            <span>{note.meta.wordCount} 字</span>
            {note.meta.backlinks > 0 && <span>🔗 {note.meta.backlinks}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i}>{p}</mark> : p
  );
}
