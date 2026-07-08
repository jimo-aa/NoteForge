// NoteForge — Editor Core Types
// Central type definitions for the editor module.

/** Editor operating mode */
export type EditorMode = 'wysiwyg' | 'source';

/** Save persistence status */
export type SaveStatus = 'saved' | 'saving' | 'unsaved';

/** Cursor/selection range */
export interface EditorSelection {
  from: number;
  to: number;
}

/** Minimal note content shape used within the editor */
export interface EditorNoteContent {
  title: string;
  content: string;
}

/** Editor controller state snapshot */
export interface EditorState {
  mode: EditorMode;
  content: string;
  selection: EditorSelection;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
}

/** Persisted cursor position */
export interface CursorPosition {
  start: number;
  end: number;
}

/** Unified handle exposed by both WYSIWYG and Source editors */
export interface EditorHandle {
  focus: () => void;
  getSelection: () => { from: number; to: number };
  getContentBeforeCursor: () => string;
  insertTextAtCursor: (text: string) => void;
  insertText: (text: string) => void;
  setContent: (content: string) => void;
  setSelection: (from: number, to: number) => void;
  getContent: () => string;
  wrapText: (before: string, after: string) => void;
}

/** Search match info for the search bar */
export interface SearchMatchInfo {
  current: number;
  total: number;
  query: string;
}

/** Wiki link suggestion item */
export interface WikiSuggestion {
  title: string;
}

/** Backlink entry */
export interface BacklinkEntry {
  sourceId: string;
  sourceTitle: string;
}

/** Toolbar action definition for the Markdown toolbar */
export interface ToolbarAction {
  label: string;
  before: string;
  after: string;
}
