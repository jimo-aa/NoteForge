// NoteForge — Mode Manager (Simplified)
// Editor currently operates in source+preview dual-pane mode only.
// Retained as placeholder for future: reading mode, focus mode, etc.

export class ModeManager {
  private _mode = 'source';

  get mode(): string {
    return this._mode;
  }
}

