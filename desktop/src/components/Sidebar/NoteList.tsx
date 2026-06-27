import { memo, useMemo } from 'react';
import { useStore } from '@/stores/context';
import { formatTime } from '@/utils/markdown';
import { Icon } from '@/components/Common/Icon';

function NoteCard({ note, isActive, searchQuery, onSelect, onContextMenu }: {
  note: import('@/types').Note;
  isActive: boolean;
  searchQuery: string;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  const titleEl = useMemo(() => {
    if (!searchQuery) return note.meta.title;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = note.meta.title.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === searchQuery.toLowerCase() ? <mark key={i}>{p}</mark> : p
    );
  }, [note.meta.title, searchQuery]);

  return (
    <div
      className={`note-card${isActive ? ' note-card--active' : ''}`}
      onClick={() => onSelect(note.meta.id)}
      onContextMenu={(e) => onContextMenu(e, note.meta.id)}
      draggable
    >
      <div className="note-card__title">
        <strong>{titleEl}</strong>
        <div>{note.meta.isPinned ? <Icon type="gudin" /> : note.meta.isFavorite ? <Icon type="shoucang" /> : ''}</div>
      </div>
      <div className="preview">{note.content.slice(0, 120)}</div>
      <div className="note-card__meta">
        <span>{formatTime(note.meta.updatedAt)}</span>
        <span>{note.meta.wordCount} 字</span>
        {note.meta.tags.length > 0 && <span>#{note.meta.tags[0]}</span>}
      </div>
    </div>
  );
}

const NoteCardMemo = memo(NoteCard);

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
        <NoteCardMemo
          key={note.meta.id}
          note={note}
          isActive={note.meta.id === store.currentNoteId}
          searchQuery={store.searchQuery}
          onSelect={store.selectNote}
          onContextMenu={(e, id) => {
            e.preventDefault();
            store.setContextMenu({ visible: true, x: e.clientX, y: e.clientY, noteId: id, notebookId: null, kind: 'note' });
          }}
        />
      ))}
    </div>
  );
}
