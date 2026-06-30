// NoteForge — 全局状态管理

import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import type { Note, NoteFilter, ToastMessage, ContextMenuState, SortOption, Notebook, SyncChangeItem, NoteResponseItem, SyncPullResponse } from '@/types';
import type { EntityModalState } from '@/components/Modals/EntityModal';
import { countWords } from '@/utils/markdown';
import { tauriInvoke } from '@/utils/invoke';
import { getSyncService } from '@/services/syncService';

const ALL_NOTEBOOK: Notebook = { id: 'all', name: '全部笔记', icon: '📋', color: '', parentId: null, sortOrder: 0, noteCount: 0, createdAt: 0, updatedAt: 0 };
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
  const lastSyncVersionRef = useRef(0);
  const syncServiceRef = useRef(getSyncService());

  // Convert a Note into a SyncChangeItem and queue it
  const queueSyncChange = useCallback((noteId: string, note: Note, isDeleted?: boolean) => {
    const change: SyncChangeItem = {
      noteId,
      clientVersion: note.meta.version,
      title: note.meta.title,
      content: note.content,
      notebookId: note.meta.notebookId,
      tags: note.meta.tags,
      isPinned: note.meta.isPinned,
      isFavorite: note.meta.isFavorite,
      isDeleted,
    };
    syncServiceRef.current.queueChange(change);
  }, []);

  // Merge a SyncPullResponse into local notes state
  const applySyncPull = useCallback((pull: SyncPullResponse) => {
    setNotes((prev) => {
      const updated = [...prev];
      for (const resp of pull.notes) {
        const existingIdx = updated.findIndex((n) => n.meta.id === resp.id);
        const importedNote: Note = {
          meta: {
            id: resp.id,
            title: resp.title,
            notebookId: resp.notebookId,
            tags: resp.tags,
            isPinned: resp.isPinned,
            isFavorite: resp.isFavorite,
            wordCount: resp.wordCount,
            version: resp.version,
            createdAt: resp.createdAt,
            updatedAt: resp.updatedAt,
          },
          content: resp.content,
          contentPlain: resp.contentPlain,
        };
        if (existingIdx >= 0) {
          const existing = updated[existingIdx];
          if (existing && resp.version > existing.meta.version) {
            updated[existingIdx] = importedNote;
          }
        } else {
          updated.push(importedNote);
        }
      }
      // Remove deleted notes
      for (const delId of pull.deletedNoteIds) {
        const idx = updated.findIndex((n) => n.meta.id === delId);
        if (idx >= 0) updated.splice(idx, 1);
      }
      return updated;
    });
  }, []);

  const refreshNotebooks = useCallback(async () => {
    const backendNotebooks = await tauriInvoke<Notebook[]>('list_notebooks');
    if (backendNotebooks) {
      setNotebooks([ALL_NOTEBOOK, ...backendNotebooks]);
    } else {
      console.warn('[refreshNotebooks] Failed to fetch notebooks from backend');
      setNotebooks([ALL_NOTEBOOK]);
    }
  }, []);

  const refreshNotes = useCallback(async () => {
    const backendNotes = await tauriInvoke<Note[]>('list_notes');
    if (backendNotes) {
      setNotes(backendNotes);
      setCurrentNoteId((prev) => prev || backendNotes[0]?.meta.id || '');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([refreshNotes(), refreshNotebooks()]);
      setIsLoading(false);

      // Only start sync if user has auth token
      const hasToken = !!window.localStorage.getItem('noteforge:auth:access-token');
      if (!hasToken) return;

      // After initial load, trigger first sync pull
      const svc = syncServiceRef.current;
      svc.sync(lastSyncVersionRef.current).then((result) => {
        if (result) {
          lastSyncVersionRef.current = result.serverVersion;
          applySyncPull(result);
        }
      }).catch(() => {});
      // Wire pull-result callback for polling
      svc.onPullResultCallback((pullResult) => {
        if (pullResult.serverVersion > lastSyncVersionRef.current) {
          lastSyncVersionRef.current = pullResult.serverVersion;
          applySyncPull(pullResult);
        }
      });
      // Start background polling
      svc.startPolling(30000, () => lastSyncVersionRef.current);
    })();
    return () => {
      syncServiceRef.current.stopPolling();
      syncServiceRef.current.destroy();
    };
  }, [refreshNotes, refreshNotebooks, applySyncPull]);

  // Listen for auth changes — start sync after login
  useEffect(() => {
    const onAuthChanged = () => {
      const hasToken = !!window.localStorage.getItem('noteforge:auth:access-token');
      if (!hasToken) return;
      const svc = syncServiceRef.current;
      // Initial sync pull on login
      svc.sync(lastSyncVersionRef.current).then((result) => {
        if (result) {
          lastSyncVersionRef.current = result.serverVersion;
          applySyncPull(result);
        }
      }).catch(() => {});
      // Start polling if not already running
      svc.startPolling(30000, () => lastSyncVersionRef.current);
    };
    window.addEventListener('noteforge:auth-changed', onAuthChanged);
    return () => window.removeEventListener('noteforge:auth-changed', onAuthChanged);
  }, [applySyncPull]);

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

  const filteredNotes = useMemo(() => sortNotes(notes.filter((n) => {
    // 笔记列表只按筛选条件过滤，全文搜索由 SearchBox 通过 Tantivy 处理
    // 笔记本过滤 - 修复：处理 notebookId 为 null 的情况
    if (activeNotebook !== 'all') {
      // 获取笔记的笔记本 ID，如果为 null 则使用 'default'
      const noteNotebookId = n.meta.notebookId || 'default';
      if (noteNotebookId !== activeNotebook) return false;
    }

    // 其他过滤条件
    if (currentFilter === 'favorites' && !n.meta.isFavorite) return false;
    if (currentFilter === 'pinned' && !n.meta.isPinned) return false;
    if (activeTags.length > 0 && !activeTags.every((tag) => n.meta.tags.includes(tag))) return false;
    return true;
  })), [notes, activeNotebook, currentFilter, activeTags, sortBy, sortNotes]);

  const currentNote = useMemo(() => notes.find((n) => n.meta.id === currentNoteId) || null, [notes, currentNoteId]);
  const selectNote = useCallback((id: string) => {
    setCurrentNoteId((prev) => {
      if (prev && autosaveTimerRef.current[prev]) {
        window.clearTimeout(autosaveTimerRef.current[prev]!);
        autosaveTimerRef.current[prev] = null;
        safeWrite(autosaveKey(prev), { content: notes.find((n) => n.meta.id === prev)?.content || '', title: notes.find((n) => n.meta.id === prev)?.meta.title || '', updatedAt: Date.now() });
      }
      return id;
    });
  }, [notes]);

  const createNote = useCallback(async (title: string, content: string, notebookId: string, tags: string[]) => {
    try {
      // 确保 notebookId 总是有值，默认使用 'default'
      const finalNotebookId = notebookId && notebookId !== 'all' ? notebookId : 'default';
      
      const note = await tauriInvoke<Note>('create_note', { 
        request: { title, content, notebook_id: finalNotebookId, tags } 
      });
      
      if (note) {
        setNotes((prev) => [note, ...prev.filter((item) => item.meta.id !== note.meta.id)]);
        setCurrentNoteId(note.meta.id);
        safeWrite(draftKey(note.meta.id), content);
        safeWrite(autosaveKey(note.meta.id), { content, title, updatedAt: Date.now() });
        // Queue sync change in background
        queueSyncChange(note.meta.id, note);
        void syncServiceRef.current.sync(lastSyncVersionRef.current).then((result) => {
          if (result) lastSyncVersionRef.current = result.serverVersion;
        }).catch(() => {});
        return note;
      }
      console.warn('[createNote] Backend returned null for note creation');
      return null;
    } catch (error) {
      console.error('[createNote] Error:', error);
      return null;
    }
  }, []);

  const scheduleAutosave = useCallback((id: string, title: string, content: string) => {
    if (autosaveTimerRef.current[id]) window.clearTimeout(autosaveTimerRef.current[id]!);
    autosaveTimerRef.current[id] = window.setTimeout(() => {
      safeWrite(autosaveKey(id), { content, title, updatedAt: Date.now() });
      autosaveTimerRef.current[id] = null;
    }, 5000);
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note['meta']> & { content?: string }) => {
    setNotes((prev) => prev.map((n) => {
      if (n.meta.id !== id) return n;
      const nextContent = updates.content ?? n.content;
      const { content: _unused, ...metaUpdates } = updates;
      const nextContentPlain = updates.content !== undefined ? n.contentPlain : n.contentPlain;
      const next: Note = {
        meta: { ...n.meta, ...metaUpdates, updatedAt: Date.now(), version: n.meta.version + (updates.content !== undefined ? 1 : 0), wordCount: countWords(nextContent) },
        content: nextContent,
        contentPlain: nextContentPlain,
      };
      if (updates.content !== undefined) {
        safeWrite(draftKey(id), nextContent);
        scheduleAutosave(id, updates.title ?? n.meta.title, nextContent);
      }
      return next;
    }));
    if (updates.title !== undefined || updates.content !== undefined || updates.tags !== undefined || updates.isPinned !== undefined || updates.isFavorite !== undefined) {
      void tauriInvoke('update_note', { id, title: updates.title ?? null, content: updates.content ?? null, tags: updates.tags ?? null, is_pinned: updates.isPinned ?? null, is_favorite: updates.isFavorite ?? null });
    }
    // Queue sync change in background after state update
    setNotes((prev) => {
      const updated = prev.find((n) => n.meta.id === id);
      if (updated) {
        queueSyncChange(id, updated);
      }
      return prev;
    });
    void syncServiceRef.current.sync(lastSyncVersionRef.current).then((result) => {
      if (result) lastSyncVersionRef.current = result.serverVersion;
    }).catch(() => {});
  }, [scheduleAutosave, queueSyncChange]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  const deleteNote = useCallback((id: string) => {
    // Find note before removing from state for sync queue
    const noteToDelete = notes.find((n) => n.meta.id === id);
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.meta.id === id);
      const filtered = prev.filter((n) => n.meta.id !== id);
      setCurrentNoteId((current) => {
        if (current !== id) return current;
        const nextIdx = Math.min(idx, filtered.length - 1);
        return filtered[nextIdx]?.meta.id ?? '';
      });
      return filtered;
    });
    void tauriInvoke('delete_note', { id });
    // Queue sync delete in background
    if (noteToDelete) {
      queueSyncChange(id, noteToDelete, true);
      void syncServiceRef.current.sync(lastSyncVersionRef.current).then((result) => {
        if (result) lastSyncVersionRef.current = result.serverVersion;
      }).catch(() => {});
    }
  }, [notes, queueSyncChange]);
  const duplicateNote = useCallback((id: string) => { const note = notes.find((n) => n.meta.id === id); if (!note) return; void createNote(`${note.meta.title} (副本)`, note.content, note.meta.notebookId || 'default', note.meta.tags); showToast('success', '📋 已复制'); }, [createNote, notes, showToast]);
  const toggleFavorite = useCallback((id: string) => { const note = notes.find((n) => n.meta.id === id); if (!note) return; updateNote(id, { isFavorite: !note.meta.isFavorite }); }, [notes, updateNote]);
  const togglePin = useCallback((id: string) => { const note = notes.find((n) => n.meta.id === id); if (!note) return; updateNote(id, { isPinned: !note.meta.isPinned }); }, [notes, updateNote]);

  const createNotebook = useCallback(async (name: string, icon?: string, color?: string) => {
    const title = name.trim();
    if (!title) {
      showToast('error', '笔记本名称不能为空');
      return null;
    }

    try {
      const notebook = await tauriInvoke<Notebook>('create_notebook', { name: title, icon, color });
      if (notebook) {
        await refreshNotebooks();
        showToast('success', '📒 已创建笔记本');
        return notebook;
      }
      console.warn('[createNotebook] Backend returned null');
      showToast('error', '创建笔记本失败：后端未响应');
      return null;
    } catch (error) {
      console.error('[createNotebook] Error:', error);
      showToast('error', `创建笔记本失败：${error instanceof Error ? error.message : '未知错误'}`);
      return null;
    }
  }, [refreshNotebooks, showToast]);

  const renameNotebook = useCallback(async (id: string, name: string) => {
    try {
      const notebook = await tauriInvoke<Notebook>('rename_notebook', { id, name });
      if (notebook) {
        await refreshNotebooks();
        showToast('success', '✏️ 已重命名笔记本');
        return notebook;
      }
      showToast('error', '重命名笔记本失败');
      return null;
    } catch (error) {
      console.error('[renameNotebook] Error:', error);
      showToast('error', `重命名失败：${error instanceof Error ? error.message : '未知错误'}`);
      return null;
    }
  }, [refreshNotebooks, showToast]);

  const deleteNotebook = useCallback(async (id: string) => {
    try {
      const ok = await tauriInvoke<boolean>('delete_notebook', { id });
      if (ok) {
        await refreshNotes();
        await refreshNotebooks();
        if (activeNotebook === id) setActiveNotebook('all');
        showToast('success', '🗑️ 已删除笔记本');
        return true;
      }
      showToast('error', '删除笔记本失败');
      return false;
    } catch (error) {
      console.error('[deleteNotebook] Error:', error);
      showToast('error', `删除失败：${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }, [activeNotebook, refreshNotes, refreshNotebooks, showToast]);
  const openEntityModal = useCallback((next: EntityModalState) => setEntityModal(next), []);
  const closeEntityModal = useCallback(() => setEntityModal({ open: false, mode: null, title: '', label: '', value: '', confirmText: '确定', targetId: null }), []);

  const saveDraft = useCallback((id: string, content: string) => { safeWrite(draftKey(id), content); }, []);
  const loadDraft = useCallback((id: string) => safeRead<string>(draftKey(id), ''), []);
  const clearDraft = useCallback((id: string) => { try { window.localStorage.removeItem(draftKey(id)); window.localStorage.removeItem(autosaveKey(id)); } catch {} }, []);
  const loadVersions = useCallback(async (id: string) => {
    const backend = await tauriInvoke<Array<{ id: string; title: string; updatedAt: number; summary?: string }>>('list_note_versions', { note_id: id });
    return backend || [];
  }, []);
  const restoreVersion = useCallback(async (id: string, versionId: string) => {
    const content = await tauriInvoke<string>('checkout_note_version', { note_id: id, commit_id: versionId });
    if (!content) return false;
    updateNote(id, { content });
    saveDraft(id, content);
    showToast('success', '已恢复历史版本');
    return true;
  }, [saveDraft, showToast, updateNote]);
  const checkoutBranch = useCallback(async (id: string, branch: string) => {
    const content = await tauriInvoke<string>('checkout_note_branch', { note_id: id, branch });
    if (!content) return false;
    updateNote(id, { content });
    saveDraft(id, content);
    showToast('success', `已切换到分支: ${branch}`);
    return true;
  }, [saveDraft, showToast, updateNote]);
  const createBranch = useCallback(async (id: string, branch: string, fromCommit?: string) => {
    const ok = await tauriInvoke<void>('create_note_branch', { note_id: id, branch, from_commit: fromCommit });
    if (ok === undefined) {
      showToast('success', `已创建分支: ${branch}`);
      return true;
    }
    return false;
  }, [showToast]);
  const createVersion = useCallback(async (id: string, title: string, description?: string) => {
    const commitId = await tauriInvoke<string>('create_note_version', { note_id: id, title, description });
    if (commitId) {
      showToast('success', `已创建版本: ${title}`);
      return true;
    }
    return false;
  }, [showToast]);
  const saveCursor = useCallback((id: string, range: { start: number; end: number }) => safeWrite(cursorKey(id), range), []);
  const loadCursor = useCallback((id: string) => safeRead<{ start: number; end: number } | null>(cursorKey(id), null), []);
  const loadRecovery = useCallback(() => {
    try {
      const drafts: Array<{ id: string; title: string; content: string; updatedAt: number }> = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(`${STORAGE_PREFIX}:draft:`)) {
          const id = key.slice(`${STORAGE_PREFIX}:draft:`.length);
          const content = window.localStorage.getItem(key) || '';
          if (content) drafts.push({ id, title: '', content, updatedAt: Date.now() });
        } else if (key.startsWith(`${STORAGE_PREFIX}:autosave:`)) {
          try {
            const id = key.slice(`${STORAGE_PREFIX}:autosave:`.length);
            const parsed = JSON.parse(window.localStorage.getItem(key) || '{}');
            if (parsed?.content) drafts.push({ id, title: parsed.title || '', content: parsed.content, updatedAt: parsed.updatedAt || Date.now() });
          } catch { /* skip malformed */ }
        }
      }
      drafts.sort((a, b) => b.updatedAt - a.updatedAt);
      return drafts;
    } catch {
      return [];
    }
  }, []);

  const recoveryDraftsRef = useRef<Array<{ id: string; title: string; content: string; updatedAt: number }> | null>(null);
  if (!recoveryDraftsRef.current) recoveryDraftsRef.current = loadRecovery();
  const recoveryDrafts = recoveryDraftsRef.current;
  const clearRecovery = useCallback((id: string) => {
    try { window.localStorage.removeItem(`${STORAGE_PREFIX}:draft:${id}`); window.localStorage.removeItem(`${STORAGE_PREFIX}:autosave:${id}`); } catch {}
  }, []);

  // 计算每个笔记本的笔记数
  const notebooksWithCounts = useMemo(() => notebooks.map((notebook) => {
    if (notebook.id === 'all') {
      return { ...notebook, noteCount: notes.length };
    }
    const count = notes.filter((n) => (n.meta.notebookId || 'default') === notebook.id).length;
    return { ...notebook, noteCount: count };
  }), [notebooks, notes]);

  const tags = useMemo(() => Array.from(new Set(notes.flatMap((n) => n.meta.tags))), [notes]);
  const totalCount = notes.length;
  const favoriteCount = notes.filter((n) => n.meta.isFavorite).length;
  const searchResultCount = null;

  return { notes, filteredNotes, currentNote, currentNoteId, notebooks: notebooksWithCounts, activeNotebook, currentFilter, searchQuery, sortBy, activeTags, isPreviewVisible, isGraphOpen, isPropertiesOpen, toasts, contextMenu, settingsOpen, isLoading, entityModal, totalCount, favoriteCount, searchResultCount, tags, setActiveNotebook, setCurrentFilter, setSearchQuery, setSortBy, setActiveTags, setIsPreviewVisible, setIsGraphOpen, setIsPropertiesOpen, setContextMenu, setSettingsOpen, openEntityModal, closeEntityModal, selectNote, createNote, updateNote, deleteNote, duplicateNote, toggleFavorite, togglePin, createNotebook, renameNotebook, deleteNotebook, refreshNotes, refreshNotebooks, showToast, setCurrentNoteId, saveDraft, loadDraft, clearDraft, loadVersions, restoreVersion, checkoutBranch, createBranch, createVersion, saveCursor, loadCursor, loadRecovery, recoveryDrafts, clearRecovery };
}

export const NoteContext = createContext<NoteStore | null>(null);
export function NoteProvider({ children }: { children: ReactNode }) { return <NoteContext.Provider value={useNoteStore()}>{children}</NoteContext.Provider>; }
export function useStore(): NoteStore { const store = useContext(NoteContext); if (!store) throw new Error('useStore must be used within NoteProvider'); return store; }
export type NoteStore = ReturnType<typeof useNoteStore>;
