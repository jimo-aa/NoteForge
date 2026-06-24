// NoteForge — 全局状态管理

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { Note, NoteFilter, ToastMessage, ContextMenuState, SortOption } from '@/types';
import { generateId, countWords } from '@/utils/markdown';

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export function useNoteStore() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notebooks, setNotebooks] = useState([{ id: 'all', name: '全部笔记', icon: '📋', noteCount: 0 }]);
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, noteId: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toastIdRef = useRef(0);

  useEffect(() => {
    (async () => {
      const backendNotes = await tauriInvoke<Note[]>('list_notes');
      if (backendNotes) {
        setNotes(backendNotes);
        setCurrentNoteId(backendNotes[0]?.meta.id ?? '');
      }
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('nf_last_note', currentNoteId);
  }, [currentNoteId]);

  useEffect(() => {
    const notebookMap = new Map<string, { id: string; name: string; icon: string; noteCount: number }>();
    notebookMap.set('all', { id: 'all', name: '全部笔记', icon: '📋', noteCount: notes.length });
    notes.forEach((note) => {
      const current = notebookMap.get(note.meta.notebookId) ?? {
        id: note.meta.notebookId,
        name: note.meta.notebookId,
        icon: '📓',
        noteCount: 0,
      };
      current.noteCount += 1;
      notebookMap.set(note.meta.notebookId, current);
    });
    setNotebooks(Array.from(notebookMap.values()));
  }, [notes]);

  useEffect(() => {
    if (isLoading || persistedRef.current) return;
    persistedRef.current = true;
    void tauriInvoke('list_notes');
  }, [isLoading]);

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
    const note: Note = {
      meta: { id: generateId(), title, notebookId, tags, isPinned: false, isFavorite: false, wordCount: countWords(content), version: 1, createdAt: now, updatedAt: now, backlinks: 0 },
      content,
    };
    setNotes((prev) => [note, ...prev]);
    setCurrentNoteId(note.meta.id);
    tauriInvoke('create_note', { request: { title, content, notebook_id: notebookId, tags } });
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
      tauriInvoke('update_note', { id, title: updates.title ?? null, content: updates.content ?? null, tags: updates.tags ?? null, isPinned: updates.isPinned ?? null, isFavorite: updates.isFavorite ?? null });
    }
  }, []);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.meta.id !== id));
    setCurrentNoteId((prev) => (prev === id ? '' : prev));
    tauriInvoke('delete_note', { id });
  }, []);

  const duplicateNote = useCallback((id: string) => {
    const note = notes.find((n) => n.meta.id === id);
    if (!note) return;
    const copy: Note = { meta: { ...note.meta, id: generateId(), title: `${note.meta.title} (副本)`, createdAt: Date.now(), updatedAt: Date.now() }, content: note.content };
    setNotes((prev) => [copy, ...prev]);
    setCurrentNoteId(copy.meta.id);
    showToast('success', '📋 已复制');
  }, [notes, showToast]);

  const toggleFavorite = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => n.meta.id === id ? { ...n, meta: { ...n.meta, isFavorite: !n.meta.isFavorite, updatedAt: Date.now() } } : n));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => n.meta.id === id ? { ...n, meta: { ...n.meta, isPinned: !n.meta.isPinned, updatedAt: Date.now() } } : n));
  }, []);

  const tags = Array.from(new Set(notes.flatMap((n) => n.meta.tags)));
  const totalCount = notes.length;
  const favoriteCount = notes.filter((n) => n.meta.isFavorite).length;
  const searchResultCount = searchQuery ? filteredNotes.length : null;

  return {
    notes, filteredNotes, currentNote, currentNoteId,
    notebooks, activeNotebook, currentFilter, searchQuery, sortBy, activeTag,
    isPreviewVisible, isGraphOpen, isPropertiesOpen,
    toasts, contextMenu, settingsOpen, isLoading,
    totalCount, favoriteCount, searchResultCount, tags,
    setActiveNotebook, setCurrentFilter, setSearchQuery, setSortBy, setActiveTag,
    setIsPreviewVisible, setIsGraphOpen, setIsPropertiesOpen, setContextMenu, setSettingsOpen,
    selectNote, createNote, updateNote, deleteNote, duplicateNote, toggleFavorite, togglePin,
    showToast, setCurrentNoteId,
  };
}

export const NoteContext = createContext<NoteStore | null>(null);
export function NoteProvider({ children }: { children: ReactNode }) { return <NoteContext.Provider value={useNoteStore()}>{children}</NoteContext.Provider>; }
export function useStore(): NoteStore { const store = useContext(NoteContext); if (!store) throw new Error('useStore must be used within NoteProvider'); return store; }
export type NoteStore = ReturnType<typeof useNoteStore>;
