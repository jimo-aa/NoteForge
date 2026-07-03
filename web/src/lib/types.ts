// NoteForge Web — Shared Types

export interface NoteMeta {
  id: string;
  title: string;
  notebookId: string | null;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  wordCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  meta: NoteMeta;
  content: string;
  contentPlain: string;
}

export interface Notebook {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  noteCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  noteCount: number;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

export interface NoteResponseItem {
  id: string;
  userId: string;
  notebookId: string | null;
  title: string;
  content: string;
  contentPlain: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  wordCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline' | 'error';
