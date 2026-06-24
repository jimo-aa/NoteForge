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

export default function App() {
  const store = useStore();
  const [newNoteOpen, setNewNoteOpen] = useState(false);

  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setNewNoteOpen(true); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);

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
