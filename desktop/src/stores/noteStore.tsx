// NoteForge — 全局状态管理

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { Note, NoteFilter, ToastMessage, ContextMenuState, SortOption, Notebook } from '@/types';
import type { EntityModalState } from '@/components/Modals/EntityModal';
import { countWords } from '@/utils/markdown';

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

const ALL_NOTEBOOK = { id: 'all', name: '全部笔记', icon: '📋', noteCount: 0 };
const STORAGE_PREFIX = 'noteforge';
const draftKey = (id: string) => `${STORAGE_PREFIX}:draft:${id}`;
const cursorKey = (id: string) => `${STORAGE_PREFIX}:cursor:${id}`;
const autosaveKey = (id: string) => `${STORAGE_PREFIX}:autosave:${id}`;

type NoteVersion = { id: string; content: string; title: string; updatedAt: number; summary?: string; source?: 'git' | 'local' };

const safeRead = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const safeWrite = (key: string, value: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

export function useNoteStore() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([ALL_NOTEBOOK]);
  const [currentNoteId, setCurrentNoteId] = useState<string>('');
  const [currentFilter, setCurrentFilter] = useState<NoteFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNotebook, setActiveNotebook] = useState('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, noteId: null, notebookId: null, kind: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entityModal, setEntityModal] = useState<EntityModalState>({ open: false, mode: null, title: '', label: '', value: '', confirmText: '确定', targetId: null });
  const toastIdRef = useRef(0);
  const autosaveTimerRef = useRef<Record<string, number | null>>({});

  const refreshNotebooks = useCallback(async () => {
    const backendNotebooks = await tauriInvoke<Notebook[]>('list_notebooks');
    if (backendNotebooks) setNotebooks([ALL_NOTEBOOK, ...backendNotebooks]);
  }, []);

  const refreshNotes = useCallback(async () => {
    const backendNotes = await tauriInvoke<Note[]>('list_notes');
    if (backendNotes) {
      setNotes(backendNotes);
      setCurrentNoteId((prev) => prev || backendNotes[0]?.meta.id || '');
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.all([refreshNotes(), refreshNotebooks()]); setIsLoading(false); })(); }, [refreshNotes, refreshNotebooks]);
  useEffect(() => { void tauriInvoke('set_last_note', { id: currentNoteId }); }, [currentNoteId]);
  useEffect(() => { void refreshNotebooks(); }, [notes, refreshNotebooks]);

  useEffect(() => {
    return () => {
      Object.values(autosaveTimerRef.current).forEach((timer) => {
        if (timer) window.clearTimeout(timer);
      });
    };
  }, []);

  const sortNotes = useCallback((notesToSort: Note[]) => {
    const copy = [...notesToSort];
    switch (sortBy) {
      case 'updated': copy.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt); break;
      case 'created': copy.sort((a, b) => b.meta.createdAt - a.meta.createdAt); break;
      case 'title': copy.sort((a, b) => a.meta.title.localeCompare(b.meta.title)); break;
      case 'words': copy.sort((a, b) => b.meta.wordCount - a.meta.wordCount); break;
    }
    return copy;
  }, [sortBy]);

  const filteredNotes = sortNotes(notes.filter((n) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inTitle = n.meta.title.toLowerCase().includes(q);
      const inTags = n.meta.tags.some((t) => t.toLowerCase().includes(q));
      const inContent = n.content.toLowerCase().includes(q);
      if (!inTitle && !inTags && !inContent) return false;
    }
    if (activeNotebook !== 'all' && n.meta.notebookId !== activeNotebook) return false;
    if (currentFilter === 'favorites' && !n.meta.isFavorite) return false;
    if (currentFilter === 'pinned' && !n.meta.isPinned) return false;
    if (activeTags.length > 0 && !activeTags.every((tag) => n.meta.tags.includes(tag))) return false;
    return true;
  }));

  const currentNote = notes.find((n) => n.meta.id === currentNoteId) || null;
  const selectNote = useCallback((id: string) => setCurrentNoteId(id), []);

  const createNote = useCallback(async (title: string, content: string, notebookId: string, tags: string[]) => {
    const note = await tauriInvoke<Note>('create_note', { request: { title, content, notebookId, tags } });
    if (note) {
      setNotes((prev) => [note, ...prev.filter((item) => item.meta.id !== note.meta.id)]);
      setCurrentNoteId(note.meta.id);
      safeWrite(draftKey(note.meta.id), content);
      safeWrite(autosaveKey(note.meta.id), { content, title, updatedAt: Date.now() });
      return note;
    }
    return null;
  }, []);

  const scheduleAutosave = useCallback((id: string, title: string, content: string) => {
    if (autosaveTimerRef.current[id]) window.clearTimeout(autosaveTimerRef.current[id]!);
    autosaveTimerRef.current[id] = window.setTimeout(() => {
      safeWrite(autosaveKey(id), { content, title, updatedAt: Date.now() });
      autosaveTimerRef.current[id] = null;
    }, 5000);
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note['meta'] & { content: string }>) => {
    setNotes((prev) => prev.map((n) => {
      if (n.meta.id !== id) return n;
      const nextContent = updates.content ?? n.content;
      const next = {
        meta: { ...n.meta, ...updates, updatedAt: Date.now(), version: n.meta.version + (updates.content !== undefined ? 1 : 0), wordCount: countWords(nextContent) },
        content: nextContent,
      };
      if (updates.content !== undefined) {
        safeWrite(draftKey(id), nextContent);
        scheduleAutosave(id, updates.title ?? n.meta.title, nextContent);
      }
      return next;
    }));
    if (updates.title !== undefined || updates.content !== undefined || updates.tags !== undefined || updates.isPinned !== undefined || updates.isFavorite !== undefined) {
      void tauriInvoke('update_note', { id, title: updates.title ?? null, content: updates.content ?? null, tags: updates.tags ?? null, isPinned: updates.isPinned ?? null, isFavorite: updates.isFavorite ?? null });
    }
  }, [scheduleAutosave]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  const deleteNote = useCallback((id: string) => { setNotes((prev) => prev.filter((n) => n.meta.id !== id)); setCurrentNoteId((prev) => (prev === id ? '' : prev)); void tauriInvoke('delete_note', { id }); }, []);
  const duplicateNote = useCallback((id: string) => { const note = notes.find((n) => n.meta.id === id); if (!note) return; void createNote(`${note.meta.title} (副本)`, note.content, note.meta.notebookId || 'default', note.meta.tags); showToast('success', '📋 已复制'); }, [createNote, notes, showToast]);
  const toggleFavorite = useCallback((id: string) => { const note = notes.find((n) => n.meta.id === id); if (!note) return; updateNote(id, { isFavorite: !note.meta.isFavorite }); }, [notes, updateNote]);
  const togglePin = useCallback((id: string) => { const note = notes.find((n) => n.meta.id === id); if (!note) return; updateNote(id, { isPinned: !note.meta.isPinned }); }, [notes, updateNote]);

  const createNotebook = useCallback(async (name: string) => {
    const title = name.trim();
    if (!title) {
      showToast('error', '笔记本名称不能为空');
      return null;
    }

    const notebook = await tauriInvoke<Notebook>('create_notebook', { name: title });
    if (notebook) {
      await refreshNotebooks();
      showToast('success', '📒 已创建笔记本');
      return notebook;
    }
    showToast('error', '创建笔记本失败，请重试');
    return null;
  }, [refreshNotebooks, showToast]);
  const renameNotebook = useCallback(async (id: string, name: string) => { const notebook = await tauriInvoke<Notebook>('rename_notebook', { id, name }); if (notebook) { await refreshNotebooks(); showToast('success', '✏️ 已重命名'); } return notebook; }, [refreshNotebooks, showToast]);
  const deleteNotebook = useCallback(async (id: string) => { const ok = await tauriInvoke<boolean>('delete_notebook', { id }); if (ok !== false) { await refreshNotes(); await refreshNotebooks(); if (activeNotebook === id) setActiveNotebook('all'); showToast('success', '🗑 已删除笔记本'); return true; } return false; }, [activeNotebook, refreshNotes, refreshNotebooks, showToast]);
  const openEntityModal = useCallback((next: EntityModalState) => setEntityModal(next), []);
  const closeEntityModal = useCallback(() => setEntityModal({ open: false, mode: null, title: '', label: '', value: '', confirmText: '确定', targetId: null }), []);

  const saveDraft = useCallback((id: string, content: string) => { safeWrite(draftKey(id), content); }, []);
  const loadDraft = useCallback((id: string) => safeRead<string>(draftKey(id), ''), []);
  const clearDraft = useCallback((id: string) => { try { window.localStorage.removeItem(draftKey(id)); window.localStorage.removeItem(autosaveKey(id)); } catch {} }, []);
  const loadVersions = useCallback(async (id: string) => {
    const backend = await tauriInvoke<Array<{ id: string; title: string; updatedAt: number; summary?: string }>>('list_note_versions', { noteId: id });
    return backend || [];
  }, []);
  const restoreVersion = useCallback(async (id: string, versionId: string) => {
    const content = await tauriInvoke<string>('checkout_note_version', { noteId: id, commitId: versionId });
    if (!content) return false;
    updateNote(id, { content });
    saveDraft(id, content);
    showToast('success', '已恢复历史版本');
    return true;
  }, [saveDraft, showToast, updateNote]);
  const checkoutBranch = useCallback(async (id: string, branch: string) => {
    const content = await tauriInvoke<string>('checkout_note_branch', { noteId: id, branch });
    if (!content) return false;
    updateNote(id, { content });
    saveDraft(id, content);
    showToast('success', `已切换到分支: ${branch}`);
    return true;
  }, [saveDraft, showToast, updateNote]);
  const createBranch = useCallback(async (id: string, branch: string, fromCommit?: string) => {
    const ok = await tauriInvoke<void>('create_note_branch', { noteId: id, branch, fromCommit });
    if (ok === undefined) {
      showToast('success', `已创建分支: ${branch}`);
      return true;
    }
    return false;
  }, [showToast]);
  const saveCursor = useCallback((id: string, range: { start: number; end: number }) => safeWrite(cursorKey(id), range), []);
  const loadCursor = useCallback((id: string) => safeRead<{ start: number; end: number } | null>(cursorKey(id), null), []);
  const loadRecovery = useCallback((_id: string) => null, []);

  const tags = Array.from(new Set(notes.flatMap((n) => n.meta.tags)));
  const totalCount = notes.length;
  const favoriteCount = notes.filter((n) => n.meta.isFavorite).length;
  const searchResultCount = searchQuery ? filteredNotes.length : null;

  return { notes, filteredNotes, currentNote, currentNoteId, notebooks, activeNotebook, currentFilter, searchQuery, sortBy, activeTags, isPreviewVisible, isGraphOpen, isPropertiesOpen, toasts, contextMenu, settingsOpen, isLoading, entityModal, totalCount, favoriteCount, searchResultCount, tags, setActiveNotebook, setCurrentFilter, setSearchQuery, setSortBy, setActiveTags, setIsPreviewVisible, setIsGraphOpen, setIsPropertiesOpen, setContextMenu, setSettingsOpen, openEntityModal, closeEntityModal, selectNote, createNote, updateNote, deleteNote, duplicateNote, toggleFavorite, togglePin, createNotebook, renameNotebook, deleteNotebook, refreshNotes, refreshNotebooks, showToast, setCurrentNoteId, saveDraft, loadDraft, clearDraft, loadVersions, restoreVersion, checkoutBranch, createBranch, saveCursor, loadCursor, loadRecovery };
}

export const NoteContext = createContext<NoteStore | null>(null);
export function NoteProvider({ children }: { children: ReactNode }) { return <NoteContext.Provider value={useNoteStore()}>{children}</NoteContext.Provider>; }
export function useStore(): NoteStore { const store = useContext(NoteContext); if (!store) throw new Error('useStore must be used within NoteProvider'); return store; }
export type NoteStore = ReturnType<typeof useNoteStore>;
