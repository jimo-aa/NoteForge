// React hook for global keyboard shortcuts
// Reads config from shortcutService and dispatches to action callbacks

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  getShortcuts,
  eventMatchesCombo,
  eventToCombo,
  type ShortcutDef,
} from '@/services/shortcutService';

export type ActionMap = Record<string, () => void>;

interface UseKeyboardShortcutsResult {
  /** Current shortcut definitions (with user overrides applied). */
  shortcuts: ShortcutDef[];
  /** Listen for the user's next keystroke and assign it to a shortcut. */
  startCapture: (shortcutId: string) => void;
  /** The shortcut ID currently waiting for a keystroke, or null. */
  capturingId: string | null;
  /** Temporary combo display while capturing. */
  capturePreview: string;
}

/**
 * Global keyboard shortcut hook.
 *
 * @param actions - Map of shortcutId → callback. Callbacks are stable-ref'd internally.
 * @param options.allowWhenInputFocused - Set to true for shortcuts that should fire
 *   even when the user is typing in an input/editor (default: false).
 *   These are shortcuts that should still work when typing (e.g. Escape, search).
 */
export function useKeyboardShortcuts(
  actions: ActionMap,
  allowWhenInputFocused: string[] = [],
): UseKeyboardShortcutsResult {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutDef[]>(() => getShortcuts());

  // Refresh shortcuts when storage changes
  useEffect(() => {
    const handler = () => setShortcuts(getShortcuts());
    window.addEventListener('noteforge:shortcuts-changed', handler);
    return () => window.removeEventListener('noteforge:shortcuts-changed', handler);
  }, []);

  // Global keydown listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // If we're in capture mode, capture this keystroke for the shortcut
      if (capturingId !== null) {
        e.preventDefault();
        e.stopPropagation();
        const combo = eventToCombo(e);
        // Don't allow binding bare modifier-only or empty combos
        if (
          combo.key === 'control' ||
          combo.key === 'shift' ||
          combo.key === 'alt' ||
          combo.key === 'meta' ||
          combo.key === 'escape'
        ) {
          return;
        }
        // Check for conflicts
        const existing = shortcuts.find(
          (s) => s.id !== capturingId && eventMatchesCombo(e, s.keys),
        );
        // Dispatch shortcut-changed event - the parent handles the actual update
        window.dispatchEvent(
          new CustomEvent('noteforge:shortcut-captured', {
            detail: { id: capturingId, combo, conflict: existing?.id },
          }),
        );
        setCapturingId(null);
        return;
      }

      // Check if the target is an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;

      for (const s of shortcuts) {
        if (!eventMatchesCombo(e, s.keys)) continue;

        // Skip if user is typing and this shortcut isn't in the allow-list
        if (isInput && !allowWhenInputFocused.includes(s.id)) continue;

        const action = actionsRef.current[s.id];
        if (action) {
          e.preventDefault();
          e.stopPropagation();
          action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, capturingId, allowWhenInputFocused]);

  const startCapture = useCallback((shortcutId: string) => {
    setCapturingId(shortcutId);
  }, []);

  const capturePreview = capturingId
    ? shortcuts.find((s) => s.id === capturingId)?.label ?? ''
    : '';

  return { shortcuts, startCapture, capturingId, capturePreview };
}
