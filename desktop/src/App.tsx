import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/stores/context';
import { tauriInvoke } from '@/utils/invoke';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

import { Sidebar } from '@/components/Sidebar/Sidebar';
import { NoteList } from '@/components/Sidebar/NoteList';
import { Editor } from '@/components/Editor/Editor';
import { NewNoteModal } from '@/components/Modals/NewNoteModal';
import { NotebookModal } from '@/components/Modals/NotebookModal';
import { ContextMenu } from '@/components/Common/ContextMenu';
import { Toast } from '@/components/Common/Toast';
import { EntityModal } from '@/components/Modals/EntityModal';
import { VersionHistoryDialog } from '@/components/Modals/VersionHistoryDialog';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { ManageModal } from '@/components/Modals/ManageModal';
import { DraftRecoveryModal } from '@/components/Modals/DraftRecoveryModal';
import { EncryptionModal } from '@/components/Modals/EncryptionModal';
import { AboutModal } from '@/components/Modals/AboutModal';
import { WelcomeGuide } from '@/components/Modals/WelcomeGuide';
import type { NotebookModalState } from '@/components/Modals/NotebookModal';

const LazyGraphView = lazy(() => import('@/components/Common/GraphView').then(m => ({ default: m.GraphView })));

export default function App() {
  const store = useStore();
  const { t } = useTranslation();
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; });
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

  // Centralized keyboard shortcuts via configurable system
  useKeyboardShortcuts({
    'new-note': () => setNewNoteOpen(true),
    'new-notebook': () => setNotebookModal({ open: true, mode: 'create' as const, title: t('notebook.create'), value: '' }),
    'search': () => window.dispatchEvent(new CustomEvent('noteforge:open-search')),
    'search-advanced': () => setAdvancedVersioningOpen(true),
    'settings': () => setManageOpen(true),
    'toggle-preview': () => store.setIsPreviewVisible(!store.isPreviewVisible),
    'toggle-pin': () => { if (store.currentNote) store.togglePin(store.currentNote.meta.id); },
    'delete-note': () => { if (store.currentNote) store.deleteNote(store.currentNote.meta.id); },
    'duplicate-note': () => { if (store.currentNote) store.duplicateNote(store.currentNote.meta.id); },
    'toggle-graph': () => store.setIsGraphOpen(!store.isGraphOpen),
    'toggle-favorite': () => { if (store.currentNote) store.toggleFavorite(store.currentNote.meta.id); },
    'toggle-properties': () => store.setIsPropertiesOpen(!store.isPropertiesOpen),
    'save-draft': () => { if (store.currentNote) { store.saveDraft(store.currentNote.meta.id, store.currentNote.content); store.showToast('success', t('note.savedManually')); } },
    'toggle-sidebar': () => { /* sidebar always visible in current layout */ },
  });

  // Global error handlers with persistent crash logging
  useEffect(() => {
    const persistCrash = (data: Record<string, unknown>) => {
      try {
        void import('@/utils/invoke').then(({ tauriInvoke }) => {
          void tauriInvoke<string>('write_crash_log', { crashData: JSON.stringify(data) });
        });
      } catch { /* best-effort */ }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[Global] Unhandled Promise Rejection:', event.reason);
      try {
        const crashData = {
          crashedAt: Date.now(),
          error: event.reason?.message || String(event.reason),
          stack: event.reason?.stack || '',
          type: 'unhandledRejection',
        };
        window.localStorage.setItem('noteforge:crash:last', JSON.stringify(crashData));
        persistCrash(crashData);
        // Try to show a toast through the store if available
        const s = storeRef.current;
        if (s && s.showToast) {
          s.showToast('error', t('note.errorWithMsg', { error: crashData.error.slice(0, 60) }));
        }
      } catch { /* ignore storage errors */ }
      event.preventDefault();
    };

    const handleGlobalError = (event: ErrorEvent) => {
      console.error('[Global] Uncaught Error:', event.error || event.message);
      try {
        const crashData = {
          crashedAt: Date.now(),
          error: event.message,
          stack: event.error?.stack || '',
          type: 'globalError',
        };
        window.localStorage.setItem('noteforge:crash:last', JSON.stringify(crashData));
        persistCrash(crashData);
      } catch { /* ignore */ }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection as EventListener);
    window.addEventListener('error', handleGlobalError as EventListener);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection as EventListener);
      window.removeEventListener('error', handleGlobalError as EventListener);
    };
  }, [t]);

  const [encryptionLockOpen, setEncryptionLockOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const encryptionCheckRef = useRef(false);

  // 启动时检测是否需要输入加密密码解锁
  useEffect(() => {
    if (encryptionCheckRef.current || !store.currentNote) return;
    // 只在首次加载且未检查过时执行
    if (store.isLoading) return;
    encryptionCheckRef.current = true;
    void (async () => {
      try {
        const hasEncryption = await tauriInvoke<boolean>('has_stored_encryption');
        const isEnabled = await tauriInvoke<boolean>('is_encryption_enabled');
        if (hasEncryption && !isEnabled) {
          setEncryptionLockOpen(true);
        }
      } catch {
        // 忽略错误
      }
    })();
  }, [store.isLoading, store.currentNote]);

  // Listen for version history open event from Editor toolbar button
  useEffect(() => {
    const handler = () => setAdvancedVersioningOpen(true);
    window.addEventListener('noteforge:open-version-history', handler);
    return () => window.removeEventListener('noteforge:open-version-history', handler);
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
            if (note) storeRef.current.showToast('success', t('note.jumpToLine', { line: payload.line }));
          }
        });
      } catch {
        // ignore event API errors in environments without permissions
      }
    })();
    return () => { void unlisten?.();     };
  }, [t]);

  const handleOpenNotebookModal = () => {
    setNotebookModal({
      open: true,
      mode: 'create',
      title: t('notebook.create'),
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
        <Sidebar onNewNote={() => setNewNoteOpen(true)} onNewNotebook={handleOpenNotebookModal} onManage={() => setManageOpen(true)} onDraftRecovery={() => setDraftRecoveryOpen(true)} onAbout={() => setAboutOpen(true)} />
        <main className="main-panel"><div className="main-surface"><div className="content-layout"><section className="note-list-column"><NoteList /></section><section className="preview-column"><Editor /></section></div></div></main>
        <NewNoteModal open={newNoteOpen} notebooks={store.notebooks} onClose={() => setNewNoteOpen(false)} onCreate={async ({ title, content, notebookId, tags, storageRoot }) => {
          // Check if primary storage root is set; if not, prompt user to select one
          const primaryRoot = await tauriInvoke<string | null>('get_primary_root');
          if (!primaryRoot && !storageRoot) {
            try {
              const { open } = await import('@tauri-apps/plugin-dialog');
              const selected = await open({ directory: true, multiple: false, title: t('manage.storageSelectDir') });
              if (selected) {
                const dirPath = typeof selected === 'string' ? selected : selected[0];
                await tauriInvoke('set_primary_root', { path: dirPath });
                store.showToast('success', t('manage.storageRootChanged'));
              } else {
                store.showToast('info', t('note.createFailed'));
                return;
              }
            } catch {
              // Directory picker not available (e.g., browser mode) — continue with default storage
            }
          }
          // If user selected a specific storage root, set it as primary before creating
          if (storageRoot && storageRoot !== primaryRoot) {
            await tauriInvoke('set_primary_root', { path: storageRoot }).catch(() => {});
          }
          const result = await store.createNote(title, content, notebookId, tags);
          if (result) { store.showToast('success', t('note.created')); setNewNoteOpen(false); }
          else { store.showToast('error', t('note.createFailed')); }
        }} />
        <NotebookModal state={notebookModal} onClose={() => setNotebookModal({ open: false, mode: null, title: '', value: '' })} onConfirm={handleConfirmNotebook} />
        <EntityModal state={store.entityModal} onClose={store.closeEntityModal} onConfirm={async (value) => {
          if (!value) {
            store.showToast('error', t('note.inputRequired'));
            return;
          }
          const targetId = store.entityModal.targetId;
          if (store.entityModal.mode === 'create-notebook') {
            const result = await store.createNotebook(value);
            if (!result) {
              store.showToast('error', t('note.createNotebookFailed'));
            }
          } else if (store.entityModal.mode === 'rename-notebook' && targetId) {
            const result = await store.renameNotebook(targetId, value);
            if (!result) {
              store.showToast('error', t('note.renameNotebookFailed'));
            }
          } else if (store.entityModal.mode === 'rename-note' && targetId) {
            store.updateNote(targetId, { title: value });
            store.showToast('success', t('note.renameSuccess'));
          }
          store.closeEntityModal();
        }} />
        <VersionHistoryDialog 
          open={advancedVersioningOpen} 
          noteId={store.currentNoteId || ''} 
          onClose={() => setAdvancedVersioningOpen(false)}
          onRestore={() => store.showToast('success', t('version.restored'))}
        />
        <ContextMenu />
        <Suspense fallback={null}><LazyGraphView /></Suspense>
        <ManageModal open={manageOpen} onClose={() => setManageOpen(false)} />
        <DraftRecoveryModal open={draftRecoveryOpen} onClose={() => setDraftRecoveryOpen(false)} />
        <EncryptionModal open={encryptionLockOpen} onClose={() => setEncryptionLockOpen(false)} />
        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
        <WelcomeGuide open={store.showWelcomeGuide} onClose={() => store.setShowWelcomeGuide(false)} />
        {store.toasts.map((t) => (<Toast key={t.id} message={t.message} />))}
      </div>
    </ErrorBoundary>
  );
}
