// NoteForge 核心类型定义

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

export interface CreateNotebookRequest {
  name: string;
  icon?: string;
  color?: string;
}

export interface UpdateNotebookRequest {
  name?: string;
  icon?: string;
  color?: string;
}

export type NoteFilter = 'all' | 'favorites' | 'pinned' | 'recent' | 'tag';
export type SortOption = 'updated' | 'created' | 'title' | 'words';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  noteId: string | null;
  notebookId: string | null;
  kind: 'note' | 'notebook' | null;
}

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

export interface CreateNoteRequest {
  title: string;
  content: string;
  notebookId: string;
  tags: string[];
}

export interface GitVersionEntry {
  id: string;
  title: string;
  updatedAt: number;
  summary?: string;
  branch: string;
  parentCount: number;
}

export interface GitBranchEntry {
  name: string;
  head: string | null;
  isCurrent: boolean;
}

export interface SearchResult {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: number;
}
