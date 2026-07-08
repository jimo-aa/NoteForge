// NoteForge — Task Checkbox Extension
// Enhances task list items with clickable checkbox toggle in WYSIWYG mode.

import { Extension } from '@tiptap/core';

export const TaskCheckbox = Extension.create({
  name: 'taskCheckbox',

  addGlobalAttributes() {
    return [
      {
        types: ['taskItem'],
        attributes: {
          checked: {
            default: false,
            parseHTML: (el) => el.getAttribute('data-checked') === 'true',
            renderHTML: (attrs) => {
              if (!attrs.checked) return {};
              return { 'data-checked': 'true' };
            },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        const { editor } = this;
        if (editor.isActive('taskItem')) {
          editor.chain().focus().toggleTaskList().run();
          return true;
        }
        return false;
      },
    };
  },
});
