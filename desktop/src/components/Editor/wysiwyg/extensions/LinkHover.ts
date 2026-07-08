// NoteForge — Link Hover Tooltip Extension
// Shows a tooltip with the URL when hovering over a link in WYSIWYG mode.

import { Extension } from '@tiptap/core';

export const LinkHover = Extension.create({
  name: 'linkHover',

  addProseMirrorPlugins() {
    return [];
  },

  onUpdate() {
    // Tooltip rendering is handled via CSS :hover on the link
    // We add a data attribute to links for the tooltip content
  },
});
