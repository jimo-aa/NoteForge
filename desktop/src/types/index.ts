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
  total_hits: number;
}

export interface SearchPage {
  results: SearchResult[];
  total_hits: number;
}

// === Auth types ===
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

export interface AuthResponse {
  code: number;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  };
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// === Sync types ===
export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline' | 'error';

export interface SyncState {
  lastSyncAt: number | null;
  pendingChanges: number;
  status: SyncStatus;
}

export interface SyncPullRequest {
  lastVersion: number;
}

// Backend NoteResponse shape (camelCase — matches backend exactly)
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

export interface SyncPullResponse {
  notes: NoteResponseItem[];
  deletedNoteIds: string[];
  serverVersion: number;
}

export interface SyncPushRequest {
  changes: SyncChangeItem[];
}

export interface SyncChangeItem {
  noteId: string;
  clientVersion: number;
  title?: string;
  content?: string;
  notebookId?: string | null;
  tags?: string[];
  isPinned?: boolean;
  isFavorite?: boolean;
  isDeleted?: boolean;
}

export interface SyncPushResponse {
  accepted: number;
  serverVersion: number;
  conflicts: Array<{
    noteId: string;
    serverVersion: number;
    localVersion: number;
  }>;
}

// === Attachment types ===
export interface Attachment {
  id: string;
  noteId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  createdAt: number;
}

export interface AttachmentUploadRequest {
  noteId: string;
  file: File;
}
