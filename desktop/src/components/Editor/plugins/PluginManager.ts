// NoteForge — Plugin Manager
// Central registry for editor plugins. Handles registration,
// activation, deactivation, and provides aggregated extensions/commands.

import type { EditorPlugin, ToolbarItemDef, SlashCommandDef, PluginHooks } from './types';
import { createPluginContext } from './PluginAPI';

type RegistrationCallback = {
  onRegisterToolbarItem: (item: ToolbarItemDef) => void;
  onRegisterSlashCommand: (cmd: SlashCommandDef) => void;
  onRegisterExtension: (ext: any) => void;
  onAddKeyboardShortcut: (key: string, handler: () => boolean) => void;
};

/**
 * PluginManager — the central coordinator for all editor plugins.
 *
 * Responsibilities:
 * - Register/unregister plugins
 * - Activate/deactivate plugins with lifecycle management
 * - Aggregate extensions, toolbar items, slash commands across all active plugins
 * - Run hooks across all active plugins
 */
export class PluginManager {
  private _registry = new Map<string, EditorPlugin>();
  private _active = new Set<string>();
  private _extensions: any[] = [];
  private _toolbarItems: ToolbarItemDef[] = [];
  private _slashCommands: SlashCommandDef[] = [];
  private _keyboardShortcuts: Record<string, () => boolean> = {};

  /** Lazy accessor for the current TipTap editor instance (set externally) */
  getEditor: () => any | null = () => null;

  /** Callbacks to notify the host when registrations happen */
  onExtensionsChanged: ((exts: any[]) => void) | null = null;
  onToolbarItemsChanged: ((items: ToolbarItemDef[]) => void) | null = null;
  onSlashCommandsChanged: ((cmds: SlashCommandDef[]) => void) | null = null;

  // ── Registration ──

  /** Register a plugin (does NOT activate it automatically) */
  register(plugin: EditorPlugin): void {
    if (this._registry.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin "${plugin.id}" is already registered. Skipping.`);
      return;
    }
    this._registry.set(plugin.id, plugin);
  }

  /** Unregister a plugin (deactivates first if active) */
  unregister(id: string): void {
    if (this._active.has(id)) {
      this.deactivate(id);
    }
    this._registry.delete(id);
  }

  /** Check if a plugin is registered */
  has(id: string): boolean {
    return this._registry.has(id);
  }

  /** Get a registered plugin by ID */
  get(id: string): EditorPlugin | undefined {
    return this._registry.get(id);
  }

  /** List all registered plugin IDs */
  list(): string[] {
    return Array.from(this._registry.keys());
  }

  /** List currently active plugin IDs */
  get active(): string[] {
    return Array.from(this._active);
  }

  // ── Activation / Deactivation ──

  /** Activate a registered plugin by ID */
  async activate(id: string): Promise<void> {
    const plugin = this._registry.get(id);
    if (!plugin) {
      console.warn(`[PluginManager] Cannot activate unknown plugin "${id}"`);
      return;
    }
    if (this._active.has(id)) return; // already active

    // Check dependencies
    if (plugin.meta?.dependencies) {
      for (const depId of plugin.meta.dependencies) {
        if (!this._active.has(depId)) {
          await this.activate(depId);
        }
      }
    }

    this._active.add(id);

    // Build registration callbacks (names must match createPluginContext)
    const callbacks: RegistrationCallback = {
      onRegisterToolbarItem: (item) => {
        this._toolbarItems.push(item);
        this.onToolbarItemsChanged?.(this._toolbarItems);
      },
      onRegisterSlashCommand: (cmd) => {
        this._slashCommands.push(cmd);
        this.onSlashCommandsChanged?.(this._slashCommands);
      },
      onRegisterExtension: (ext) => {
        this._extensions.push(ext);
        this.onExtensionsChanged?.(this._extensions);
      },
      onAddKeyboardShortcut: (key, handler) => {
        this._keyboardShortcuts[key] = handler;
      },
    };

    // Create runtime context
    const ctx = createPluginContext(id, () => this.getEditor(), callbacks);

    // Register static contributions (handle ext being single or array)
    if (plugin.extensions) {
      const exts = Array.isArray(plugin.extensions) ? plugin.extensions : [plugin.extensions];
      for (const ext of exts) {
        if (ext) this._extensions.push(ext);
      }
      this.onExtensionsChanged?.(this._extensions);
    }
    if (plugin.toolbarItems) {
      this._toolbarItems.push(...plugin.toolbarItems);
      this.onToolbarItemsChanged?.(this._toolbarItems);
    }
    if (plugin.slashCommands) {
      this._slashCommands.push(...plugin.slashCommands);
      this.onSlashCommandsChanged?.(this._slashCommands);
    }
    if (plugin.keyboardShortcuts) {
      Object.assign(this._keyboardShortcuts, plugin.keyboardShortcuts);
    }

    // Call lifecycle hook
    try {
      await plugin.onActivate?.(ctx);
    } catch (err) {
      console.error(`[PluginManager] Plugin "${id}" onActivate failed:`, err);
    }
  }

  /** Deactivate an active plugin */
  async deactivate(id: string): Promise<void> {
    const plugin = this._registry.get(id);
    if (!plugin || !this._active.has(id)) return;

    this._active.delete(id);

    // Call lifecycle hook
    try {
      await plugin.onDeactivate?.(createPluginContext(id, () => this.getEditor(), {
        onRegisterToolbarItem: () => {},
        onRegisterSlashCommand: () => {},
        onRegisterExtension: () => {},
        onAddKeyboardShortcut: () => {},
      }));
    } catch (err) {
      console.error(`[PluginManager] Plugin "${id}" onDeactivate failed:`, err);
    }

    // Rebuild aggregations from remaining active plugins
    this._rebuild();
  }

  /** Activate all registered core and builtin plugins (async) */
  async activateAll(): Promise<void> {
    const ids = this.list();
    for (const id of ids) {
      const plugin = this._registry.get(id);
      if (plugin && plugin.meta?.phase === 'lazy') continue;
      await this.activate(id);
    }
  }

  /** Synchronously mark plugins as active (for plugins without async onActivate) */
  syncActivateAll(): void {
    for (const id of this.list()) {
      const plugin = this._registry.get(id);
      if (!plugin || this._active.has(id)) continue;
      if (plugin.meta?.phase === 'lazy') continue;

      // Check dependencies
      if (plugin.meta?.dependencies) {
        for (const depId of plugin.meta.dependencies) {
          if (!this._active.has(depId)) {
            // Activate dependency synchronously
            const dep = this._registry.get(depId);
            if (dep && dep.meta?.phase !== 'lazy') {
              this._active.add(depId);
              dep.onActivate?.(createPluginContext(depId, () => this.getEditor(), {
                onRegisterToolbarItem: () => {},
                onRegisterSlashCommand: () => {},
                onRegisterExtension: () => {},
                onAddKeyboardShortcut: () => {},
              }));
            }
          }
        }
      }

      this._active.add(id);

      // Register static contributions
      if (plugin.extensions) {
        const exts = Array.isArray(plugin.extensions) ? plugin.extensions : [plugin.extensions];
        for (const ext of exts) {
          if (ext) this._extensions.push(ext);
        }
      }
      if (plugin.toolbarItems) {
        this._toolbarItems.push(...plugin.toolbarItems);
      }
      if (plugin.slashCommands) {
        this._slashCommands.push(...plugin.slashCommands);
      }
      if (plugin.keyboardShortcuts) {
        Object.assign(this._keyboardShortcuts, plugin.keyboardShortcuts);
      }

      // Call lifecycle hook (fire async if it returns a promise)
      try {
        const result = plugin.onActivate?.(createPluginContext(id, () => this.getEditor(), {
          onRegisterToolbarItem: (item) => { this._toolbarItems.push(item); this.onToolbarItemsChanged?.(this._toolbarItems); },
          onRegisterSlashCommand: (cmd) => { this._slashCommands.push(cmd); this.onSlashCommandsChanged?.(this._slashCommands); },
          onRegisterExtension: (ext) => { this._extensions.push(ext); this.onExtensionsChanged?.(this._extensions); },
          onAddKeyboardShortcut: (key, handler) => { this._keyboardShortcuts[key] = handler; },
        }));
        if (result instanceof Promise) {
          result.catch((err) => console.error(`[PluginManager] Plugin "${id}" onActivate failed:`, err));
        }
      } catch (err) {
        console.error(`[PluginManager] Plugin "${id}" onActivate failed:`, err);
      }
    }

    this.onExtensionsChanged?.(this._extensions);
    this.onToolbarItemsChanged?.(this._toolbarItems);
    this.onSlashCommandsChanged?.(this._slashCommands);
  }

  // ── Aggregation queries ──

  /** Get all TipTap extensions from active plugins (flat array) */
  getAllExtensions(): any[] {
    return [...this._extensions];
  }

  /** Get all toolbar items from active plugins */
  getAllToolbarItems(): ToolbarItemDef[] {
    return [...this._toolbarItems];
  }

  /** Get all slash commands from active plugins */
  getAllSlashCommands(): SlashCommandDef[] {
    return [...this._slashCommands];
  }

  /** Get merged keyboard shortcuts from active plugins */
  getKeyboardShortcuts(): Record<string, () => boolean> {
    return { ...this._keyboardShortcuts };
  }

  /** Run a hook synchronously across all active plugins (returns only sync results) */
  runHookSync<K extends keyof PluginHooks>(
    hook: K,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): ReturnType<NonNullable<PluginHooks[K]>>[] {
    const results: ReturnType<NonNullable<PluginHooks[K]>>[] = [];
    for (const id of this._active) {
      const plugin = this._registry.get(id);
      if (!plugin?.hooks?.[hook]) continue;
      try {
        const result = (plugin.hooks[hook] as Function)(...args);
        if (result instanceof Promise) {
          // For sync call, fire promise but don't await
          result.catch((err) => console.error(`[PluginManager] Plugin "${id}" hook "${hook}" async failed:`, err));
          continue;
        }
        if (result !== undefined && result !== null) {
          results.push(result);
        }
      } catch (err) {
        console.error(`[PluginManager] Plugin "${id}" hook "${hook}" failed:`, err);
      }
    }
    return results;
  }

  /** Run a hook across all active plugins, collecting results (async) */
  async runHook<K extends keyof PluginHooks>(
    hook: K,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): Promise<ReturnType<NonNullable<PluginHooks[K]>>[]> {
    const results: ReturnType<NonNullable<PluginHooks[K]>>[] = [];
    for (const id of this._active) {
      const plugin = this._registry.get(id);
      if (!plugin?.hooks?.[hook]) continue;
      try {
        const result = await (plugin.hooks[hook] as Function)(...args);
        if (result !== undefined && result !== null) {
          results.push(result);
        }
      } catch (err) {
        console.error(`[PluginManager] Plugin "${id}" hook "${hook}" failed:`, err);
      }
    }
    return results;
  }

  // ── Internal ──

  /** Rebuild aggregated collections from all active plugins */
  private _rebuild(): void {
    this._extensions = [];
    this._toolbarItems = [];
    this._slashCommands = [];
    this._keyboardShortcuts = {};

    for (const id of this._active) {
      const plugin = this._registry.get(id);
      if (!plugin) continue;
      if (plugin.extensions) {
        const exts = Array.isArray(plugin.extensions) ? plugin.extensions : [plugin.extensions];
        for (const ext of exts) {
          if (ext) this._extensions.push(ext);
        }
      }
      if (plugin.toolbarItems) this._toolbarItems.push(...plugin.toolbarItems);
      if (plugin.slashCommands) this._slashCommands.push(...plugin.slashCommands);
      if (plugin.keyboardShortcuts) Object.assign(this._keyboardShortcuts, plugin.keyboardShortcuts);
    }

    this.onExtensionsChanged?.(this._extensions);
    this.onToolbarItemsChanged?.(this._toolbarItems);
    this.onSlashCommandsChanged?.(this._slashCommands);
  }

  /** Remove a previously registered extension from the aggregated list */
  removeExtension(ext: any): void {
    const idx = this._extensions.indexOf(ext);
    if (idx >= 0) {
      this._extensions.splice(idx, 1);
      this.onExtensionsChanged?.(this._extensions);
    }
  }

  /** Remove a previously registered toolbar item */
  removeToolbarItem(id: string): void {
    this._toolbarItems = this._toolbarItems.filter((i) => i.id !== id);
    this.onToolbarItemsChanged?.(this._toolbarItems);
  }

  /** Remove a previously registered slash command */
  removeSlashCommand(id: string): void {
    this._slashCommands = this._slashCommands.filter((c) => c.id !== id);
    this.onSlashCommandsChanged?.(this._slashCommands);
  }
}
