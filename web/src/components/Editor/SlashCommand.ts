'use client';

import { Extension } from '@tiptap/core';
import type { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: import('@tiptap/react').Editor }) => void;
}

export const slashCommands: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large heading',
    icon: 'H1',
    command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium heading',
    icon: 'H2',
    command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small heading',
    icon: 'H3',
    command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Create a bullet list',
    icon: '•',
    command: ({ editor }) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Ordered List',
    description: 'Create an ordered list',
    icon: '1.',
    command: ({ editor }) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Blockquote',
    description: 'Add a blockquote',
    icon: '"',
    command: ({ editor }) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Add a code block',
    icon: '</>',
    command: ({ editor }) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Table',
    description: 'Insert a table',
    icon: '▦',
    command: ({ editor }) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Divider',
    description: 'Add a horizontal rule',
    icon: '—',
    command: ({ editor }) => editor.chain().focus().setHorizontalRule().run(),
  },
];

export function createSlashCommandExtension(pluginKey: PluginKey) {
  return Extension.create({
    name: 'slash-command',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey,
          char: '/',
          command: ({ editor, range, props }) => {
            const item = props as SlashCommandItem;
            if (item) {
              editor.chain().focus().deleteRange(range).run();
              item.command({ editor });
            }
          },
          items: ({ query }: { query: string }) => {
            return slashCommands
              .filter((item) =>
                item.title.toLowerCase().includes(query.toLowerCase()),
              )
              .slice(0, 10);
          },
          render: () => {
            let dom: HTMLDivElement | null = null;
            let items: SlashCommandItem[] = [];
            let selectedIndex = 0;
            let onSelectCallback: ((item: SlashCommandItem) => void) | null = null;

            return {
              onStart: (props) => {
                dom = document.createElement('div');
                dom.className = 'slash-menu';
                dom.style.cssText = `
                  position: absolute;
                  background: var(--panel-2);
                  border: 1px solid var(--line-strong);
                  border-radius: 8px;
                  padding: 4px;
                  box-shadow: var(--shadow);
                  z-index: 1001;
                  min-width: 200px;
                  max-height: 300px;
                  overflow-y: auto;
                `;

                items = props.items as SlashCommandItem[];
                selectedIndex = 0;
                onSelectCallback = (item: SlashCommandItem) => {
                  props.command({ editor: props.editor, range: props.range, props: item });
                };

                renderItems();
                props.editor.view.dom.parentNode?.appendChild(dom);
              },

              onUpdate: (props) => {
                items = props.items as SlashCommandItem[];
                selectedIndex = 0;
                renderItems();
              },

              onKeyDown: (props) => {
                if (props.event.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % items.length;
                  renderItems();
                  return true;
                }
                if (props.event.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                  renderItems();
                  return true;
                }
                if (props.event.key === 'Enter') {
                  if (items[selectedIndex]) {
                    onSelectCallback?.(items[selectedIndex]);
                  }
                  return true;
                }
                return false;
              },

              onExit: () => {
                dom?.remove();
                dom = null;
              },
            };

            function renderItems() {
              if (!dom) return;
              dom.innerHTML = '';
              items.forEach((item, index) => {
                const btn = document.createElement('button');
                btn.style.cssText = `
                  display: flex; align-items: center; gap: 8px; width: 100%;
                  padding: 6px 10px; border: none; border-radius: 5px;
                  background: ${index === selectedIndex ? 'var(--accent)' : 'transparent'};
                  color: ${index === selectedIndex ? '#fff' : 'var(--text-soft)'};
                  font-size: 12px; cursor: pointer; text-align: left;
                `;
                btn.innerHTML = `
                  <span style="font-size:14px;width:20px;text-align:center">${item.icon}</span>
                  <span><strong>${item.title}</strong><br/><span style="font-size:10px;opacity:0.7">${item.description}</span></span>
                `;
                btn.onmousedown = (e) => {
                  e.preventDefault();
                  onSelectCallback?.(item);
                };
                btn.onmouseenter = () => {
                  selectedIndex = index;
                  renderItems();
                };
                dom!.appendChild(btn);
              });
            }
          },
        }),
      ];
    },
  });
}
