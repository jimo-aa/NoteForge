// NoteForge — 全局状态管理

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { Note, NoteFilter, ToastMessage, ContextMenuState, SortOption, Notebook } from '@/types';
import type { EntityModalState } from '@/components/Modals/EntityModal';
import { generateId, countWords } from '@/utils/markdown';

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

const ALL_NOTEBOOK = { id: 'all', name: '全部笔记', icon: '📋', noteCount: 0 };

export function useNoteStore() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([ALL_NOTEBOOK]);
  const [currentNoteId, setCurrentNoteId] = useState<string>('');
  const [currentFilter, setCurrentFilter] = useState<NoteFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNotebook, setActiveNotebook] = useState('all');
  const [activeTag, setActiveTag] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const persistedRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, noteId: null, notebookId: null, kind: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entityModal, setEntityModal] = useState<EntityModalState>({ open: false, mode: null, title: '', label: '', value: '', confirmText: '确定', targetId: null });
  const toastIdRef = useRef(0);

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
  useEffect(() => { localStorage.setItem('nf_last_note', currentNoteId); }, [currentNoteId]);
  useEffect(() => { void refreshNotebooks(); }, [notes, refreshNotebooks]);

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
    if (currentFilter === 'tag' && activeTag && !n.meta.tags.includes(activeTag)) return false;
    return true;
  }));

  const currentNote = notes.find((n) => n.meta.id === currentNoteId) || null;
  const selectNote = useCallback((id: string) => setCurrentNoteId(id), []);

  const createNote = useCallback((title: string, content: string, notebookId: string, tags: string[]) => {
    const now = Date.now();
    const note: Note = { meta: { id: generateId(), title, notebookId, tags, isPinned: false, isFavorite: false, wordCount: countWords(content), version: 1, createdAt: now, updatedAt: now, backlinks: 0 }, content };
    setNotes((prev) => [note, ...prev]);
    setCurrentNoteId(note.meta.id);
    void tauriInvoke('create_note', { request: { title, content, notebook_id: notebookId, tags } });
    return note;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note['meta'] & { content: string }>) => {
    setNotes((prev) => prev.map((n) => {
      if (n.meta.id !== id) return n;
      const newMeta = { ...n.meta, ...updates, updatedAt: Date.now() };
      if (updates.content !== undefined) newMeta.wordCount = countWords(updates.content);
      return { meta: newMeta, content: updates.content ?? n.content };
    }));
    if (updates.title !== undefined || updates.content !== undefined || updates.tags !== undefined || updates.isPinned !== undefined || updates.isFavorite !== undefined) {
      void tauriInvoke('update_note', { id, title: updates.title ?? null, content: updates.content ?? null, tags: updates.tags ?? null, isPinned: updates.isPinned ?? null, isFavorite: updates.isFavorite ?? null });
    }
  }, []);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  const deleteNote = useCallback((id: string) => { setNotes((prev) => prev.filter((n) => n.meta.id !== id)); setCurrentNoteId((prev) => (prev === id ? '' : prev)); void tauriInvoke('delete_note', { id }); }, []);
  const duplicateNote = useCallback((id: string) => { const note = notes.find((n) => n.meta.id === id); if (!note) return; const copy: Note = { meta: { ...note.meta, id: generateId(), title: `${note.meta.title} (副本)`, createdAt: Date.now(), updatedAt: Date.now() }, content: note.content }; setNotes((prev) => [copy, ...prev]); setCurrentNoteId(copy.meta.id); showToast('success', '📋 已复制'); }, [notes, showToast]);
  const toggleFavorite = useCallback((id: string) => { setNotes((prev) => prev.map((n) => n.meta.id === id ? { ...n, meta: { ...n.meta, isFavorite: !n.meta.isFavorite, updatedAt: Date.now() } } : n)); }, []);
  const togglePin = useCallback((id: string) => { setNotes((prev) => prev.map((n) => n.meta.id === id ? { ...n, meta: { ...n.meta, isPinned: !n.meta.isPinned, updatedAt: Date.now() } } : n)); }, []);

  const createNotebook = useCallback(async (name: string) => { const notebook = await tauriInvoke<Notebook>('create_notebook', { name }); if (notebook) { await refreshNotebooks(); showToast('success', '📒 已创建笔记本'); return notebook; } return null; }, [refreshNotebooks, showToast]);
  const renameNotebook = useCallback(async (id: string, name: string) => { const notebook = await tauriInvoke<Notebook>('rename_notebook', { id, name }); if (notebook) { await refreshNotebooks(); showToast('success', '✏️ 已重命名'); } return notebook; }, [refreshNotebooks, showToast]);
  const deleteNotebook = useCallback(async (id: string) => { const ok = await tauriInvoke<boolean>('delete_notebook', { id }); if (ok !== false) { await refreshNotes(); await refreshNotebooks(); if (activeNotebook === id) setActiveNotebook('all'); showToast('success', '🗑 已删除笔记本'); return true; } return false; }, [activeNotebook, refreshNotes, refreshNotebooks, showToast]);
  const openEntityModal = useCallback((next: EntityModalState) => setEntityModal(next), []);
  const closeEntityModal = useCallback(() => setEntityModal({ open: false, mode: null, title: '', label: '', value: '', confirmText: '确定', targetId: null }), []);

  const tags = Array.from(new Set(notes.flatMap((n) => n.meta.tags)));
  const totalCount = notes.length;
  const favoriteCount = notes.filter((n) => n.meta.isFavorite).length;
  const searchResultCount = searchQuery ? filteredNotes.length : null;

  return { notes, filteredNotes, currentNote, currentNoteId, notebooks, activeNotebook, currentFilter, searchQuery, sortBy, activeTag, isPreviewVisible, isGraphOpen, isPropertiesOpen, toasts, contextMenu, settingsOpen, isLoading, entityModal, totalCount, favoriteCount, searchResultCount, tags, setActiveNotebook, setCurrentFilter, setSearchQuery, setSortBy, setActiveTag, setIsPreviewVisible, setIsGraphOpen, setIsPropertiesOpen, setContextMenu, setSettingsOpen, openEntityModal, closeEntityModal, selectNote, createNote, updateNote, deleteNote, duplicateNote, toggleFavorite, togglePin, createNotebook, renameNotebook, deleteNotebook, refreshNotes, refreshNotebooks, showToast, setCurrentNoteId };
}

export const NoteContext = createContext<NoteStore | null>(null);
export function NoteProvider({ children }: { children: ReactNode }) { return <NoteContext.Provider value={useNoteStore()}>{children}</NoteContext.Provider>; }
export function useStore(): NoteStore { const store = useContext(NoteContext); if (!store) throw new Error('useStore must be used within NoteProvider'); return store; }
export type NoteStore = ReturnType<typeof useNoteStore>;
