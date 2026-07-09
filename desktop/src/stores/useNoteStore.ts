// NoteForge — Zustand note store
// Replaces the Context-based NoteProvider with a lightweight Zustand store.
// Migration: useNoteStore(selector) for selective subscriptions.

import { create } from 'zustand';
import type { Note, NoteFilter, ToastMessage, ContextMenuState, SortOption, Notebook, SyncChangeItem, SyncPullResponse } from '@/types';
import type { EntityModalState } from '@/components/Modals/EntityModal';
import { countWords } from '@/utils/markdown';
import { tauriInvoke } from '@/utils/invoke';
import { getSyncService } from '@/services/syncService';
import * as localStore from '@/services/localStoreService';
import { DEMO_MD } from '@/utils/syntaxDemo';
// ── Constants ──

const ALL_NOTEBOOK: Notebook = { id: 'all', name: '全部笔记', icon: '📋', color: '', parentId: null, sortOrder: 0, noteCount: 0, createdAt: 0, updatedAt: 0 };
const STORAGE_PREFIX = 'noteforge';

/** Virtual note ID for the built-in syntax demo */
export const SYNTAX_DEMO_ID = '__SYNTAX_DEMO__';
/** Shared Markdown content for the syntax demo (pre-loaded from syntaxDemo.ts) */
let _syntaxDemoContent = '';
export function setSyntaxDemoContent(md: string): void { _syntaxDemoContent = md; }
function getSyntaxDemoNote(): Note | null {
  if (!_syntaxDemoContent) return null;
  return {
    meta: {
      id: SYNTAX_DEMO_ID,
      title: 'Markdown 语法展示',
      notebookId: 'default',
      tags: ['demo', 'reference'],
      isPinned: false,
      isFavorite: false,
      wordCount: _syntaxDemoContent.length,
      version: 1,
      createdAt: 0,
      updatedAt: 0,
    },
    content: _syntaxDemoContent,
    contentPlain: '',
  };
}
const draftKey = (id: string) => `${STORAGE_PREFIX}:draft:${id}`;
const cursorKey = (id: string) => `${STORAGE_PREFIX}:cursor:${id}`;
const autosaveKey = (id: string) => `${STORAGE_PREFIX}:autosave:${id}`;

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
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

// ── Module-level refs (not reactive state) ──

let toastIdCounter = 0;
const autosaveTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
let lastSyncVersion = 0;
const syncService = getSyncService();
const WELCOME_COMPLETED_KEY = 'noteforge:welcome:completed';

// ── Store types ──

interface NoteState {
  notes: Note[];
  filteredNotes: Note[];
  currentNote: Note | null;
  notebooks: Notebook[];
  currentNoteId: string;
  currentFilter: NoteFilter;
  searchQuery: string;
  activeNotebook: string;
  activeTags: string[];
  sortBy: SortOption;
  isPreviewVisible: boolean;
  isGraphOpen: boolean;
  isPropertiesOpen: boolean;
  toasts: ToastMessage[];
  isLoading: boolean;
  contextMenu: ContextMenuState;
  settingsOpen: boolean;
  entityModal: EntityModalState;
  lastSavedAt: number | null;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  showWelcomeGuide: boolean;
  selectedNoteIds: string[];
  recoveryDrafts: Array<{ id: string; title: string; content: string; updatedAt: number }> | null;

  // External file viewing (scanned .md files from extra roots)
  externalFile: { title: string; content: string; path: string } | null;

  // Recently viewed timestamps (only used when filter='recent', separate from updatedAt)
  recentlyViewed: Record<string, number>;

  // Computed properties (kept in sync via subscribe)
  tags: string[];
  totalCount: number;
  favoriteCount: number;
  searchResultCount: number | null;
}

interface NoteActions {
  // Navigation & filter
  setActiveNotebook: (id: string) => void;
  setCurrentFilter: (filter: NoteFilter) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: SortOption) => void;
  setActiveTags: (tagsOrUpdater: string[] | ((prev: string[]) => string[])) => void;
  setIsPreviewVisible: (v: boolean) => void;
  setIsGraphOpen: (v: boolean) => void;
  setIsPropertiesOpen: (v: boolean) => void;
  setContextMenu: (menu: ContextMenuState) => void;
  setSettingsOpen: (v: boolean) => void;
  setShowWelcomeGuide: (v: boolean) => void;
  openEntityModal: (state: EntityModalState) => void;
  closeEntityModal: () => void;
  setCurrentNoteId: (id: string) => void;
  showToast: (type: ToastMessage['type'], message: string) => void;

  // Notes CRUD
  selectNote: (id: string) => void;
  createNote: (title: string, content: string, notebookId: string, tags: string[]) => Promise<Note | null>;
  updateNote: (id: string, updates: Partial<Note['meta']> & { content?: string }) => void;
  deleteNote: (id: string) => void;
  duplicateNote: (id: string) => void;
  toggleFavorite: (id: string) => void;
  togglePin: (id: string) => void;

  // Notebooks
  createNotebook: (name: string, icon?: string, color?: string) => Promise<Notebook | null>;
  renameNotebook: (id: string, name: string) => Promise<Notebook | null>;
  deleteNotebook: (id: string) => Promise<boolean>;

  // Data refresh
  refreshNotes: () => Promise<void>;
  refreshNotebooks: () => Promise<void>;

  // Drafts
  saveDraft: (id: string, content: string) => void;
  loadDraft: (id: string) => string;
  clearDraft: (id: string) => void;

  // Version control
  loadVersions: (id: string) => Promise<Array<{ id: string; title: string; updatedAt: number; summary?: string }>>;
  restoreVersion: (id: string, versionId: string) => Promise<boolean>;
  checkoutBranch: (id: string, branch: string) => Promise<boolean>;
  createBranch: (id: string, branch: string, fromCommit?: string) => Promise<boolean>;
  createVersion: (id: string, title: string, description?: string) => Promise<boolean>;

  // Cursor
  saveCursor: (id: string, range: { start: number; end: number }) => void;
  loadCursor: (id: string) => { start: number; end: number } | null;

  // Recovery
  loadRecovery: () => Array<{ id: string; title: string; content: string; updatedAt: number }>;
  clearRecovery: (id: string) => void;

  // Batch operations
  toggleNoteSelection: (id: string) => void;
  selectAllFiltered: () => void;
  clearSelection: () => void;
  batchDeleteNotes: () => void;
  batchMoveNotes: (targetNotebookId: string) => void;
  batchTagNotes: (tag: string) => void;
  batchPinNotes: () => void;
  batchFavoriteNotes: () => void;
  batchExportNotes: () => Promise<void>;

  // Sync
  queueSyncChange: (noteId: string, note: Note, isDeleted?: boolean) => void;
  applySyncPull: (pull: SyncPullResponse) => void;

  // Lifecycle
  initialize: () => Promise<void>;

  // External file viewing (scanned .md files from extra roots)
  externalFile: { title: string; content: string; path: string } | null;
  openExternalFile: (path: string) => Promise<void>;
  closeExternalFile: () => void;
}

export type NoteStore = NoteState & NoteActions;

// ── Helpers ──

function scheduleAutosave(id: string, title: string, content: string) {
  if (autosaveTimers[id]) clearTimeout(autosaveTimers[id]!);
  autosaveTimers[id] = setTimeout(() => {
    useNoteStore.setState({ saveStatus: 'saving' });
    safeWrite(autosaveKey(id), { content, title, updatedAt: Date.now() });
    tauriInvoke('update_note', { id, title: null, content, tags: null, isPinned: null, isFavorite: null })
      .then(() => useNoteStore.setState({ saveStatus: 'saved', lastSavedAt: Date.now() }))
      .catch(() => useNoteStore.setState({ saveStatus: 'saved' }));
    autosaveTimers[id] = null;
  }, 5000);
}

function triggerSync() {
  syncService.sync(lastSyncVersion).then((result) => {
    if (result) lastSyncVersion = result.serverVersion;
  }).catch(() => {});
}

async function startSyncCycle(applyPull: (pull: SyncPullResponse) => void) {
  try {
    const result = await syncService.sync(lastSyncVersion);
    if (result) {
      lastSyncVersion = result.serverVersion;
      applyPull(result);
    }
  } catch { /* best-effort */ }
  syncService.onPullResultCallback((pullResult) => {
    if (pullResult.serverVersion > lastSyncVersion) {
      lastSyncVersion = pullResult.serverVersion;
      applyPull(pullResult);
    }
  });
  syncService.startPolling(30000, () => lastSyncVersion);
}

// ── Computed selectors (convenience hooks) ──

function computeFilteredNotes(notes: Note[], activeNotebook: string, currentFilter: NoteFilter, activeTags: string[], sortBy: SortOption, recentlyViewed: Record<string, number> = {}): Note[] {
  const filtered = notes.filter((n) => {
    if (activeNotebook !== 'all') {
      const noteNotebookId = n.meta.notebookId || 'default';
      if (noteNotebookId !== activeNotebook) return false;
    }
    if (currentFilter === 'favorites' && !n.meta.isFavorite) return false;
    if (currentFilter === 'pinned' && !n.meta.isPinned) return false;
    if (activeTags.length > 0 && !activeTags.every((tag) => n.meta.tags.includes(tag))) return false;
    return true;
  });

  const copy = [...filtered];
  // 当筛选为"最近查看"时，按独立 recentlyViewed 字段排序，不污染 updatedAt
  if (currentFilter === 'recent' && Object.keys(recentlyViewed).length > 0) {
    copy.sort((a, b) => {
      const aTime = recentlyViewed[a.meta.id] ?? a.meta.updatedAt;
      const bTime = recentlyViewed[b.meta.id] ?? b.meta.updatedAt;
      return bTime - aTime;
    });
  } else {
    switch (sortBy) {
      case 'updated': copy.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt); break;
      case 'created': copy.sort((a, b) => b.meta.createdAt - a.meta.createdAt); break;
      case 'title': copy.sort((a, b) => a.meta.title.localeCompare(b.meta.title)); break;
      case 'words': copy.sort((a, b) => b.meta.wordCount - a.meta.wordCount); break;
    }
  }
  return copy;
}

function computeNotebooksWithCounts(notebooks: Notebook[], notes: Note[]): Notebook[] {
  return notebooks.map((notebook) => {
    if (notebook.id === 'all') return { ...notebook, noteCount: notes.length };
    const count = notes.filter((n) => (n.meta.notebookId || 'default') === notebook.id).length;
    return { ...notebook, noteCount: count };
  });
}

// ── Store ──

export const useNoteStore = create<NoteStore>()((set, get) => ({
  // ── State ──
  notes: [],
  filteredNotes: [],
  currentNote: null,
  notebooks: [ALL_NOTEBOOK],
  currentNoteId: '',
  currentFilter: 'all' as NoteFilter,
  searchQuery: '',
  activeNotebook: 'all',
  activeTags: [],
  sortBy: 'updated' as SortOption,
  isPreviewVisible: true,
  isGraphOpen: false,
  isPropertiesOpen: false,
  toasts: [],
  isLoading: true,
  contextMenu: { visible: false, x: 0, y: 0, noteId: null, notebookId: null, kind: null },
  settingsOpen: false,
  entityModal: { open: false, mode: null, title: '', label: '', value: '', confirmText: '确定', targetId: null },
  lastSavedAt: null,
  saveStatus: 'saved' as const,
  showWelcomeGuide: false,
  selectedNoteIds: [],
  recoveryDrafts: null,
  tags: [],
  totalCount: 0,
  favoriteCount: 0,
  searchResultCount: null,
  externalFile: null,
  recentlyViewed: {},

  // ── Actions ──

  // Init
  initialize: async () => {
    const state = get();
    await Promise.all([state.refreshNotes(), state.refreshNotebooks()]);
    set({ isLoading: false });

    if (!window.localStorage.getItem(WELCOME_COMPLETED_KEY)) {
      set({ showWelcomeGuide: true });
    }

    const hasToken = !!window.localStorage.getItem('noteforge:auth:access-token');
    if (!hasToken) return;

    // Initialize recovery drafts
    set({ recoveryDrafts: get().loadRecovery() });

    // Start sync
    await startSyncCycle(get().applySyncPull);
  },

  // Navigation & filter
  setActiveNotebook: (id) => set({ activeNotebook: id }),
  setCurrentFilter: (filter) => set({ currentFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (sort) => set({ sortBy: sort }),
  setActiveTags: (tagsOrUpdater) => {
    if (typeof tagsOrUpdater === 'function') {
      set((s) => ({ activeTags: tagsOrUpdater(s.activeTags) }));
    } else {
      set({ activeTags: tagsOrUpdater });
    }
  },
  setIsPreviewVisible: (v) => set({ isPreviewVisible: v }),
  setIsGraphOpen: (v) => set({ isGraphOpen: v }),
  setIsPropertiesOpen: (v) => set({ isPropertiesOpen: v }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setShowWelcomeGuide: (v) => set({ showWelcomeGuide: v }),
  openEntityModal: (state) => set({ entityModal: state }),
  closeEntityModal: () => set({ entityModal: { open: false, mode: null, title: '', label: '', value: '', confirmText: '确定', targetId: null } }),
  setCurrentNoteId: (id) => set({ currentNoteId: id }),

  showToast: (type, message) => {
    const id = ++toastIdCounter;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2800);
  },

  // Notes CRUD
  selectNote: (id) => {
    const state = get();
    if (state.currentNoteId && autosaveTimers[state.currentNoteId]) {
      clearTimeout(autosaveTimers[state.currentNoteId]!);
      autosaveTimers[state.currentNoteId] = null;
      const prev = state.notes.find((n) => n.meta.id === state.currentNoteId);
      if (prev) {
        safeWrite(autosaveKey(state.currentNoteId), { content: prev.content, title: prev.meta.title, updatedAt: Date.now() });
      }
    }
    set({ currentNoteId: id, externalFile: null });
    // 仅当"最近查看"筛选激活时，记录查看时间到独立字段（不污染 updatedAt）
    if (state.currentFilter === 'recent') {
      set((s) => ({ recentlyViewed: { ...s.recentlyViewed, [id]: Date.now() } }));
    }
  },

  openExternalFile: async (path) => {
    try {
      const content = await tauriInvoke<string>('read_note_file', { path });
      if (content == null) return;
      // Extract title from first # heading or filename
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch
        ? titleMatch[1]!.trim()
        : path.split(/[/\\]/).pop()?.replace(/\.md$/i, '') || '未命名笔记';
      set({ externalFile: { title, content, path }, currentNoteId: '' });
    } catch (err) {
      console.error('[openExternalFile] Failed to read file:', err);
    }
  },
  closeExternalFile: () => {
    set({ externalFile: null });
  },

  createNote: async (title, content, notebookId, tags) => {
    try {
      const finalNotebookId = notebookId && notebookId !== 'all' ? notebookId : 'default';
      // Try Tauri backend first
      let note: Note | null = null;
      if (isBackendAvail()) {
        note = await tauriInvoke<Note>('create_note', { request: { title, content, notebook_id: finalNotebookId, tags } });
        if (!note) markBackendUnavail();
      }
      // Fallback to localStorage
      if (!note) {
        note = localStore.createLocalNote(title, content, finalNotebookId, tags);
      }
      if (note) {
        localStore.saveNotes([note, ...localStore.loadNotes().filter((item) => item.meta.id !== note.meta.id)]);
        set((s) => ({
          notes: [note, ...s.notes.filter((item) => item.meta.id !== note.meta.id)],
          currentNoteId: note.meta.id,
        }));
        safeWrite(draftKey(note.meta.id), content);
        safeWrite(autosaveKey(note.meta.id), { content, title, updatedAt: Date.now() });
        get().queueSyncChange(note.meta.id, note);
        triggerSync();
        return note;
      }
      console.warn('[createNote] Failed to create note');
      return null;
    } catch (error) {
      console.error('[createNote] Error:', error);
      return null;
    }
  },

  updateNote: (id, updates) => {
    set((s) => {
      const updatedNotes = s.notes.map((n) => {
        if (n.meta.id !== id) return n;
        const nextContent = updates.content ?? n.content;
        const metaUpdates = { ...updates };
        delete metaUpdates.content;
        const next: Note = {
          meta: {
            ...n.meta,
            ...metaUpdates,
            updatedAt: Date.now(),
            version: n.meta.version + (updates.content !== undefined ? 1 : 0),
            wordCount: countWords(nextContent),
          },
          content: nextContent,
          contentPlain: n.contentPlain,
        };
        if (updates.content !== undefined) {
          safeWrite(draftKey(id), nextContent);
          scheduleAutosave(id, updates.title ?? n.meta.title, nextContent);
          set({ saveStatus: 'unsaved' });
        }
        return next;
      });
      return { notes: updatedNotes };
    });

    // Sync to localStorage immediately for draft recovery
    if (updates.content !== undefined) {
      localStore.updateLocalNote(id, { content: updates.content });
    }
    if (updates.title !== undefined || updates.tags !== undefined || updates.isPinned !== undefined || updates.isFavorite !== undefined) {
      localStore.updateLocalNote(id, {
        title: updates.title,
        tags: updates.tags,
        isPinned: updates.isPinned,
        isFavorite: updates.isFavorite,
      });
    }

    const updatedNote = get().notes.find((n) => n.meta.id === id);
    if (updatedNote) get().queueSyncChange(id, updatedNote);
    triggerSync();
  },

  deleteNote: (id) => {
    const noteToDelete = get().notes.find((n) => n.meta.id === id);
    set((s) => {
      const idx = s.notes.findIndex((n) => n.meta.id === id);
      const filtered = s.notes.filter((n) => n.meta.id !== id);
      let newCurrentId = s.currentNoteId;
      if (s.currentNoteId === id) {
        const nextIdx = Math.min(idx, filtered.length - 1);
        newCurrentId = filtered[nextIdx]?.meta.id ?? '';
      }
      return { notes: filtered, currentNoteId: newCurrentId };
    });
    // Persist: try Tauri first, fallback to localStorage
    if (isBackendAvail()) {
      try { void tauriInvoke('delete_note', { id }); } catch { markBackendUnavail(); }
    }
    localStore.deleteLocalNote(id);
    if (noteToDelete) {
      get().queueSyncChange(id, noteToDelete, true);
      triggerSync();
    }
  },

  duplicateNote: (id) => {
    const note = get().notes.find((n) => n.meta.id === id);
    if (!note) return;
    void get().createNote(`${note.meta.title} (副本)`, note.content, note.meta.notebookId || 'default', note.meta.tags);
    get().showToast('success', '📋 已复制');
  },

  toggleFavorite: (id) => {
    const note = get().notes.find((n) => n.meta.id === id);
    if (!note) return;
    get().updateNote(id, { isFavorite: !note.meta.isFavorite });
  },

  togglePin: (id) => {
    const note = get().notes.find((n) => n.meta.id === id);
    if (!note) return;
    get().updateNote(id, { isPinned: !note.meta.isPinned });
  },

  // Notebooks
  createNotebook: async (name, icon, color) => {
    const title = name.trim();
    if (!title) {
      get().showToast('error', '笔记本名称不能为空');
      return null;
    }
    try {
      let notebook: Notebook | null = null;
      if (isBackendAvail()) {
        notebook = await tauriInvoke<Notebook>('create_notebook', { name: title, icon, color });
        if (!notebook) markBackendUnavail();
      }
      if (!notebook) {
        notebook = localStore.createLocalNotebook(title, icon, color);
      }
      if (notebook) {
        localStore.saveNotebooks([notebook, ...localStore.loadNotebooks().filter((item) => item.id !== notebook.id)]);
        await get().refreshNotebooks();
        return notebook;
      }
      get().showToast('error', '创建笔记本失败');
      return null;
    } catch (error) {
      console.error('[createNotebook] Error:', error);
      get().showToast('error', `创建笔记本失败：${error instanceof Error ? error.message : '未知错误'}`);
      return null;
    }
  },

  renameNotebook: async (id, name) => {
    try {
      let notebook: Notebook | null = null;
      if (isBackendAvail()) {
        notebook = await tauriInvoke<Notebook>('rename_notebook', { id, name });
        if (!notebook) markBackendUnavail();
      }
      if (!notebook) {
        notebook = localStore.renameLocalNotebook(id, name);
      }
      if (notebook) {
        localStore.saveNotebooks(localStore.loadNotebooks().map((item) => (item.id === id ? notebook! : item)));
        await get().refreshNotebooks();
        return notebook;
      }
      get().showToast('error', '重命名笔记本失败');
      return null;
    } catch (error) {
      console.error('[renameNotebook] Error:', error);
      get().showToast('error', `重命名失败：${error instanceof Error ? error.message : '未知错误'}`);
      return null;
    }
  },

  deleteNotebook: async (id) => {
    try {
      let ok = false;
      if (isBackendAvail()) {
        const result = await tauriInvoke<boolean>('delete_notebook', { id });
        if (result) { ok = true; } else { markBackendUnavail(); }
      }
      if (!ok) {
        localStore.deleteLocalNotebook(id);
        ok = true;
      }
      if (ok) {
        await get().refreshNotes();
        await get().refreshNotebooks();
        if (get().activeNotebook === id) set({ activeNotebook: 'all' });
        return true;
      }
      get().showToast('error', '删除笔记本失败');
      return false;
    } catch (error) {
      console.error('[deleteNotebook] Error:', error);
      get().showToast('error', `删除失败：${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  },

  // Data refresh
  refreshNotes: async () => {
    let notes: Note[] | null = null;
    if (isBackendAvail()) {
      notes = await tauriInvoke<Note[]>('list_notes');
      if (!notes) markBackendUnavail();
    }
    if (!notes) {
      notes = localStore.loadNotes();
    }
    if (notes) {
      set((s) => {
        const newId = s.currentNoteId || notes![0]?.meta.id || '';
        return { notes: notes!, currentNoteId: newId };
      });
    }
  },

  refreshNotebooks: async () => {
    let backendNotebooks: Notebook[] | null = null;
    if (isBackendAvail()) {
      backendNotebooks = await tauriInvoke<Notebook[]>('list_notebooks');
      if (!backendNotebooks) markBackendUnavail();
    }
    if (!backendNotebooks) {
      backendNotebooks = localStore.loadNotebooks();
    }
    if (backendNotebooks && backendNotebooks.length > 0) {
      const withCounts = computeNotebooksWithCounts([ALL_NOTEBOOK, ...backendNotebooks], get().notes);
      set({ notebooks: withCounts });
    } else {
      set({ notebooks: [ALL_NOTEBOOK] });
    }
  },

  // Drafts
  saveDraft: (id, content) => {
    safeWrite(draftKey(id), content);
    void tauriInvoke('update_note', { id, title: null, content, tags: null, isPinned: null, isFavorite: null }).catch(() => {});
    // Also persist as .md file if primary storage root is configured
    const note = get().notes.find(n => n.meta.id === id);
    if (note) {
      const notebookId = note.meta.notebookId || 'default';
      void tauriInvoke<string>('get_note_file_path', { notebookId, noteTitle: note.meta.title }).then(path => {
        if (path) {
          // Build .md content with YAML frontmatter for metadata
          const frontmatter = `---\ntitle: "${note.meta.title}"\nid: "${id}"\ncreated: ${note.meta.createdAt}\nupdated: ${Date.now()}\ntags: [${(note.meta.tags || []).map(t => `"${t}"`).join(', ')}]\n---\n\n`;
          void tauriInvoke('write_note_file', { path, content: frontmatter + content }).catch(() => {});
        }
      }).catch(() => {});
    }
  },
  loadDraft: (id) => safeRead<string>(draftKey(id), ''),
  clearDraft: (id) => {
    try {
      window.localStorage.removeItem(draftKey(id));
      window.localStorage.removeItem(autosaveKey(id));
    } catch { /* ignore */ }
  },

  // Version control
  loadVersions: async (id) => {
    // Load from localStorage-based version manager
    const versions = localStore.loadVersions(id);
    return versions.map((v) => ({
      id: v.id,
      title: v.title,
      updatedAt: v.createdAt,
      summary: v.description,
    }));
  },
  restoreVersion: async (id, versionId) => {
    const version = localStore.restoreVersion(id, versionId);
    if (!version) {
      get().showToast('error', '未找到该版本');
      return false;
    }
    get().updateNote(id, { content: version.content });
    get().saveDraft(id, version.content);
    get().showToast('success', `已恢复版本: ${version.title}`);
    return true;
  },
  checkoutBranch: async (_id, _branch) => {
    // Branch concept is removed in new design — not applicable
    get().showToast('error', '分支功能已整合到版本管理');
    return false;
  },
  createBranch: async (_id, _branch, _fromCommit?) => {
    get().showToast('error', '分支功能已整合到版本管理');
    return false;
  },
  createVersion: async (id, title, description) => {
    const version = localStore.saveVersion(id, title, description);
    if (version) {
      get().showToast('success', `已创建版本: ${title}`);
      return true;
    }
    return false;
  },

  // Cursor
  saveCursor: (id, range) => safeWrite(cursorKey(id), range),
  loadCursor: (id) => safeRead<{ start: number; end: number } | null>(cursorKey(id), null),

  // Recovery
  loadRecovery: () => {
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
  },
  clearRecovery: (id) => {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}:draft:${id}`);
      window.localStorage.removeItem(`${STORAGE_PREFIX}:autosave:${id}`);
    } catch { /* ignore */ }
    set((s) => ({ recoveryDrafts: s.recoveryDrafts?.filter((d) => d.id !== id) ?? null }));
  },

  // Batch operations
  toggleNoteSelection: (id) => {
    set((s) => ({
      selectedNoteIds: s.selectedNoteIds.includes(id)
        ? s.selectedNoteIds.filter((nid) => nid !== id)
        : [...s.selectedNoteIds, id],
    }));
  },
  selectAllFiltered: () => {
    const { notes, activeNotebook, currentFilter, activeTags, sortBy } = get();
    const filtered = computeFilteredNotes(notes, activeNotebook, currentFilter, activeTags, sortBy);
    set({ selectedNoteIds: filtered.map((n) => n.meta.id) });
  },
  clearSelection: () => set({ selectedNoteIds: [] }),
  batchDeleteNotes: () => {
    const ids = get().selectedNoteIds;
    for (const id of ids) get().deleteNote(id);
    set({ selectedNoteIds: [] });
    get().showToast('success', `已删除 ${ids.length} 条笔记`);
  },
  batchMoveNotes: (targetNotebookId) => {
    const ids = get().selectedNoteIds;
    for (const id of ids) get().updateNote(id, { notebookId: targetNotebookId });
    set({ selectedNoteIds: [] });
    get().showToast('success', `已移动 ${ids.length} 条笔记`);
  },
  batchTagNotes: (tag) => {
    const { notes } = get();
    const ids = get().selectedNoteIds;
    for (const id of ids) {
      const note = notes.find((n) => n.meta.id === id);
      if (note && !note.meta.tags.includes(tag)) {
        get().updateNote(id, { tags: [...note.meta.tags, tag] });
      }
    }
    set({ selectedNoteIds: [] });
    get().showToast('success', `已为 ${ids.length} 条笔记添加标签「${tag}」`);
  },
  batchPinNotes: () => {
    const ids = get().selectedNoteIds;
    const allPinned = ids.every((id) => get().notes.find((n) => n.meta.id === id)?.meta.isPinned);
    for (const id of ids) get().updateNote(id, { isPinned: !allPinned });
    set({ selectedNoteIds: [] });
    get().showToast('success', allPinned ? `已取消 ${ids.length} 条笔记的置顶` : `已置顶 ${ids.length} 条笔记`);
  },
  batchFavoriteNotes: () => {
    const ids = get().selectedNoteIds;
    const allFav = ids.every((id) => get().notes.find((n) => n.meta.id === id)?.meta.isFavorite);
    for (const id of ids) get().updateNote(id, { isFavorite: !allFav });
    set({ selectedNoteIds: [] });
    get().showToast('success', allFav ? `已取消 ${ids.length} 条笔记的收藏` : `已收藏 ${ids.length} 条笔记`);
  },
  batchExportNotes: async () => {
    const ids = get().selectedNoteIds;
    const selectedNotes = ids.map((id) => get().notes.find((n) => n.meta.id === id)).filter(Boolean) as Note[];
    if (selectedNotes.length === 0) return;
    // Build a bundled markdown string from all selected notes
    const bundle = selectedNotes.map((n) => `# ${n.meta.title}\n\n${n.content}\n\n---\n`).join('\n');
    const blob = new Blob([bundle], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noteforge-export-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    set({ selectedNoteIds: [] });
    get().showToast('success', `已导出 ${selectedNotes.length} 条笔记`);
  },

  // Sync
  queueSyncChange: (noteId, note, isDeleted) => {
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
    syncService.queueChange(change);
  },

  applySyncPull: (pull) => {
    set((s) => {
      const updated = [...s.notes];
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
      for (const delId of pull.deletedNoteIds) {
        const idx = updated.findIndex((n) => n.meta.id === delId);
        if (idx >= 0) updated.splice(idx, 1);
      }
      return { notes: updated };
    });
  },
}));

// ── Auto-compute derived state on changes to source data ──
// Uses a re-entrancy guard to prevent infinite loops from setState inside subscribe.

// ── Backend availability flag ──
// When true, Tauri commands are used. Falls back to localStorage on first failure.
let _backendAvail: boolean | null = null;
function isBackendAvail(): boolean {
  if (_backendAvail === null) _backendAvail = true; // optimistic
  return _backendAvail;
}
function markBackendUnavail(): void { _backendAvail = false; }

let isComputingDerived = false;
let initStarted = false;

// ── Auto-initialization: called once on first access ──
// This replaces the old useEffect inside noteStore's useNoteStore() hook.
function autoInit() {
  if (initStarted) return;
  initStarted = true;
  // Defer to next microtask so React can mount first
  Promise.resolve().then(() => {
    useNoteStore.getState().initialize().catch(() => {
      // Silently handle init errors — components will show empty state
    });
  });
}

// Trigger initialization immediately (safe because it's deferred to microtask)
// Initialize syntax demo content
setSyntaxDemoContent(DEMO_MD);

autoInit();

// ── Derived state subscription (reactively compute filteredNotes, currentNote, etc.) ──
useNoteStore.subscribe(() => {
  if (isComputingDerived) return;
  isComputingDerived = true;
  try {
    const s = useNoteStore.getState();
    const filtered = computeFilteredNotes(s.notes, s.activeNotebook, s.currentFilter, s.activeTags, s.sortBy, s.recentlyViewed);
    const current = s.currentNoteId === SYNTAX_DEMO_ID
      ? getSyntaxDemoNote()
      : s.notes.find((n) => n.meta.id === s.currentNoteId) || null;
    const tags = Array.from(new Set(s.notes.flatMap((n) => n.meta.tags)));
    const totalCount = s.notes.length;
    const favoriteCount = s.notes.filter((n) => n.meta.isFavorite).length;
    const notebooksWithCounts = computeNotebooksWithCounts(s.notebooks, s.notes);

    // Compare with JSON.stringify to avoid infinite loop from new object references
    const needsFiltered = JSON.stringify(filtered) !== JSON.stringify(s.filteredNotes);
    const needsCurrent = current?.meta.id !== s.currentNote?.meta.id
      || current?.content !== s.currentNote?.content
      || current?.meta.updatedAt !== s.currentNote?.meta.updatedAt;
    const needsTags = JSON.stringify(tags) !== JSON.stringify(s.tags);
    const needsTotal = totalCount !== s.totalCount;
    const needsFav = favoriteCount !== s.favoriteCount;
    const needsNb = JSON.stringify(notebooksWithCounts) !== JSON.stringify(s.notebooks);

    if (needsFiltered || needsCurrent || needsTags || needsTotal || needsFav || needsNb) {
      useNoteStore.setState({
        ...(needsFiltered ? { filteredNotes: filtered } : {}),
        ...(needsCurrent ? { currentNote: current } : {}),
        ...(needsTags ? { tags } : {}),
        ...(needsTotal ? { totalCount } : {}),
        ...(needsFav ? { favoriteCount } : {}),
        ...(needsNb ? { notebooks: notebooksWithCounts } : {}),
      });
    }
  } finally {
    isComputingDerived = false;
  }
});
