// NoteForge — LocalStorage persistence service
// Provides offline-first storage fallback when Tauri backend is unavailable.
// Data model mirrors the Rust Tauri commands for seamless switching.

import type { Note, Notebook } from '@/types';

const STORAGE_PREFIX = 'noteforge:local:';
const NOTES_KEY = STORAGE_PREFIX + 'notes';
const NOTEBOOKS_KEY = STORAGE_PREFIX + 'notebooks';
const VERSIONS_KEY = (noteId: string) => `${STORAGE_PREFIX}versions:${noteId}`;

// ── Helpers ──

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function safeWrite(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function safeRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Notes CRUD ──

export function loadNotes(): Note[] {
  return safeRead<Note[]>(NOTES_KEY, []);
}

export function saveNotes(notes: Note[]): void {
  safeWrite(NOTES_KEY, notes);
}

export function createLocalNote(title: string, content: string, notebookId: string, tags: string[]): Note {
  const now = Date.now();
  const note: Note = {
    meta: {
      id: genId(),
      title: title || '未命名笔记',
      notebookId: notebookId || 'default',
      tags: tags || [],
      isPinned: false,
      isFavorite: false,
      wordCount: content.length,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    content,
    contentPlain: content.replace(/[#*`>[\]-]/g, '').slice(0, 200),
  };
  const all = loadNotes();
  all.unshift(note);
  saveNotes(all);
  return note;
}

export function updateLocalNote(id: string, updates: { title?: string; content?: string; tags?: string[]; isPinned?: boolean; isFavorite?: boolean; notebookId?: string }): Note | null {
  const all = loadNotes();
  const idx = all.findIndex((n) => n.meta.id === id);
  if (idx === -1) return null;
  const note = all[idx]!;
  const now = Date.now();
  if (updates.title !== undefined) note.meta.title = updates.title;
  if (updates.content !== undefined) {
    note.content = updates.content;
    note.meta.wordCount = updates.content.length;
    note.meta.version += 1;
  }
  if (updates.tags !== undefined) note.meta.tags = updates.tags;
  if (updates.isPinned !== undefined) note.meta.isPinned = updates.isPinned;
  if (updates.isFavorite !== undefined) note.meta.isFavorite = updates.isFavorite;
  if (updates.notebookId !== undefined) note.meta.notebookId = updates.notebookId;
  note.meta.updatedAt = now;
  all[idx] = note;
  saveNotes(all);
  return note;
}

export function deleteLocalNote(id: string): void {
  const all = loadNotes().filter((n) => n.meta.id !== id);
  saveNotes(all);
}

export function getLocalNote(id: string): Note | null {
  return loadNotes().find((n) => n.meta.id === id) ?? null;
}

// ── Notebooks CRUD ──

export function loadNotebooks(): Notebook[] {
  return safeRead<Notebook[]>(NOTEBOOKS_KEY, []);
}

export function saveNotebooks(notebooks: Notebook[]): void {
  safeWrite(NOTEBOOKS_KEY, notebooks);
}

export function createLocalNotebook(name: string, icon?: string, color?: string): Notebook {
  const now = Date.now();
  const nb: Notebook = {
    id: genId(),
    name,
    icon: icon || '📋',
    color: color || '#6366f1',
    parentId: null,
    sortOrder: 0,
    noteCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = loadNotebooks();
  all.push(nb);
  saveNotebooks(all);
  return nb;
}

export function renameLocalNotebook(id: string, name: string): Notebook | null {
  const all = loadNotebooks();
  const idx = all.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  all[idx]!.name = name;
  all[idx]!.updatedAt = Date.now();
  saveNotebooks(all);
  return all[idx]!;
}

export function deleteLocalNotebook(id: string): void {
  const all = loadNotebooks().filter((n) => n.id !== id);
  saveNotebooks(all);
}

// ── Note Version Snapshots (localStorage-based) ──

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  description?: string;
  content: string;
  createdAt: number;
  versionNumber: number;
}

export function loadVersions(noteId: string): NoteVersion[] {
  return safeRead<NoteVersion[]>(VERSIONS_KEY(noteId), []);
}

export function saveVersion(noteId: string, title: string, description?: string): NoteVersion {
  const all = loadVersions(noteId);
  const notes = loadNotes();
  const note = notes.find((n) => n.meta.id === noteId);
  const versionNumber = all.length + 1;
  const version: NoteVersion = {
    id: genId(),
    noteId,
    title,
    description,
    content: note?.content || '',
    createdAt: Date.now(),
    versionNumber,
  };
  all.push(version);
  safeWrite(VERSIONS_KEY(noteId), all);
  return version;
}

export function restoreVersion(noteId: string, versionId: string): NoteVersion | null {
  const all = loadVersions(noteId);
  const version = all.find((v) => v.id === versionId);
  if (!version) return null;
  return version;
}

export function deleteVersion(noteId: string, versionId: string): boolean {
  const all = loadVersions(noteId).filter((v) => v.id !== versionId);
  safeWrite(VERSIONS_KEY(noteId), all);
  return true;
}

export function clearVersions(noteId: string): void {
  safeRemove(VERSIONS_KEY(noteId));
}
