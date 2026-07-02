import { memo, useMemo, useState } from 'react';
import { useStore } from '@/stores/context';
import { formatTime } from '@/utils/markdown';
import { Icon } from '@/components/Common/Icon';

function NoteCard({ note, isActive, searchQuery, onSelect, onContextMenu, isSelected, onToggleSelect }: {
  note: import('@/types').Note;
  isActive: boolean;
  searchQuery: string;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
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
      className={`note-card${isActive ? ' note-card--active' : ''}${isSelected ? ' note-card--selected' : ''}`}
    >
      <label className="note-card__checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(note.meta.id)}
        />
      </label>
      <div
        className="note-card__body"
        onClick={() => onSelect(note.meta.id)}
        onContextMenu={(e) => onContextMenu(e, note.meta.id)}
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
    </div>
  );
}

const NoteCardMemo = memo(NoteCard);

export function NoteList() {
  const store = useStore();
  const [batchTagInput, setBatchTagInput] = useState('');
  const [showBatchTag, setShowBatchTag] = useState(false);
  const [showBatchMove, setShowBatchMove] = useState(false);

  const numSelected = store.selectedNoteIds.length;

  const handleBatchTag = () => {
    const tag = batchTagInput.trim();
    if (!tag) return;
    store.batchTagNotes(tag);
    setBatchTagInput('');
    setShowBatchTag(false);
  };

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
      {/* Batch action toolbar */}
      {numSelected > 0 && (
        <div className="batch-toolbar">
          <span className="batch-toolbar__count">已选 {numSelected} 项</span>
          <div className="batch-toolbar__actions">
            {showBatchMove ? (
              <div className="batch-move-dropdown">
                {store.notebooks.filter((nb) => nb.id !== 'all').map((nb) => (
                  <button
                    key={nb.id}
                    className="batch-move-option"
                    onClick={() => { store.batchMoveNotes(nb.id); setShowBatchMove(false); }}
                  >
                    {nb.icon} {nb.name}
                  </button>
                ))}
                <button className="batch-move-option batch-move-cancel" onClick={() => setShowBatchMove(false)}>✕ 取消</button>
              </div>
            ) : (
              <button className="batch-btn" onClick={() => setShowBatchMove(true)} title="批量移动">
                <Icon type="rename" /> 移动
              </button>
            )}
            {showBatchTag ? (
              <div className="batch-tag-inline">
                <input
                  className="batch-tag-input"
                  value={batchTagInput}
                  onChange={(e) => setBatchTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleBatchTag(); if (e.key === 'Escape') setShowBatchTag(false); }}
                  placeholder="输入标签名..."
                  autoFocus
                />
                <button className="batch-btn batch-btn--confirm" onClick={handleBatchTag}>✓</button>
                <button className="batch-btn" onClick={() => setShowBatchTag(false)}>✕</button>
              </div>
            ) : (
              <button className="batch-btn" onClick={() => setShowBatchTag(true)} title="批量打标签">
                <Icon type="shoucang" /> 标签
              </button>
            )}
            <button className="batch-btn batch-btn--danger" onClick={() => { if (window.confirm(`确认删除 ${numSelected} 条笔记？`)) store.batchDeleteNotes(); }} title="批量删除">
              <Icon type="delete" /> 删除
            </button>
            <button className="batch-btn" onClick={store.clearSelection} title="取消选择">
              ✕ 取消
            </button>
          </div>
        </div>
      )}
      {numSelected === 0 && (
        <div className="batch-select-all-bar">
          <button className="batch-btn batch-btn--select-all" onClick={store.selectAllFiltered}>☐ 全选</button>
        </div>
      )}
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
          isSelected={store.selectedNoteIds.includes(note.meta.id)}
          onToggleSelect={store.toggleNoteSelection}
        />
      ))}
    </div>
  );
}
