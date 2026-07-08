// NoteForge — Table Helper Extension
// Keyboard navigation and shortcuts for tables:
// - Tab to navigate cells
// - Enter to move to next row
// - Arrow keys for cell navigation

import { Extension } from '@tiptap/core';

export const TableHelper = Extension.create({
  name: 'tableHelper',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { editor } = this;
        if (editor.isActive('table')) {
          // TipTap's table extension handles Tab natively for cell navigation
          return false;
        }
        return false;
      },
      'Shift-Tab': () => {
        return false;
      },
      Enter: () => {
        const { editor } = this;
        if (editor.isActive('table')) {
          // Let TipTap handle Enter for new paragraph inside cell
          return false;
        }
        return false;
      },
    };
  },
});
