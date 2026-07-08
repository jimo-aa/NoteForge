// NoteForge — Global Plugin Registry
// Module-level singleton so both ManageModal and WysiwygEditor
// can access the same PluginManager instance.

import { PluginManager } from './PluginManager';
import { registerBuiltinPlugins } from './builtin';

let _instance: PluginManager | null = null;

/** Get (or lazy-create) the global PluginManager instance */
export function getPluginRegistry(): PluginManager {
  if (!_instance) {
    _instance = new PluginManager();
    registerBuiltinPlugins(_instance);
    // Sync-activate all core and builtin plugins
    _instance.syncActivateAll();
  }
  return _instance;
}

/** Reset the registry (useful for testing) */
export function resetPluginRegistry(): void {
  _instance = null;
}
