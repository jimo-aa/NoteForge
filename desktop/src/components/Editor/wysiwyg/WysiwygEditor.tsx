// NoteForge — WYSIWYG Editor (TipTap)
// Clean TipTap wrapper that uses the extension registry.
// Extracted from the legacy RichTextEditor.tsx.

import {
  useImperativeHandle,
  forwardRef,
  useRef,
  useEffect,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { getAllExtensions } from './extensions';
import { markdownToHtml, htmlToMarkdown } from '../converters';
import type { EditorHandle } from '../types/editor';

interface WysiwygEditorProps {
  initialContent: string;
  onChange: (text: string) => void;
  onSelectionChange?: (from: number, to: number, selectedText?: string) => void;
  placeholderText?: string;
  searchQuery?: string;
}

export const WysiwygEditor = forwardRef<EditorHandle, WysiwygEditorProps>(
  function WysiwygEditor(
    { initialContent, onChange, onSelectionChange, placeholderText = '...', searchQuery },
    ref,
  ) {
    const editorRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;

    const editor = useEditor({
      extensions: getAllExtensions(placeholderText, searchQuery),
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
          class: 'rich-editor-content prose prose-sm max-w-none',
        },
        handleDOMEvents: {
          dragover: () => false,
        },
      },
    });

    // Keep ref in sync
    editorRef.current = editor;

    // Sync initial content on first load
    useEffect(() => {
      if (editor && initialContent) {
        const currentHtml = editor.getHTML();
        const expectedHtml = markdownToHtml(initialContent);
        if (currentHtml !== expectedHtml && currentHtml === '<p></p>') {
          editor.commands.setContent(expectedHtml);
        }
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Add line numbers to code blocks
    useEffect(() => {
      if (!editor) return;
      const updateLineNumbers = () => {
        editor.view.dom.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
          const code = pre.querySelector('code');
          if (!code) return;
          const text = code.textContent || '';
          const lineCount = text.split('\n').length;
          const nums = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n');
          pre.setAttribute('data-line-nums', nums);
        });
      };
      requestAnimationFrame(updateLineNumbers);
      const observer = new MutationObserver(() => requestAnimationFrame(updateLineNumbers));
      observer.observe(editor.view.dom, { childList: true, subtree: true, characterData: true });
      return () => observer.disconnect();
    }, [editor]);

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
        // TipTap doesn't expose raw setSelection easily
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

    return (
      <div className="rich-editor wysiwyg-mode" style={{ width: '100%', height: '100%' }}>
        <EditorContent editor={editor} className="rich-editor-wysiwyg" />
      </div>
    );
  },
);
