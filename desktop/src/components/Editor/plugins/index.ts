// NoteForge — Plugin Module Barrel Export
// Exports the plugin system: types, PluginManager, PluginAPI, and built-in plugin factories.

export { PluginManager } from './PluginManager';
export { createPluginContext } from './PluginAPI';
export { BUILTIN_PLUGINS, registerBuiltinPlugins, coreExtensionsPlugin } from './builtin';
export type {
  EditorPlugin,
  PluginContext,
  PluginStore,
  PluginHooks,
  PluginMeta,
  PluginPhase,
  ToolbarItemDef,
  SlashCommandDef,
} from './types';
