// NoteForge — WYSIWYG Editor (TipTap)
// Typora-like WYSIWYG markdown editor — renders markdown as rich text inline.
// Markdown syntax characters are hidden; content appears as rendered HTML.
// Uses the same styling as the dual-pane preview pane for visual consistency.
// Supports PluginManager integration for extensible plugin loading.

import {
  useImperativeHandle,
  forwardRef,
  useRef,
  useEffect,
  useState,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { getAllExtensions } from './extensions';
import { markdownToHtml, htmlToMarkdown } from '../converters';
import type { EditorHandle } from '../types/editor';
import type { PluginManager } from '../plugins';

interface WysiwygEditorProps {
  noteKey?: string;
  initialContent: string;
  onChange: (text: string) => void;
  onSelectionChange?: (from: number, to: number, selectedText?: string) => void;
  placeholderText?: string;
  searchQuery?: string;
  /** Optional PluginManager for extensible plugin loading */
  pluginManager?: PluginManager;
  /** Optional extensions override (takes precedence over pluginManager) */
  extensions?: any;
}

export const WysiwygEditor = forwardRef<EditorHandle, WysiwygEditorProps>(
  function WysiwygEditor(
    { noteKey, initialContent, onChange, onSelectionChange, placeholderText = '...', searchQuery, pluginManager, extensions: extensionsProp },
    ref,
  ) {
    const editorRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;

    const [pluginExts, setPluginExts] = useState<any[]>(() =>
      pluginManager?.getAllExtensions() ?? []
    );

    // Listen for extension changes from PluginManager
    useEffect(() => {
      if (!pluginManager) return;
      const handler = (exts: any[]) => {
        setPluginExts(exts);
      };
      pluginManager.onExtensionsChanged = handler;
      return () => { pluginManager.onExtensionsChanged = null; };
    }, [pluginManager]);

    // Flatten all extensions into a single array for TipTap
    // IMPORTANT: When PluginManager is available, use ONLY its extensions
    // (which include core+builtin from builtin.ts). Do NOT also load
    // getAllExtensions() — that would duplicate every extension and crash
    // on keyed ProseMirror plugins like tableColumnResizing$.
    const editor = useEditor({
      extensions: (() => {
        if (extensionsProp) return extensionsProp;
        if (pluginManager) {
          // PluginManager already includes all core + builtin extensions
          return pluginExts.flat();
        }
        // No PluginManager: use the static registry
        return getAllExtensions(placeholderText, searchQuery);
      })(),
      content: markdownToHtml(initialContent),
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        const md = htmlToMarkdown(html);
        onChangeRef.current(md);
      },
      onSelectionUpdate: ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        const selectedText = ed.state.doc.textBetween(from, to, '\n', ' ');
        onSelectionChangeRef.current?.(from, to, selectedText);
      },
      editorProps: {
        attributes: {
          class: 'wysiwyg-editor-content',
        },
        handleDOMEvents: {
          dragover: () => false,
          // Footnote anchor links: scroll to definition instead of navigating
          click: (_view, event) => {
            const target = event.target as HTMLElement;
            const fnLink = target.closest<HTMLAnchorElement>('a.footnote-ref, a.footnote-backref');
            if (fnLink) {
              event.preventDefault();
              const href = fnLink.getAttribute('href') || '';
              // href is "#fn:xxx" or "#fnref:xxx" — find matching id in the DOM
              const el = fnLink.closest('.wysiwyg-editor-pane')?.querySelector(`[id="${href.slice(1)}"]`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (el as HTMLElement).style.outline = '2px solid var(--accent, #6a63ff)';
                setTimeout(() => { (el as HTMLElement).style.outline = ''; }, 1500);
              }
              return true;
            }
            return false;
          },
        },
      },
    });

    // Keep ref in sync
    editorRef.current = editor;

    // Sync content when noteKey changes (note switching).
    // Uses noteKey (note ID) instead of initialContent to avoid the infinite loop:
    // setContent → onUpdate → store update → initialContent changes → sync again.
    const prevNoteKeyRef = useRef('');
    useEffect(() => {
      if (!editor) return;
      const key = noteKey ?? '';
      if (key === prevNoteKeyRef.current) return;
      prevNoteKeyRef.current = key;
      console.debug('[WysiwygEditor] Content sync — noteKey:', key.slice(0, 8));
      editor.commands.setContent(markdownToHtml(initialContent ?? ''));
    }, [editor, noteKey, initialContent]);

    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus(),
      getSelection: () => {
        if (!editor) return { from: 0, to: 0 };
        const { from, to } = editor.state.selection;
        return { from, to };
      },
      getContentBeforeCursor: () => {
        if (!editor) return '';
        const { from } = editor.state.selection;
        return editor.state.doc.textBetween(0, from, '\n', ' ');
      },
      insertTextAtCursor: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
      setContent: (content: string) => {
        if (editor) {
          editor.commands.setContent(markdownToHtml(content));
        }
      },
      setSelection: () => {
        // TipTap doesn't expose raw setSelection easily;
        // cursor restoration in WYSIWYG mode is limited
      },
      getContent: () => {
        if (editor) return htmlToMarkdown(editor.getHTML());
        return '';
      },
      wrapText: (before: string, after: string) => {
        if (editor) {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, '\n', ' ');
          editor.chain().focus().insertContent(before + text + after).run();
        }
      },
    }), [editor]);

    // ── Code block enhancements: language labels + copy buttons ──
    useEffect(() => {
      if (!editor) return;
      const viewDom = editor.view.dom;

      const updateCodeBlockLabels = () => {
        viewDom.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
          const code = pre.querySelector('code');
          if (!code) return;
          const langClass = Array.from(code.classList).find((c) => c.startsWith('language-'));
          const lang = langClass ? langClass.replace('language-', '') : '';
          if (lang && !pre.hasAttribute('data-language')) {
            pre.setAttribute('data-language', lang);
          }
          if (!pre.querySelector('.code-copy-btn')) {
            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.innerHTML = '📋';
            btn.title = '复制代码';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const text = code.textContent || '';
              navigator.clipboard.writeText(text).catch(() => {});
              btn.innerHTML = '✓';
              setTimeout(() => { btn.innerHTML = '📋'; }, 1500);
            });
            pre.appendChild(btn);
          }
        });
      };

      requestAnimationFrame(updateCodeBlockLabels);
      const observer = new MutationObserver(() => requestAnimationFrame(updateCodeBlockLabels));
      observer.observe(viewDom, { childList: true, subtree: true });
      return () => observer.disconnect();
    }, [editor]);

    // ── Inline math rendering (marks use NodeViews too, but for safety scan any that slipped through) ──
    // Block Math (MathBlockNode) and Mermaid (MermaidNode) use NodeViews — they render themselves.
    // Inline math ($...$) uses a Mark which can't have a NodeView, so we scan for unrendered
    // .math-inline elements and render them via KaTeX.
    useEffect(() => {
      if (!editor) return;
      const viewDom = editor.view.dom;

      const renderInlineMath = async () => {
        const inlineMath = viewDom.querySelectorAll<HTMLElement>('.math-inline[data-latex]');
        if (inlineMath.length === 0) return;
        console.debug('[WysiwygEditor] Rendering inline math:', inlineMath.length);
        try {
          const { renderMathBlocks } = await import('@/utils/mathRenderer');
          await renderMathBlocks(viewDom);
        } catch (e) {
          console.debug('[WysiwygEditor] Inline math error:', e);
        }
      };

      const timer = setTimeout(renderInlineMath, 300);
      return () => clearTimeout(timer);
    }, [editor, noteKey]);

    return (
      <div className="wysiwyg-editor-pane" style={{ width: '100%', height: '100%' }}>
        <EditorContent editor={editor} className="wysiwyg-editor-content" />
      </div>
    );
  },
);
