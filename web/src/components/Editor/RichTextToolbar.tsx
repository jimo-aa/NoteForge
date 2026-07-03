'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';

interface ToolbarProps {
  editor: Editor | null;
  mode: 'wysiwyg' | 'source';
  onModeSwitch: () => void;
}

const ToolBtn = ({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
  <button type="button" className={`rich-toolbar-btn${active ? ' active' : ''}`} onClick={onClick} title={title}>{children}</button>
);

export function RichTextToolbar({ editor, mode, onModeSwitch }: ToolbarProps) {
  const addTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor && mode === 'wysiwyg') return null;

  return (
    <div className="rich-toolbar">
      <div className="rich-toolbar-group">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold"><strong>B</strong></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic"><em>I</em></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline"><u>U</u></ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough"><s>S</s></ToolBtn>
      </div>
      <div className="rich-toolbar-divider" />
      <div className="rich-toolbar-group">
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolBtn>
      </div>
      <div className="rich-toolbar-divider" />
      <div className="rich-toolbar-group">
        <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet List">•</ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Ordered List">1.</ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">"</ToolBtn>
        <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} title="Code Block">&lt;/&gt;</ToolBtn>
      </div>
      <div className="rich-toolbar-divider" />
      <div className="rich-toolbar-group">
        <ToolBtn onClick={addTable} title="Table">▦</ToolBtn>
      </div>
      <div className="rich-toolbar-spacer" />
      <div className="rich-toolbar-group">
        <ToolBtn onClick={onModeSwitch} title={mode === 'wysiwyg' ? 'Source' : 'Visual'}>
          {mode === 'wysiwyg' ? '&lt;/&gt;' : '👁'}
        </ToolBtn>
      </div>
    </div>
  );
}
