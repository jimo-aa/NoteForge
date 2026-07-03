// NoteForge — Rich Text Editor Toolbar
// Formatting toolbar for TipTap WYSIWYG mode. Supports text formatting,
// headings, lists, code, tables, links, images, and mode switching.

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';

interface ToolbarProps {
  editor: Editor | null;
  mode: 'wysiwyg' | 'source';
  onModeSwitch: () => void;
}

export function RichTextToolbar({ editor, mode, onModeSwitch }: ToolbarProps) {
  const { t } = useTranslation();

  const addTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt(t('editor.linkUrl'));
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }, [editor, t]);

  const addImage = useCallback(() => {
    const url = window.prompt(t('editor.imageUrl'));
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  }, [editor, t]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      className={`rich-toolbar-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="rich-toolbar">
      <div className="rich-toolbar-group">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title={t('note.bold')}><strong>B</strong></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title={t('note.italic')}><em>I</em></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title={t('note.underline')}><u>U</u></ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title={t('note.strikethrough')}><s>S</s></ToolBtn>
      </div>

      <div className="rich-toolbar-divider" />

      <div className="rich-toolbar-group">
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title={t('note.heading') + ' 1'}>H1</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title={t('note.heading') + ' 2'}>H2</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title={t('note.heading') + ' 3'}>H3</ToolBtn>
      </div>

      <div className="rich-toolbar-divider" />

      <div className="rich-toolbar-group">
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title={t('note.unorderedList')}>•</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title={t('note.orderedList')}>1.</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title={t('note.blockquote')}>"</ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title={t('note.codeBlock')}>&lt;/&gt;</ToolBtn>
      </div>

      <div className="rich-toolbar-divider" />

      {/* Table operations */}
      <div className="rich-toolbar-group">
        <ToolBtn onClick={addTable} title={t('note.table')}>▦</ToolBtn>
        {editor.isActive('table') && (
          <>
            <ToolBtn onClick={() => editor.chain().focus().addRowBefore().run()} title={t('editor.tableAddRowBefore')}>▲+</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} title={t('editor.tableAddRowAfter')}>▼+</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteRow().run()} title={t('editor.tableDeleteRow')}>▼−</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addColumnBefore().run()} title={t('editor.tableAddColBefore')}>◀+</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title={t('editor.tableAddColAfter')}>▶+</ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().deleteColumn().run()} title={t('editor.tableDeleteCol')}>▶−</ToolBtn>
          </>
        )}
      </div>

      <div className="rich-toolbar-divider" />

      <div className="rich-toolbar-group">
        <ToolBtn onClick={addLink} active={editor.isActive('link')} title={t('note.link')}>🔗</ToolBtn>
        <ToolBtn onClick={addImage} title={t('note.image')}>🖼</ToolBtn>
      </div>

      <div className="rich-toolbar-spacer" />

      {/* Mode switch */}
      <div className="rich-toolbar-group">
        <ToolBtn onClick={onModeSwitch} title={mode === 'wysiwyg' ? t('editor.sourceMode') : t('editor.visualMode')}>
          {mode === 'wysiwyg' ? '&lt;/&gt;' : '👁'}
        </ToolBtn>
      </div>
    </div>
  );
}
