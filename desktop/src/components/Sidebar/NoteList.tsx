import { memo, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <span>{note.meta.wordCount} {t('editor.words')}</span>
          {note.meta.tags.length > 0 && <span>#{note.meta.tags[0]}</span>}
        </div>
      </div>
    </div>
  );
}

const NoteCardMemo = memo(NoteCard);

export function NoteList() {
  const store = useStore();
  const { t } = useTranslation();
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

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: store.filteredNotes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  const hasNotes = store.filteredNotes.length > 0;

  if (!hasNotes) {
    return (
      <div className="note-list-empty">
        <div className="empty-state empty-state--notes">
          <div className="empty-state__icon">⌘</div>
          <h2>{t('noteList.emptyTitle')}</h2>
          <p>{t('noteList.emptyDesc')}</p>
          <div className="empty-state__hint">{t('noteList.emptyHint')}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="editor-view" style={{ overflow: 'auto', position: 'relative', gap: 12 }}>

      {/* Batch action toolbar */}
      {numSelected > 0 && (
        <div className="batch-toolbar">
          <span className="batch-toolbar__count">{t('sidebar.selected', { count: numSelected })}</span>
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
                <button className="batch-move-option batch-move-cancel" onClick={() => setShowBatchMove(false)}>{t('sidebar.cancel')}</button>
              </div>
            ) : (
              <button className="batch-btn" onClick={() => setShowBatchMove(true)} title={t('sidebar.batchMove')}>
                <Icon type="rename" /> {t('sidebar.batchMove')}
              </button>
            )}
            {showBatchTag ? (
              <div className="batch-tag-inline">
                <input
                  className="batch-tag-input"
                  value={batchTagInput}
                  onChange={(e) => setBatchTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleBatchTag(); if (e.key === 'Escape') setShowBatchTag(false); }}
                  placeholder={t('sidebar.tagInputPlaceholder')}
                  autoFocus
                />
                <button className="batch-btn batch-btn--confirm" onClick={handleBatchTag}>✓</button>
                <button className="batch-btn" onClick={() => setShowBatchTag(false)}>✕</button>
              </div>
            ) : (
              <button className="batch-btn" onClick={() => setShowBatchTag(true)} title={t('sidebar.batchTag')}>
                <Icon type="shoucang" /> {t('sidebar.batchTag')}
              </button>
            )}
            <button className="batch-btn" onClick={store.batchPinNotes} title={t('sidebar.batchPin')}>
              <Icon type="gudin" /> {t('sidebar.batchPin')}
            </button>
            <button className="batch-btn" onClick={store.batchFavoriteNotes} title={t('sidebar.batchFavorite')}>
              <Icon type="shoucang" /> {t('sidebar.batchFavorite')}
            </button>
            <button className="batch-btn" onClick={() => void store.batchExportNotes()} title={t('sidebar.batchExport')}>
              📦 {t('sidebar.batchExport')}
            </button>
            <button className="batch-btn batch-btn--danger" onClick={() => { if (window.confirm(t('sidebar.batchDeleteConfirm', { count: numSelected }))) store.batchDeleteNotes(); }} title={t('sidebar.batchDelete')}>
              <Icon type="delete" /> {t('sidebar.batchDelete')}
            </button>
            <button className="batch-btn" onClick={store.clearSelection} title={t('sidebar.batchCancel')}>
              {t('sidebar.batchCancel')}
            </button>
          </div>
        </div>
      )}
      {numSelected === 0 && (
        <div className="batch-select-all-bar">
          <button className="batch-btn batch-btn--select-all" onClick={store.selectAllFiltered}>{t('sidebar.selectAll')}</button>
        </div>
      )}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const note = store.filteredNotes[virtualItem.index];
          if (!note) return null;
          return (
            <div
              key={note.meta.id}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)` }}
            >
              <NoteCardMemo
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
