// NoteForge — Editor Controller (Simplified)
// Core coordinator that wires together ContentSync, EventBus,
// keyboard shortcuts, and editor lifecycle.
// Currently operates in source-mode only (双栏编辑模式).

import { ContentSync } from './ContentSync';
import { EventBus, eventBus } from './EventBus';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import type { EditorHandle, SaveStatus } from '../types/editor';

export interface EditorControllerConfig {
  /** Initial content in Markdown */
  initialContent?: string;
}

/**
 * EditorController — the central orchestrator for the editor module.
 *
 * Responsibilities:
 * - Manages content and synchronization
 * - Provides event bus for decoupled communication
 * - Manages keyboard shortcuts
 * - Handles save/draft lifecycle
 */
export class EditorController {
  readonly contentSync: ContentSync;
  readonly eventBus: EventBus;
  readonly keyboardShortcuts: KeyboardShortcuts;

  /** Reference to the currently active editor handle */
  activeEditor: EditorHandle | null = null;

  /** Current save status */
  saveStatus: SaveStatus = 'saved';

  /** Last saved timestamp */
  lastSavedAt: number | null = null;

  /** Auto-save timer reference */
  private _autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Change callback (to NoteStore) */
  private _onChange: ((content: string) => void) | null = null;

  /** Debounce delay for auto-save */
  private _autosaveDelay = 300;

  constructor(config: EditorControllerConfig = {}) {
    this.contentSync = new ContentSync();
    this.eventBus = eventBus;
    this.keyboardShortcuts = KeyboardShortcuts.createDefault();

    if (config.initialContent) {
      this.contentSync.setContent(config.initialContent);
    }

    // Subscribe to save events
    this.eventBus.on('save', ({ content }) => {
      this._onChange?.(content);
    });
  }

  /** Register the external change handler (bound to NoteStore) */
  onChange(cb: (content: string) => void): void {
    this._onChange = cb;
  }

  /** Trigger auto-save with debounce */
  private scheduleAutosave(): void {
    this.saveStatus = 'unsaved';
    if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => {
      this.save();
    }, this._autosaveDelay);
  }

  /** Perform the actual save */
  save(): void {
    this.saveStatus = 'saving';
    this.eventBus.emit('save:status', { status: 'saving' });
    this._onChange?.(this.contentSync.toMarkdown());
    this.saveStatus = 'saved';
    this.lastSavedAt = Date.now();
    this.eventBus.emit('save:status', { status: 'saved' });
  }

  /** Initialize keyboard shortcuts on a container element */
  attachKeyboard(el: HTMLElement | Document): void {
    this.keyboardShortcuts.attach(el);
  }

  /** Clean up all resources */
  destroy(): void {
    this.keyboardShortcuts.detach();
    if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
  }
}
