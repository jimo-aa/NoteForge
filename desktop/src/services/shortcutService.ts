// NoteForge keyboard shortcut configuration service
// Manages shortcut definitions, defaults, and user overrides via localStorage

export interface KeyCombo {
  key: string;
  ctrl?: boolean;   // Cmd on macOS maps here too
  shift?: boolean;
  alt?: boolean;
}

export type ShortcutCategory = 'navigation' | 'notes' | 'editor' | 'view' | 'search';

export interface ShortcutDef {
  id: string;
  label: string;
  description: string;
  category: ShortcutCategory;
  defaultKeys: KeyCombo;
  keys: KeyCombo;  // resolved (user override ?? default)
}

const STORAGE_KEY = 'noteforge:shortcuts';

// ── Default shortcut definitions ──
const DEFAULT_DEFS: Omit<ShortcutDef, 'keys'>[] = [
  // Navigation
  { id: 'new-note', label: '新建笔记', description: '打开新建笔记对话框', category: 'navigation', defaultKeys: { key: 'n', ctrl: true } },
  { id: 'new-notebook', label: '新建笔记本', description: '打开新建笔记本对话框', category: 'navigation', defaultKeys: { key: 'n', ctrl: true, shift: true } },
  { id: 'search', label: '搜索', description: '打开全局搜索', category: 'search', defaultKeys: { key: 'k', ctrl: true } },
  { id: 'settings', label: '设置', description: '打开管理/设置', category: 'navigation', defaultKeys: { key: ',', ctrl: true } },

  // Notes
  { id: 'delete-note', label: '删除笔记', description: '删除当前笔记', category: 'notes', defaultKeys: { key: 'd', ctrl: true } },
  { id: 'toggle-favorite', label: '切换收藏', description: '收藏/取消收藏当前笔记', category: 'notes', defaultKeys: { key: 'f', ctrl: true, shift: true } },
  { id: 'toggle-pin', label: '切换固定', description: '固定/取消固定当前笔记', category: 'notes', defaultKeys: { key: 'p', ctrl: true } },
  { id: 'save-draft', label: '手动保存', description: '立即保存当前笔记草稿', category: 'notes', defaultKeys: { key: 's', ctrl: true } },
  { id: 'duplicate-note', label: '复制笔记', description: '复制当前笔记', category: 'notes', defaultKeys: { key: 'd', ctrl: true, shift: true } },

  // View
  { id: 'toggle-preview', label: '切换预览', description: '切换编辑/预览分栏', category: 'view', defaultKeys: { key: 'e', ctrl: true } },
  { id: 'toggle-graph', label: '图谱视图', description: '打开/关闭知识图谱', category: 'view', defaultKeys: { key: 'g', ctrl: true } },
  { id: 'toggle-properties', label: '笔记属性', description: '打开/关闭属性面板', category: 'view', defaultKeys: { key: 'i', ctrl: true } },
  { id: 'toggle-sidebar', label: '切换侧栏', description: '显示/隐藏侧边栏', category: 'view', defaultKeys: { key: 'b', ctrl: true } },

  // Search
  { id: 'search-advanced', label: '高级搜索', description: '打开高级搜索（版本搜索）', category: 'search', defaultKeys: { key: 'p', ctrl: true, shift: true } },
];

function comboEqual(a: KeyCombo, b: KeyCombo): boolean {
  return a.key.toLowerCase() === b.key.toLowerCase()
    && !!a.ctrl === !!b.ctrl
    && !!a.shift === !!b.shift
    && !!a.alt === !!b.alt;
}

/** Load user overrides from localStorage. */
function loadOverrides(): Record<string, KeyCombo> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Persist user overrides to localStorage. */
function saveOverrides(overrides: Record<string, KeyCombo>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch { /* ignore */ }
}

/** Build the full shortcut list, merging user overrides onto defaults. */
export function getShortcuts(): ShortcutDef[] {
  const overrides = loadOverrides();
  return DEFAULT_DEFS.map((def) => ({
    ...def,
    keys: overrides[def.id] ?? { ...def.defaultKeys },
  }));
}

/** Look up a single shortcut by ID. */
export function getShortcut(id: string): ShortcutDef | undefined {
  return getShortcuts().find((s) => s.id === id);
}

/** Update (or remove) user override for one shortcut. */
export function updateShortcut(id: string, combo: KeyCombo) {
  const overrides = loadOverrides();
  const def = DEFAULT_DEFS.find((d) => d.id === id);
  if (!def) return false;

  if (comboEqual(combo, def.defaultKeys)) {
    // If equal to default, remove override
    delete overrides[id];
  } else {
    overrides[id] = combo;
  }
  saveOverrides(overrides);
  window.dispatchEvent(new CustomEvent('noteforge:shortcuts-changed'));
  return true;
}

/** Reset a single shortcut to default. */
export function resetShortcut(id: string) {
  const overrides = loadOverrides();
  delete overrides[id];
  saveOverrides(overrides);
  window.dispatchEvent(new CustomEvent('noteforge:shortcuts-changed'));
}

/** Reset all shortcuts to defaults. */
export function resetAllShortcuts() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('noteforge:shortcuts-changed'));
}

/** Format a KeyCombo as a display string (e.g. "⌘N", "⌘⇧F"). */
export function formatKeyCombo(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push('⌘');
  if (combo.shift) parts.push('⇧');
  if (combo.alt) parts.push('⌥');
  const key = combo.key.length === 1 ? combo.key.toUpperCase() : combo.key;
  parts.push(key);
  return parts.join('');
}

/** Format a KeyCombo as a platform-neutral label (e.g. "Ctrl+N", "Ctrl+Shift+N"). */
export function formatKeyComboLabel(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.shift) parts.push('Shift');
  if (combo.alt) parts.push('Alt');
  const key = combo.key.length === 1 ? combo.key.toUpperCase() : combo.key;
  parts.push(key);
  return parts.join('+');
}

/** Parse a KeyboardEvent into a KeyCombo (normalized). */
export function eventToCombo(e: KeyboardEvent): KeyCombo {
  return {
    key: e.key.toLowerCase(),
    ctrl: e.metaKey || e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}

/** Check if a KeyboardEvent matches a KeyCombo. */
export function eventMatchesCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  return e.key.toLowerCase() === combo.key.toLowerCase()
    && (e.metaKey || e.ctrlKey) === !!combo.ctrl
    && e.shiftKey === !!combo.shift
    && e.altKey === !!combo.alt;
}

/** Check if a combo is already taken by another shortcut (excluding the given id). */
export function isComboTaken(combo: KeyCombo, excludeId?: string): ShortcutDef | undefined {
  return getShortcuts().find((s) => s.id !== excludeId && comboEqual(s.keys, combo));
}
