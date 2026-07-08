// NoteForge — Editor Module Barrel Export
// Provides a clean API surface for the entire editor module.

// ── Main components ──
export { EditorContainer } from './EditorContainer';

// ── UI Components ──
export { EditorToolbar } from './EditorToolbar';
export { EditorTabs } from './EditorTabs';
export { DocumentHeader } from './DocumentHeader';
export { StatusBar } from './StatusBar';

// ── Editor engine ──
export { SourceEditor } from './source/SourceEditor';

// ── Controller ──
export { EditorController, ContentSync, EventBus, eventBus, KeyboardShortcuts } from './controller';

// ── Converters ──
export { markdownToHtml, htmlToMarkdown, sanitizeHtml, sanitizeForPreview } from './converters';

// ── Types ──
export type {
  EditorMode,
  SaveStatus,
  EditorSelection,
  EditorHandle,
  SearchMatchInfo,
  ToolbarAction,
} from './types/editor';

export type {
  SlashCommandItem,
  EditorExtensionDescriptor,
} from './types/extensions';

export type {
  EditorEventMap,
  EventHandler,
  Unsubscribe,
} from './types/events';

// ── Extensions ──
export { getCoreExtensions, getBuiltinExtensions, getAllExtensions } from './wysiwyg/extensions';
export { getSlashCommands } from './wysiwyg/extensions/SlashMenu';

// ── Legacy re-exports (backward compat) ──
export { Editor } from './Editor';
