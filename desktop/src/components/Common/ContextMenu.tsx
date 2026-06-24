import { useStore } from '@/stores/context';

export function ContextMenu() {
  const store = useStore();
  const { visible, x, y, noteId, notebookId, kind } = store.contextMenu;

  if (!visible || !kind) return null;

  const close = () => store.setContextMenu({ visible: false, x: 0, y: 0, noteId: null, notebookId: null, kind: null });

  if (kind === 'note' && noteId) {
    const note = store.notes.find((n) => n.meta.id === noteId);
    if (!note) return null;
    const actions = [
      { label: '✏️ 重命名', action: () => store.openEntityModal({ open: true, mode: 'rename-note', title: '重命名文档', label: '文档标题', value: note.meta.title, confirmText: '保存' }) },
      { label: '📋 复制文档', action: () => { store.duplicateNote(noteId); store.showToast('success', '📋 已复制'); } },
      { label: note.meta.isPinned ? '📌 取消固定' : '📌 固定', action: () => { store.updateNote(noteId, { isPinned: !note.meta.isPinned }); store.showToast('info', note.meta.isPinned ? '已取消固定' : '已固定'); } },
      { label: note.meta.isFavorite ? '⭐ 取消收藏' : '⭐ 收藏', action: () => { store.updateNote(noteId, { isFavorite: !note.meta.isFavorite }); store.showToast('success', note.meta.isFavorite ? '⭐ 已收藏' : '已取消收藏'); } },
      null as any,
      { label: '🗑 删除文档', action: () => { if (confirm('确定删除这篇文档吗？')) { store.deleteNote(noteId); store.showToast('success', '🗑 已删除'); } }, danger: true },
    ];
    return <Menu x={x} y={y} actions={actions} onClose={close} />;
  }

  if (kind === 'notebook' && notebookId) {
    const notebook = store.notebooks.find((n) => n.id === notebookId);
    if (!notebook) return null;
    const actions = [
      { label: '➕ 新建文档', action: () => { store.setCurrentNoteId(''); store.setContextMenu({ visible: false, x: 0, y: 0, noteId: null, notebookId: null, kind: null }); } },
      { label: '✏️ 修改名称', action: () => store.openEntityModal({ open: true, mode: 'rename-notebook', title: '重命名笔记本', label: '笔记本名称', value: notebook.name, confirmText: '保存' }) },
      null as any,
      { label: '🗑 删除笔记本', action: () => { if (confirm(`删除「${notebook.name}」？笔记会移回默认笔记本。`)) store.deleteNotebook(notebookId); }, danger: true },
    ];
    return <Menu x={x} y={y} actions={actions} onClose={close} />;
  }

  return null;
}

function Menu({ x, y, actions, onClose }: { x: number; y: number; actions: Array<{ label: string; action: () => void | Promise<void>; danger?: boolean } | null>; onClose: () => void; }) {
  return <><div className="context-overlay" onClick={onClose} /><div className="context-menu show" style={{ left: x, top: y }}>{actions.map((a, i) => a === null ? <div key={i} className="sep" /> : <div key={i} className={`item${a.danger ? ' danger' : ''}`} onClick={async () => { await a.action(); onClose(); }}>{a.label}</div>)}</div></>;
}
