// NoteForge — Event System Types
// Event names and payloads for the editor EventBus.

import type { EditorMode, SaveStatus } from './editor';

/** Map of event names to their payload types */
export interface EditorEventMap {
  /** Content has been modified */
  'content:change': { content: string };
  /** Editor mode switched */
  'mode:switch': { mode: EditorMode };
  /** Save triggered */
  'save': { content: string };
  /** Save status changed */
  'save:status': { status: SaveStatus };
  /** Selection changed */
  'selection:change': { from: number; to: number; text?: string };
  /** Search query changed */
  'search:change': { query: string };
  /** Tags modified */
  'tag:change': { tags: string[] };
  /** Error occurred */
  'error': { error: Error; context?: string };
  /** Wiki link clicked */
  'wiki-link:click': { title: string };
  /** Image inserted */
  'image:insert': { src: string };
  /** Fullscreen toggled */
  'fullscreen:toggle': { fullscreen: boolean };
}

/** Event handler type */
export type EventHandler<T = unknown> = (payload: T) => void;

/** Unsubscribe function returned by EventBus.on() */
export type Unsubscribe = () => void;
