// NoteForge — Plugin System Types
// Core type definitions for the extensible plugin architecture.

/** Toolbar item definition contributed by a plugin */
export interface ToolbarItemDef {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  active?: boolean;
  tooltip?: string;
}

/** Slash command definition contributed by a plugin */
export interface SlashCommandDef {
  id: string;
  title: string;
  desc: string;
  category: string;
  /** The literal keyword that triggers this command in /-menu (e.g. 'table', 'code') */
  keyword?: string;
  execute: (props: { editor: any }) => void;
}

/** Hook points that plugins can intercept */
export interface PluginHooks {
  /** Called before content is output from the editor */
  onBeforeOutput?: (html: string) => string | Promise<string>;
  /** Called after content is loaded into the editor */
  onAfterLoad?: (markdown: string) => string | Promise<string>;
  /** Custom Markdown → HTML transformation (return null to skip) */
  onMarkdownToHtml?: (md: string) => string | null;
  /** Custom HTML → Markdown transformation (return null to skip) */
  onHtmlToMarkdown?: (html: string) => string | null;
  /** Called when editor content changes */
  onChange?: (content: string) => void | Promise<void>;
  /** Called on editor save */
  onSave?: (content: string) => void | Promise<void>;
}

/** Plugin store for persisting plugin-specific config */
export interface PluginStore {
  get: <T>(key: string) => T | undefined;
  set: <T>(key: string, value: T) => void;
  remove: (key: string) => void;
}

/** Runtime context provided to each plugin */
export interface PluginContext {
  /** The current TipTap editor instance (may be null before initialization) */
  editor: any | null;
  /** Storage for plugin configuration (localStorage-backed) */
  store: PluginStore;
  /** Register a toolbar button contributed by this plugin */
  registerToolbarItem: (item: ToolbarItemDef) => void;
  /** Register a slash command */
  registerSlashCommand: (cmd: SlashCommandDef) => void;
  /** Register a TipTap extension */
  registerExtension: (ext: any) => void;
  /** Add a keyboard shortcut */
  addKeyboardShortcut: (key: string, handler: () => boolean) => void;
}

/** Plugin lifecycle phases */
export type PluginPhase = 'core' | 'builtin' | 'lazy' | 'third-party';

/** Plugin loading strategy */
export interface PluginMeta {
  phase: PluginPhase;
  lazy?: boolean; // true = loaded on demand
  dependencies?: string[];
}

/** Core plugin interface */
export interface EditorPlugin {
  /** Unique plugin identifier (e.g. 'slash-menu', 'wiki-link') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Short description */
  description?: string;
  /** Plugin metadata (phase, loading strategy) */
  meta?: PluginMeta;

  /** Called when the plugin is activated */
  onActivate?: (ctx: PluginContext) => void | Promise<void>;
  /** Called when the plugin is deactivated */
  onDeactivate?: (ctx: PluginContext) => void | Promise<void>;

  /** TipTap extensions contributed by this plugin (single or array) */
  extensions?: any | any[];

  /** Toolbar items contributed by this plugin */
  toolbarItems?: ToolbarItemDef[];
  /** Slash commands contributed by this plugin */
  slashCommands?: SlashCommandDef[];
  /** Keyboard shortcuts contributed by this plugin */
  keyboardShortcuts?: Record<string, () => boolean>;

  /** Hook interceptions */
  hooks?: PluginHooks;
}
