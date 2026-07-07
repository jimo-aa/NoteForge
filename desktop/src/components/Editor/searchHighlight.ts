// NoteForge — TipTap Search Highlight Extension
// Highlights matching text when searchQuery prop changes.

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const searchHighlightKey = new PluginKey('search-highlight');

export function createSearchHighlightPlugin(searchQuery: string): Plugin {
  return new Plugin({
    key: searchHighlightKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr) {
        const doc = tr.doc;
        if (!doc) return DecorationSet.empty;

        if (!searchQuery) return DecorationSet.empty;

        const decorations: Decoration[] = [];
        const query = searchQuery.toLowerCase();

        doc.descendants((node, pos) => {
          if (!node.isText) return;

          const text = node.text?.toLowerCase() ?? '';
          let index = 0;

          while ((index = text.indexOf(query, index)) !== -1) {
            const from = pos + index;
            const to = from + query.length;
            decorations.push(
              Decoration.inline(from, to, {
                class: 'search-highlight',
                style: 'background-color: rgba(255, 213, 0, 0.35); border-bottom: 2px solid rgba(255, 183, 0, 0.7); border-radius: 2px;',
              }),
            );
            index += query.length;
          }
        });

        return DecorationSet.create(doc, decorations);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}
