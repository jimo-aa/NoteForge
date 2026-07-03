// NoteForge — Rich Text Editor (TipTap)
// Dual mode: Markdown source / WYSIWYG with table editing support.
// Can be used alongside or as a replacement for CodeMirrorEditor.

import { useCallback, useImperativeHandle, forwardRef, useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { markdownToHtml, htmlToMarkdown } from '@/services/markdownConverter';
import { RichTextToolbar } from './RichTextToolbar';

export interface RichTextHandle {
  focus: () => void;
  getSelection: () => { from: number; to: number };
  getContentBeforeCursor: () => string;
  insertTextAtCursor: (text: string) => void;
  insertText: (text: string) => void;
  setContent: (content: string) => void;
  setSelection: (from: number, to: number) => void;
  getContent: () => string;
  wrapText: (before: string, after: string) => void;
}

interface RichTextEditorProps {
  initialContent: string;
  onChange: (text: string) => void;
  onSelectionChange?: (from: number, to: number) => void;
  placeholderText?: string;
  searchQuery?: string;
}

export const RichTextEditor = forwardRef<RichTextHandle, RichTextEditorProps>(
  function RichTextEditor(
    { initialContent, onChange, onSelectionChange, placeholderText = '开始编写笔记...', searchQuery },
    ref,
  ) {
    const [mode, setMode] = useState<'wysiwyg' | 'source'>('wysiwyg');
    const [sourceContent, setSourceContent] = useState(initialContent);
    const isUpdatingFromSource = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: { HTMLAttributes: { class: 'code-block' } },
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({ placeholder: placeholderText }),
        Underline,
        LinkExtension.configure({ openOnClick: false }),
        ImageExtension,
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TextStyle,
      ],
      content: markdownToHtml(initialContent),
      onUpdate: ({ editor: ed }) => {
        if (isUpdatingFromSource.current) return;
        const html = ed.getHTML();
        const md = htmlToMarkdown(html);
        onChangeRef.current(md);
        setSourceContent(md);
      },
      onSelectionUpdate: ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        onSelectionChange?.(from, to);
      },
      editorProps: {
        attributes: {
          class: 'rich-editor-content prose prose-sm max-w-none',
        },
      },
    });

    // Sync initial content
    useEffect(() => {
      if (editor && initialContent) {
        const currentHtml = editor.getHTML();
        const expectedHtml = markdownToHtml(initialContent);
        if (currentHtml !== expectedHtml && currentHtml === '<p></p>') {
          editor.commands.setContent(expectedHtml);
        }
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const switchToSource = useCallback(() => {
      if (!editor) return;
      // Save current WYSIWYG content as Markdown
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      setSourceContent(md);
      setMode('source');
    }, [editor]);

    const switchToWysiwyg = useCallback(() => {
      // Convert source content back to HTML and set in editor
      const html = markdownToHtml(sourceContent);
      isUpdatingFromSource.current = true;
      editor?.commands.setContent(html);
      isUpdatingFromSource.current = false;
      setMode('wysiwyg');
    }, [editor, sourceContent]);

    const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setSourceContent(next);
      onChangeRef.current(next);
    }, []);

    // Imperative handle for parent
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (mode === 'wysiwyg') editor?.commands.focus();
        else document.querySelector('.rich-editor-source')?.querySelector('textarea')?.focus();
      },
      getSelection: () => {
        if (mode === 'wysiwyg' && editor) {
          const { from, to } = editor.state.selection;
          return { from, to };
        }
        return { from: 0, to: 0 };
      },
      getContentBeforeCursor: () => {
        if (mode === 'wysiwyg' && editor) {
          const { from } = editor.state.selection;
          return editor.state.doc.textBetween(0, from, '\n', ' ');
        }
        return sourceContent;
      },
      insertTextAtCursor: (text: string) => {
        if (mode === 'wysiwyg') {
          editor?.chain().focus().insertContent(text).run();
        } else {
          const ta = document.querySelector('.rich-editor-source textarea') as HTMLTextAreaElement;
          if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const next = sourceContent.slice(0, start) + text + sourceContent.slice(end);
            setSourceContent(next);
            onChangeRef.current(next);
          }
        }
      },
      insertText: (text: string) => {
        if (mode === 'wysiwyg') {
          editor?.chain().focus().insertContent(text).run();
        } else {
          setSourceContent((prev) => prev + text);
          onChangeRef.current(sourceContent + text);
        }
      },
      setContent: (content: string) => {
        if (mode === 'wysiwyg') {
          isUpdatingFromSource.current = true;
          editor?.commands.setContent(markdownToHtml(content));
          isUpdatingFromSource.current = false;
        }
        setSourceContent(content);
      },
      setSelection: (_from: number, _to: number) => {
        // TipTap doesn't expose setSelection easily - skip for now
      },
      getContent: () => {
        if (mode === 'wysiwyg' && editor) {
          return htmlToMarkdown(editor.getHTML());
        }
        return sourceContent;
      },
      wrapText: (before: string, after: string) => {
        if (mode === 'wysiwyg' && editor) {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, '\n', ' ');
          editor.chain().focus().insertContent(before + text + after).run();
        } else {
          const ta = document.querySelector('.rich-editor-source textarea') as HTMLTextAreaElement;
          if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const selected = sourceContent.slice(start, end);
            const next = sourceContent.slice(0, start) + before + selected + after + sourceContent.slice(end);
            setSourceContent(next);
            onChangeRef.current(next);
          }
        }
      },
    }), [editor, mode, sourceContent]);

    // Highlight search matches in WYSIWYG mode
    useEffect(() => {
      if (!editor || !searchQuery || mode !== 'wysiwyg') return;
      // TipTap doesn't have built-in search highlight — delegate to parent
    }, [searchQuery, mode, editor]);

    return (
      <div className="rich-editor">
        <RichTextToolbar editor={editor} mode={mode} onModeSwitch={mode === 'wysiwyg' ? switchToSource : switchToWysiwyg} />
        <div className="rich-editor-body">
          {mode === 'wysiwyg' ? (
            <EditorContent editor={editor} className="rich-editor-wysiwyg" />
          ) : (
            <div className="rich-editor-source">
              <textarea
                value={sourceContent}
                onChange={handleSourceChange}
                className="rich-editor-textarea"
                placeholder={placeholderText}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);
