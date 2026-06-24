import { useEffect, useState } from 'react';
import { useStore } from '@/stores/context';

import { Sidebar } from '@/components/Sidebar/Sidebar';
import { NoteList } from '@/components/Sidebar/NoteList';
import { Editor } from '@/components/Editor/Editor';
import { NewNoteModal } from '@/components/Modals/NewNoteModal';
import { ContextMenu } from '@/components/Common/ContextMenu';
import { Toast } from '@/components/Common/Toast';
import { GraphView } from '@/components/Common/GraphView';
import { EntityModal } from '@/components/Modals/EntityModal';

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setNewNoteOpen(true); }
      if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); store.setSettingsOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store]);

  useEffect(() => {
    const sync = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{ noteId: string; line: number }>('noteforge:open-search-hit', async (event) => {
        const payload = event.payload;
        if (payload?.noteId) {
          store.selectNote(payload.noteId);
          const note = await invoke<{ meta: { id: string }; content: string }>('get_note', { id: payload.noteId });
          if (note) store.showToast('success', `已跳转到第 ${payload.line} 行`);
        }
      });
      return unlisten;
    };
    void sync();
  }, [store]);

  return (
    <div className="app-shell">
      <Sidebar onNewNote={() => setNewNoteOpen(true)} />
      <main className="main-panel"><div className="main-surface"><div className="content-layout"><section className="note-list-column"><NoteList /></section><section className="preview-column"><Editor /></section></div></div></main>
      <NewNoteModal open={newNoteOpen} notebooks={store.notebooks} onClose={() => setNewNoteOpen(false)} onCreate={({ title, content, notebookId, tags }) => { store.createNote(title, content, notebookId, tags); setNewNoteOpen(false); }} />
      <EntityModal state={store.entityModal} onClose={store.closeEntityModal} onConfirm={async (value) => {
        if (!value) return;
        const targetId = store.entityModal.targetId;
        if (store.entityModal.mode === 'create-notebook') await store.createNotebook(value);
        if (store.entityModal.mode === 'rename-notebook' && targetId) await store.renameNotebook(targetId, value);
        if (store.entityModal.mode === 'rename-note' && targetId) store.updateNote(targetId, { title: value });
        store.closeEntityModal();
      }} />
      <ContextMenu />
      <GraphView />
      {store.toasts.map((t) => (<Toast key={t.id} message={t.message} />))}
    </div>
  );
}
