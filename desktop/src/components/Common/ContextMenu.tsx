import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/stores/context';
import { Icon } from '@/components/Common/Icon';

type MenuAction = { label: string | React.ReactNode; action: () => void | Promise<void>; danger?: boolean } | null;

export function ContextMenu() {
  const store = useStore();
  const { visible, x, y, noteId, notebookId, kind } = store.contextMenu;

  const close = () => store.setContextMenu({ visible: false, x: 0, y: 0, noteId: null, notebookId: null, kind: null });
  const run = (fn: () => void | Promise<void>) => { void Promise.resolve(fn()).finally(() => close()); };

  const actions = useMemo<MenuAction[]>(() => {
    if (!visible || !kind) return [];

    if (kind === 'note' && noteId) {
      const note = store.notes.find((n) => n.meta.id === noteId);
      if (!note) return [];
      return [
        { label: <><Icon type="rename" /> 重命名</>, action: () => run(() => store.openEntityModal({ open: true, mode: 'rename-note', title: '重命名文档', label: '文档标题', value: note.meta.title, confirmText: '保存', targetId: noteId })) },
        { label: note.meta.isPinned ? <><Icon type="gudin" /> 取消固定</> : <><Icon type="gudin" /> 固定</>, action: () => run(() => { store.updateNote(noteId, { isPinned: !note.meta.isPinned }); store.showToast('info', note.meta.isPinned ? '已取消固定' : '已固定'); }) },
        { label: note.meta.isFavorite ? <><Icon type="shoucang" /> 取消收藏</> : <><Icon type="shoucang" /> 收藏</>, action: () => run(() => { store.updateNote(noteId, { isFavorite: !note.meta.isFavorite }); store.showToast('success', note.meta.isFavorite ? '已取消收藏' : '已收藏'); }) },
        null,
        { label: <><Icon type="delete" /> 删除文档</>, action: () => run(() => store.deleteNote(noteId)), danger: true },
      ];
    }

    if (kind === 'notebook' && notebookId) {
      const notebook = store.notebooks.find((n) => n.id === notebookId);
      if (!notebook) return [];
      return [
        { label: <><Icon type="rename" /> 重命名</>, action: () => run(() => store.openEntityModal({ open: true, mode: 'rename-notebook', title: '重命名笔记本', label: '笔记本名称', value: notebook.name, confirmText: '保存', targetId: notebookId })) },
        null,
        { label: <><Icon type="delete" /> 删除笔记本</>, action: () => run(() => void store.deleteNotebook(notebookId)), danger: true },
      ];
    }

    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, noteId, notebookId, store, visible]);

  if (!visible || !kind || actions.length === 0) return null;
  return <Menu x={x} y={y} actions={actions} onClose={close} />;
}

function Menu({ x, y, actions, onClose }: { x: number; y: number; actions: MenuAction[]; onClose: () => void; }) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const padding = 12;
    const rect = menu.getBoundingClientRect();
    const nextLeft = Math.min(x, Math.max(padding, window.innerWidth - rect.width - padding));
    const nextTop = Math.min(y, Math.max(padding, window.innerHeight - rect.height - padding));
    setPosition({ left: nextLeft, top: nextTop });
  }, [x, y, actions.length]);

  return <><div className="context-overlay" onPointerDown={onClose} /><div ref={menuRef} className="context-menu show" style={{ left: position.left, top: position.top }}>{actions.map((a, i) => a === null ? <div key={i} className="sep" /> : <button key={i} type="button" className={`item${a.danger ? ' danger' : ''}`} onClick={() => { void a.action(); }}>{a.label}</button>)}</div></>;
}
