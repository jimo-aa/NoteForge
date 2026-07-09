// NoteForge — TipTap Extension Registry
// Central registration point for all editor extensions.
// Extensions are grouped by loading phase: core, builtin, lazy.

import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExtension from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { Extension } from '@tiptap/core';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import type { Extensions } from '@tiptap/react';

// Re-export extension modules
export { createSearchHighlightPlugin, searchHighlightKey } from './SearchHighlight';
export { getSlashCommands } from './SlashMenu';

// ── Phase 2 built-in extensions ──
import { CodeBlockLang } from './CodeBlockLang';
import { TableHelper } from './TableHelper';
import { TaskCheckbox } from './TaskCheckbox';
import { LinkHover } from './LinkHover';
import { ImageResize } from './ImageResize';
import { createSearchHighlightPlugin } from './SearchHighlight';

// ── Custom extensions for non-standard syntax ──
import { TagMark, CalloutNode, DetailsNode, TableCellAlignment, MermaidNode, MathBlockNode, MathInlineMark } from './CustomExtensions';

const lowlight = createLowlight(common);

/** Core extensions — always loaded (Phase 1) */
export function getCoreExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false },
      underline: false, // We add Underline separately
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
      HTMLAttributes: { class: 'code-block' },
    }),
    Placeholder.configure({ placeholder: placeholder ?? '...' }),
    ImageExtension,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TextStyle,
    TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
    TableCellAlignment,
  ];
}

/** Builtin extensions — loaded on demand (Phase 2) */
export function getBuiltinExtensions(searchQuery?: string): Extensions {
  const exts: Extensions = [
    // TipTap extensions
    CodeBlockLang,
    TableHelper,
    TaskCheckbox,
    LinkHover,
    ImageResize,
    // Custom syntax extensions
    TagMark,
    CalloutNode,
    DetailsNode,
    MermaidNode,
    MathBlockNode,
    MathInlineMark,
  ];

  // Search highlight — wrapper that creates ProseMirror plugin from query
  if (searchQuery) {
    exts.push(
      Extension.create({
        name: 'searchHighlight',
        addProseMirrorPlugins() {
          return [createSearchHighlightPlugin(searchQuery!)];
        },
      }),
    );
  }

  return exts;
}

/** Get all extensions combined (for WysiwygEditor full setup) */
export function getAllExtensions(
  placeholder?: string,
  searchQuery?: string,
): Extensions {
  return [
    ...getCoreExtensions(placeholder),
    ...getBuiltinExtensions(searchQuery),
  ];
}
