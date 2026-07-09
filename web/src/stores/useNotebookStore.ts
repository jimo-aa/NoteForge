'use client';

import { create } from 'zustand';
import { notebooks as notebooksApi, tags as tagsApi, notes as notesApi } from '@/lib/api-client';
import type { Notebook, Tag, NoteResponseItem } from '@/lib/types';

interface NotebookState {
  notebooks: Notebook[];
  tags: Tag[];
  recentNotes: NoteResponseItem[];
  loading: boolean;
  error: string | null;

  loadNotebooks: () => Promise<void>;
  loadTags: () => Promise<void>;
  loadRecentNotes: () => Promise<void>;
  createNotebook: (name: string, icon?: string, color?: string) => Promise<Notebook | null>;
  renameNotebook: (id: string, name: string) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useNotebookStore = create<NotebookState>()((set, get) => ({
  notebooks: [],
  tags: [],
  recentNotes: [],
  loading: false,
  error: null,

  loadNotebooks: async () => {
    try {
      const res = await notebooksApi.list();
      if (res.data) set({ notebooks: res.data, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load notebooks' });
    }
  },

  loadTags: async () => {
    try {
      const res = await tagsApi.list();
      if (res.data) set({ tags: res.data, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load tags' });
    }
  },

  loadRecentNotes: async () => {
    try {
      const res = await notesApi.list();
      if (res.data) {
        const sorted = [...res.data]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 20);
        set({ recentNotes: sorted, error: null });
      }
    } catch {
      // silent
    }
  },

  createNotebook: async (name: string, icon?: string, color?: string) => {
    try {
      const res = await notebooksApi.create({ name, icon, color });
      if (res.data) {
        await get().loadNotebooks();
        return res.data;
      }
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create notebook' });
      return null;
    }
  },

  renameNotebook: async (id: string, name: string) => {
    try {
      await notebooksApi.rename(id, name);
      await get().loadNotebooks();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to rename notebook' });
    }
  },

  deleteNotebook: async (id: string) => {
    try {
      await notebooksApi.delete(id);
      await get().loadNotebooks();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete notebook' });
    }
  },

  refresh: async () => {
    set({ loading: true });
    await Promise.all([
      get().loadNotebooks(),
      get().loadTags(),
      get().loadRecentNotes(),
    ]);
    set({ loading: false });
  },
}));
