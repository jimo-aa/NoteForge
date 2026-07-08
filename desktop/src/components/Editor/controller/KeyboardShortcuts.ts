// NoteForge — Keyboard Shortcuts Manager
// Central registry for editor keyboard shortcuts.
// Delegates to the app-level shortcut system where applicable.

type ShortcutHandler = (e: KeyboardEvent) => boolean | void;
type ShortcutMap = Record<string, ShortcutHandler>;

export class KeyboardShortcuts {
  private shortcuts: ShortcutMap = {};
  private disposables: Array<() => void> = [];

  /** Register one or more keyboard shortcuts */
  register(shortcuts: ShortcutMap): void {
    Object.assign(this.shortcuts, shortcuts);
  }

  /** Unregister specific shortcuts by key */
  unregister(keys: string[]): void {
    for (const key of keys) {
      delete this.shortcuts[key];
    }
  }

  /** Start listening. Returns the bound handler (useful for React event integration). */
  attach(el: HTMLElement | Document = document): (e: Event) => void {
    const handler = (e: Event) => {
      const ke = e as KeyboardEvent;
      const key = this.keyFromEvent(ke);
      const action = this.shortcuts[key];
      if (action) {
        const result = action(ke);
        if (result !== false) {
          ke.preventDefault();
          ke.stopPropagation();
        }
      }
    };
    el.addEventListener('keydown', handler);
    this.disposables.push(() => el.removeEventListener('keydown', handler));
    return handler;
  }

  /** Stop listening and clean up */
  detach(): void {
    this.disposables.forEach((d) => d());
    this.disposables = [];
  }

  /** Build a key string from a KeyboardEvent for matching */
  private keyFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    return parts.join('+');
  }

  /** Get all registered shortcuts */
  getShortcuts(): ShortcutMap {
    return { ...this.shortcuts };
  }

  /** Create a pre-configured instance with editor default shortcuts */
  static createDefault(): KeyboardShortcuts {
    const kb = new KeyboardShortcuts();
    kb.register({
      // These are app-level shortcuts — just placeholders for the editor context
      'Ctrl+S': () => { document.dispatchEvent(new CustomEvent('noteforge:save')); },
      'Escape': () => { document.dispatchEvent(new CustomEvent('noteforge:escape')); },
    });
    return kb;
  }
}
