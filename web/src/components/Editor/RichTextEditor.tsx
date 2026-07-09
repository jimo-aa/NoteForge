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
import { createSlashCommandExtension } from './SlashCommand';
import { PluginKey } from '@tiptap/pm/state';

export interface RichTextHandle {
  getContent: () => string;
  setContent: (content: string) => void;
  focus: () => void;
}

interface RichTextEditorProps {
  initialContent: string;
  onChange: (text: string) => void;
  placeholderText?: string;
  editorSearchQuery?: string;
}

export const RichTextEditor = forwardRef<RichTextHandle, RichTextEditorProps>(
  function RichTextEditor({ initialContent, onChange, placeholderText, editorSearchQuery }, ref) {
    const [mode, setMode] = useState<'wysiwyg' | 'source'>('wysiwyg');
    const [sourceContent, setSourceContent] = useState(initialContent);
    const isUpdating = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const searchHighlightsRef = useRef<{ from: number; to: number }[]>([]);

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
        createSlashCommandExtension(new PluginKey('slash-command')),
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

    // Editor search — simple match count (inline highlighting requires ProseMirror decoration)
    useEffect(() => {
      if (!editor || mode !== 'wysiwyg') return;
      if (!editorSearchQuery?.trim()) {
        searchHighlightsRef.current = [];
        return;
      }

      const query = editorSearchQuery.toLowerCase();
      const { doc } = editor.state;
      const highlights: { from: number; to: number }[] = [];

      doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const text = node.text.toLowerCase();
          let idx = 0;
          while ((idx = text.indexOf(query, idx)) !== -1) {
            highlights.push({
              from: pos + idx,
              to: pos + idx + query.length,
            });
            idx += query.length;
          }
        }
      });

      searchHighlightsRef.current = highlights;
    }, [editor, editorSearchQuery, mode]);

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
            <>
              <EditorContent editor={editor} />
              {/* Search match count */}
              {editorSearchQuery && searchHighlightsRef.current.length > 0 && (
                <div style={{
                  position: 'sticky', bottom: 0, padding: '4px 12px',
                  background: 'var(--panel-2)', borderTop: '1px solid var(--line)',
                  fontSize: 11, color: 'var(--text-muted)', textAlign: 'center'
                }}>
                  {searchHighlightsRef.current.length} matches found
                </div>
              )}
            </>
          ) : (
            <textarea
              value={sourceContent}
              onChange={handleSourceChange}
              style={{
                width: '100%', minHeight: 300, padding: 16, border: 'none',
                background: 'transparent', color: 'var(--text)', fontFamily: 'monospace',
                fontSize: 14, resize: 'none', outline: 'none'
              }}
              placeholder={placeholderText}
              spellCheck={false}
            />
          )}
        </div>
      </div>
    );
  }
);
