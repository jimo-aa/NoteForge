import { useEffect, useState } from 'react';
import { useStore } from '@/stores/context';

import { Sidebar } from '@/components/Sidebar/Sidebar';
import { NoteList } from '@/components/Sidebar/NoteList';
import { Editor } from '@/components/Editor/Editor';
import { NewNoteModal } from '@/components/Modals/NewNoteModal';
import { NotebookModal } from '@/components/Modals/NotebookModal';
import { ContextMenu } from '@/components/Common/ContextMenu';
import { Toast } from '@/components/Common/Toast';
import { GraphView } from '@/components/Common/GraphView';
import { EntityModal } from '@/components/Modals/EntityModal';
import { AdvancedVersioningPanel } from '@/components/Features/AdvancedVersioningPanel';
import type { NotebookModalState } from '@/components/Modals/NotebookModal';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export default function App() {
  const store = useStore();
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [advancedVersioningOpen, setAdvancedVersioningOpen] = useState(false);
  const [notebookModal, setNotebookModal] = useState<NotebookModalState>({
    open: false,
    mode: null,
    title: '',
    value: '',
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setNewNoteOpen(true); }
      if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); store.setSettingsOpen(false); }
      // Ctrl+Shift+V 打开高级版本控制
      if (e.key.toLowerCase() === 'v' && (e.metaKey || e.ctrlKey) && e.shiftKey) { 
        e.preventDefault(); 
        setAdvancedVersioningOpen(true); 
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (!eventApi.listen) return;
        unlisten = await eventApi.listen<{ noteId: string; line: number }>('noteforge:open-search-hit', async (event) => {
          const payload = event.payload;
          if (payload?.noteId) {
            store.selectNote(payload.noteId);
            const note = await invoke<{ meta: { id: string }; content: string }>('get_note', { id: payload.noteId });
            if (note) store.showToast('success', `已跳转到第 ${payload.line} 行`);
          }
        });
      } catch {
        // ignore event API errors in environments without permissions
      }
    })();
    return () => { void unlisten?.(); };
  }, [store]);

  const handleOpenNotebookModal = () => {
    setNotebookModal({
      open: true,
      mode: 'create',
      title: '新建笔记本',
      value: '',
    });
  };

  const handleConfirmNotebook = async (name: string, icon?: string, color?: string) => {
    if (notebookModal.mode === 'create') {
      const result = await store.createNotebook(name, icon, color);
      if (result) {
        setNotebookModal({ open: false, mode: null, title: '', value: '' });
      }
    } else if (notebookModal.mode === 'rename' && notebookModal.notebookId) {
      const result = await store.renameNotebook(notebookModal.notebookId, name);
      if (result) {
        setNotebookModal({ open: false, mode: null, title: '', value: '' });
      }
    }
  };

  return (
    <div className="app-shell">
      <Sidebar onNewNote={() => setNewNoteOpen(true)} onNewNotebook={handleOpenNotebookModal} />
      <main className="main-panel"><div className="main-surface"><div className="content-layout"><section className="note-list-column"><NoteList /></section><section className="preview-column"><Editor /></section></div></div></main>
      <NewNoteModal open={newNoteOpen} notebooks={store.notebooks} onClose={() => setNewNoteOpen(false)} onCreate={async ({ title, content, notebookId, tags }) => { const result = await store.createNote(title, content, notebookId, tags); if (result) { store.showToast('success', '✓ 已创建笔记'); setNewNoteOpen(false); } else { store.showToast('error', '创建笔记失败，请重试'); } }} />
      <NotebookModal state={notebookModal} onClose={() => setNotebookModal({ open: false, mode: null, title: '', value: '' })} onConfirm={handleConfirmNotebook} />
      <EntityModal state={store.entityModal} onClose={store.closeEntityModal} onConfirm={async (value) => {
        if (!value) {
          store.showToast('error', '输入内容不能为空');
          return;
        }
        const targetId = store.entityModal.targetId;
        if (store.entityModal.mode === 'create-notebook') {
          const result = await store.createNotebook(value);
          if (!result) {
            store.showToast('error', '创建笔记本失败，请检查后端服务');
          }
        } else if (store.entityModal.mode === 'rename-notebook' && targetId) {
          const result = await store.renameNotebook(targetId, value);
          if (!result) {
            store.showToast('error', '重命名笔记本失败');
          }
        } else if (store.entityModal.mode === 'rename-note' && targetId) {
          store.updateNote(targetId, { title: value });
          store.showToast('success', '✏️ 已重命名笔记');
        }
        store.closeEntityModal();
      }} />
      {advancedVersioningOpen && store.currentNoteId && (
        <AdvancedVersioningPanel 
          noteId={store.currentNoteId} 
          onClose={() => setAdvancedVersioningOpen(false)}
        />
      )}
      <ContextMenu />
      <GraphView />
      {store.toasts.map((t) => (<Toast key={t.id} message={t.message} />))}
    </div>
  );
}
