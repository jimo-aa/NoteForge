// NoteForge — Custom TipTap Extensions for Non-Standard Markdown Syntax
// These extensions enable the WYSIWYG editor to preserve and render
// custom HTML elements that the markdown converter outputs (callouts,
// tags, collapsible details, table alignment, mermaid, math formulas).
//
// Each extension defines parseHTML / renderHTML rules so TipTap can
// recognize the HTML produced by utils/markdown.ts and output the
// same HTML for roundtrip consistency.

import { Node, Mark, Extension, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MermaidNodeView } from './MermaidView';
import { MathBlockNodeView } from './MathView';

// ── Debug helper ──
const debugTag = '[CustomExt]';
function dbg(...args: unknown[]) {
  console.debug(debugTag, ...args);
}

// ── Tag Mark ──────────────────────────────────────────────────────
export const TagMark = Mark.create({
  name: 'tag',
  priority: 90,
  keepOnSplit: false,
  inclusive: false,
  exitable: true,

  addAttributes() {
    return { class: { default: 'tag' } };
  },

  parseHTML() {
    dbg('TagMark.parseHTML called');
    return [{ tag: 'span.tag' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'tag' }), 0];
  },
});

// ── Callout Node ──────────────────────────────────────────────────
export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block*',
  defining: true,

  addAttributes() {
    return {
      'data-callout-type': {
        default: 'note',
        parseHTML: (el) => {
          const cls = Array.from(el.classList).find((c) => c.startsWith('callout-'));
          return cls ? cls.replace('callout-', '') : 'note';
        },
      },
    };
  },

  parseHTML() {
    dbg('CalloutNode.parseHTML called');
    return [{ tag: 'div.callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-callout-type'] || 'note';
    return ['div', { class: `callout callout-${type}` }, 0];
  },
});

// ── Collapsible Details Node ──────────────────────────────────────
export const DetailsNode = Node.create({
  name: 'details',
  group: 'block',
  content: 'block*',
  defining: true,

  addAttributes() {
    return {
      'data-summary': {
        default: '',
        parseHTML: (el) => el.querySelector('summary')?.textContent ?? '',
      },
    };
  },

  parseHTML() {
    dbg('DetailsNode.parseHTML called');
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    const summaryText = HTMLAttributes['data-summary'] || '展开';
    return [
      'details',
      {},
      ['summary', {}, summaryText],
      ['div', { class: 'details-content' }, 0],
    ];
  },
});

// ── Table Cell Alignment ──────────────────────────────────────────
export const TableCellAlignment = Extension.create({
  name: 'tableCellAlignment',

  addGlobalAttributes() {
    return [
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          textAlign: {
            default: 'left',
            parseHTML: (el) => {
              const cls = Array.from(el.classList).find((c) => c.startsWith('ta-'));
              return cls ? cls.replace('ta-', '') : (el.getAttribute('align') || 'left');
            },
            renderHTML: (attrs) => {
              if (!attrs.textAlign || attrs.textAlign === 'left') return {};
              return { style: `text-align: ${attrs.textAlign}` };
            },
          },
        },
      },
    ];
  },
});

// ── Mermaid Diagram Node (atom) ───────────────────────────────────
// Preserves <div class="mermaid-block"><pre class="mermaid-src">code</pre>
// <div class="mermaid-placeholder">...</div></div> from
// utils/markdown.ts lines 115-119. Rendered as a placeholder in
// WYSIWYG mode. After the editor DOM is ready, a separate effect
// in WysiwygEditor replaces the placeholder with the rendered SVG.

export const MermaidNode = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (el) => {
          const pre = el.querySelector('pre.mermaid-src');
          const src = pre?.textContent || '';
          dbg('MermaidNode.parseHTML — source length:', src.length);
          return src;
        },
      },
    };
  },

  parseHTML() {
    dbg('MermaidNode.parseHTML — matching div.mermaid-block');
    return [{ tag: 'div.mermaid-block' }];
  },

  renderHTML({ HTMLAttributes }) {
    const source = HTMLAttributes.source || '';
    return ['div', { class: 'mermaid-block' }, ['pre', { class: 'mermaid-src' }, source], ['div', {}, 'Mermaid']];
  },

  // NodeView takes over rendering in the editor (ProseMirror won't overwrite)
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});

// ── Block Math Node (atom) ────────────────────────────────────────
// Preserves <div class="math-block" data-latex="...">...</div> from
// utils/markdown.ts lines 126. Renders as a placeholder in WYSIWYG
// mode; replaced with KaTeX output by an effect in WysiwygEditor.

export const MathBlockNode = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => {
          const latex = el.getAttribute('data-latex') || '';
          dbg('MathBlockNode.parseHTML — latex length:', latex.length);
          return latex;
        },
      },
    };
  },

  parseHTML() {
    dbg('MathBlockNode.parseHTML — matching div.math-block');
    return [{ tag: 'div.math-block' }];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = HTMLAttributes.latex || '';
    return ['div', { class: 'math-block' }, `∫ ${latex}`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockNodeView);
  },
});

// ── Inline Math Mark ──────────────────────────────────────────────
// Preserves <span class="math-inline" data-latex="...">...</span>
// from utils/markdown.ts lines 143.

export const MathInlineMark = Mark.create({
  name: 'mathInline',
  priority: 90,
  keepOnSplit: false,
  inclusive: false,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => {
          const latex = el.getAttribute('data-latex') || '';
          dbg('MathInlineMark.parseHTML — latex:', latex.slice(0, 50));
          return latex;
        },
      },
    };
  },

  parseHTML() {
    dbg('MathInlineMark.parseHTML — matching span.math-inline');
    return [{ tag: 'span.math-inline' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { class: 'math-inline', 'data-latex': HTMLAttributes.latex }, 0];
  },
});
