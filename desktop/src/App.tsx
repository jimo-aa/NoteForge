import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/stores/context';
import { tauriInvoke } from '@/utils/invoke';

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
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { ManageModal } from '@/components/Modals/ManageModal';
import { DraftRecoveryModal } from '@/components/Modals/DraftRecoveryModal';
import type { NotebookModalState } from '@/components/Modals/NotebookModal';

export default function App() {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [draftRecoveryOpen, setDraftRecoveryOpen] = useState(false);
  const [advancedVersioningOpen, setAdvancedVersioningOpen] = useState(false);
  const [notebookModal, setNotebookModal] = useState<NotebookModalState>({
    open: false,
    mode: null,
    title: '',
    value: '',
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = storeRef.current;
      if (e.key.toLowerCase() === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setNewNoteOpen(true); return; }
      if (e.key.toLowerCase() === 'p' && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); setAdvancedVersioningOpen(true); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); s.setIsPreviewVisible(!s.isPreviewVisible); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); if (s.currentNote) s.togglePin(s.currentNote.meta.id); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); if (s.currentNote) s.deleteNote(s.currentNote.meta.id); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); s.setIsGraphOpen(!s.isGraphOpen); return; }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); if (s.currentNote) s.toggleFavorite(s.currentNote.meta.id); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (s.currentNote) { s.saveDraft(s.currentNote.meta.id, s.currentNote.content); s.showToast('success', '已手动保存'); } return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const draftRecoveryShownRef = useRef(false);
  useEffect(() => {
    if (!draftRecoveryShownRef.current && !store.isLoading && store.recoveryDrafts && store.recoveryDrafts.length > 0) {
      draftRecoveryShownRef.current = true;
      setDraftRecoveryOpen(true);
    }
  }, [store.isLoading, store.recoveryDrafts]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (!eventApi.listen) return;
        unlisten = await eventApi.listen<{ noteId: string; line: number }>('noteforge:open-search-hit', async (event) => {
          const payload = event.payload;
          if (payload?.noteId) {
            storeRef.current.selectNote(payload.noteId);
            const note = await tauriInvoke<{ meta: { id: string }; content: string }>('get_note', { id: payload.noteId });
            if (note) storeRef.current.showToast('success', `已跳转到第 ${payload.line} 行`);
          }
        });
      } catch {
        // ignore event API errors in environments without permissions
      }
    })();
    return () => { void unlisten?.(); };
  }, []);

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
    <ErrorBoundary>
      <div className="app-shell">
        <Sidebar onNewNote={() => setNewNoteOpen(true)} onNewNotebook={handleOpenNotebookModal} onManage={() => setManageOpen(true)} onDraftRecovery={() => setDraftRecoveryOpen(true)} />
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
        <ManageModal open={manageOpen} onClose={() => setManageOpen(false)} />
        <DraftRecoveryModal open={draftRecoveryOpen} onClose={() => setDraftRecoveryOpen(false)} />
        {store.toasts.map((t) => (<Toast key={t.id} message={t.message} />))}
      </div>
    </ErrorBoundary>
  );
}
