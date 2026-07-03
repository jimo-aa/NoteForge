'use client';

import { useCallback, useImperativeHandle, forwardRef, useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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
import { RichTextToolbar } from './RichTextToolbar';
import { markdownToHtml, htmlToMarkdown } from '@/lib/markdownConverter';

export interface RichTextHandle {
  getContent: () => string;
  setContent: (content: string) => void;
  focus: () => void;
}

interface RichTextEditorProps {
  initialContent: string;
  onChange: (text: string) => void;
  placeholderText?: string;
}

export const RichTextEditor = forwardRef<RichTextHandle, RichTextEditorProps>(
  function RichTextEditor({ initialContent, onChange, placeholderText }, ref) {
    const [mode, setMode] = useState<'wysiwyg' | 'source'>('wysiwyg');
    const [sourceContent, setSourceContent] = useState(initialContent);
    const isUpdating = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({ placeholder: placeholderText }),
        Underline,
        LinkExtension.configure({ openOnClick: false }),
        ImageExtension,
        Table.configure({ resizable: true }),
        TableRow, TableCell, TableHeader,
        TextStyle,
      ],
      content: markdownToHtml(initialContent),
      onUpdate: ({ editor: ed }) => {
        if (isUpdating.current) return;
        const md = htmlToMarkdown(ed.getHTML());
        setSourceContent(md);
        onChangeRef.current(md);
      },
      editorProps: {
        attributes: { class: 'rich-editor-wysiwyg prose prose-sm max-w-none' },
      },
    });

    const switchToSource = useCallback(() => {
      if (!editor) return;
      setSourceContent(htmlToMarkdown(editor.getHTML()));
      setMode('source');
    }, [editor]);

    const switchToWysiwyg = useCallback(() => {
      isUpdating.current = true;
      editor?.commands.setContent(markdownToHtml(sourceContent));
      isUpdating.current = false;
      setMode('wysiwyg');
    }, [editor, sourceContent]);

    const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setSourceContent(next);
      onChangeRef.current(next);
    }, []);

    useImperativeHandle(ref, () => ({
      getContent: () => mode === 'wysiwyg' && editor ? htmlToMarkdown(editor.getHTML()) : sourceContent,
      setContent: (content: string) => {
        if (mode === 'wysiwyg') {
          isUpdating.current = true;
          editor?.commands.setContent(markdownToHtml(content));
          isUpdating.current = false;
        }
        setSourceContent(content);
      },
      focus: () => editor?.commands.focus(),
    }), [editor, mode, sourceContent]);

    return (
      <div className="rich-editor">
        <RichTextToolbar editor={editor} mode={mode} onModeSwitch={mode === 'wysiwyg' ? switchToSource : switchToWysiwyg} />
        <div className="rich-editor-body">
          {mode === 'wysiwyg' ? (
            <EditorContent editor={editor} />
          ) : (
            <textarea
              value={sourceContent}
              onChange={handleSourceChange}
              style={{ width: '100%', minHeight: 300, padding: 16, border: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'monospace', fontSize: 14, resize: 'none', outline: 'none' }}
              placeholder={placeholderText}
              spellCheck={false}
            />
          )}
        </div>
      </div>
    );
  }
);
