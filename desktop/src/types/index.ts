// NoteForge 核心类型定义

export interface NoteMeta {
  id: string;
  title: string;
  notebookId: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;
  wordCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  backlinks: number;
}

export interface Note {
  meta: NoteMeta;
  content: string;
}

export interface Notebook {
  id: string;
  name: string;
  icon: string;
  noteCount: number;
}

export type NoteFilter = 'all' | 'favorites' | 'pinned' | 'recent' | 'tag';
export type SortOption = 'updated' | 'created' | 'title' | 'words';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  noteId: string | null;
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
