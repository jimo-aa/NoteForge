// NoteForge — Plugin API Runtime
// Provides the PluginContext implementation given to each plugin.

import type { PluginContext, PluginStore, ToolbarItemDef, SlashCommandDef } from './types';

const STORE_PREFIX = 'noteforge:plugin';

/**
 * Create a localStorage-backed plugin store for a given plugin ID.
 */
function createPluginStore(pluginId: string): PluginStore {
  return {
    get: <T>(key: string): T | undefined => {
      try {
        const raw = localStorage.getItem(`${STORE_PREFIX}:${pluginId}:${key}`);
        if (raw === null) return undefined;
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    set: <T>(key: string, value: T): void => {
      try {
        localStorage.setItem(`${STORE_PREFIX}:${pluginId}:${key}`, JSON.stringify(value));
      } catch { /* quota exceeded — silently ignore */ }
    },
    remove: (key: string): void => {
      try {
        localStorage.removeItem(`${STORE_PREFIX}:${pluginId}:${key}`);
      } catch { /* ignore */ }
    },
  };
}

/**
 * Build a PluginContext for a given plugin ID.
 *
 * @param pluginId - The plugin's unique identifier (for scoped storage)
 * @param getEditor - Lazy accessor for the current TipTap editor instance
 * @param callbacks - Mutable references for registration callbacks
 */
export function createPluginContext(
  pluginId: string,
  getEditor: () => any | null,
  callbacks: {
    onRegisterToolbarItem: (item: ToolbarItemDef) => void;
    onRegisterSlashCommand: (cmd: SlashCommandDef) => void;
    onRegisterExtension: (ext: any) => void;
    onAddKeyboardShortcut: (key: string, handler: () => boolean) => void;
  },
): PluginContext {
  return {
    get editor() {
      return getEditor();
    },
    store: createPluginStore(pluginId),
    registerToolbarItem: (item: ToolbarItemDef) => callbacks.onRegisterToolbarItem(item),
    registerSlashCommand: (cmd: SlashCommandDef) => callbacks.onRegisterSlashCommand(cmd),
    registerExtension: (ext: any) => callbacks.onRegisterExtension(ext),
    addKeyboardShortcut: (key: string, handler: () => boolean) => callbacks.onAddKeyboardShortcut(key, handler),
  };
}
