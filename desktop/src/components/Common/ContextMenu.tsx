import { useStore } from '@/stores/context';

export function ContextMenu() {
  const store = useStore();
  const { visible, x, y, noteId } = store.contextMenu;

  if (!visible || !noteId) return null;

  const note = store.notes.find(n => n.meta.id === noteId);
  if (!note) return null;

  const actions = [
    { label: '✏️ 重命名', action: () => {
      const title = prompt('重命名:', note.meta.title);
      if (title) store.updateNote(noteId, { title });
    }},
    { label: '📋 复制笔记', action: () => { store.duplicateNote(noteId); store.showToast('success', '📋 已复制'); }},
    { label: note.meta.isPinned ? '📌 取消固定' : '📌 固定', action: () => { store.updateNote(noteId, { isPinned: !note.meta.isPinned }); store.showToast('info', note.meta.isPinned ? '已取消固定' : '已固定'); }},
    { label: note.meta.isFavorite ? '⭐ 取消收藏' : '⭐ 收藏', action: () => { store.updateNote(noteId, { isFavorite: !note.meta.isFavorite }); store.showToast('success', note.meta.isFavorite ? '⭐ 已收藏' : '已取消收藏'); }},
    null as any,
    { label: '⬇ 导出 Markdown', action: () => { store.showToast('info', '导出功能即将开放'); }},
    { label: '🗑 删除', action: () => { store.deleteNote(noteId); store.showToast('success', '🗑 已删除'); }, danger: true },
  ];

  return (
    <>
      <div className="context-overlay" onClick={() => store.setContextMenu({ visible: false, x: 0, y: 0, noteId: null })} />
      <div className="context-menu show" style={{ left: x, top: y }}>
        {actions.map((a, i) =>
          a === null ? <div key={i} className="sep" /> : (
            <div
              key={i}
              className={`item${a.danger ? ' danger' : ''}`}
              onClick={() => { a.action(); store.setContextMenu({ visible: false, x: 0, y: 0, noteId: null }); }}
            >
              {a.label}
            </div>
          )
        )}
      </div>
    </>
  );
}
