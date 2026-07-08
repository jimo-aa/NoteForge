// NoteForge — Editor Toolbar
// Markdown formatting toolbar (source-only mode).
// Provides quick-insert buttons for common Markdown syntax.

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolbarAction } from './types/editor';

const MARKDOWN_ACTIONS: ToolbarAction[] = [
  { label: 'B', before: '**', after: '**' },
  { label: 'I', before: '*', after: '*' },
  { label: 'S', before: '~~', after: '~~' },
  { label: '`', before: '`', after: '`' },
  { label: 'H', before: '\n## ', after: '' },
  { label: '•', before: '\n- ', after: '' },
  { label: '1.', before: '\n1. ', after: '' },
  { label: '□', before: '\n- [ ] ', after: '' },
  { label: '"', before: '\n> ', after: '' },
  { label: '</>', before: '\n```\n', after: '\n```\n' },
  { label: '🔗', before: '[', after: '](url)' },
  { label: '▦', before: '\n| col1 | col2 |\n| --- | --- |\n| data | data |\n', after: '' },
  { label: '—', before: '\n---\n', after: '' },
];

interface EditorToolbarProps {
  onInsertMarkdown: (before: string, after: string) => void;
  onFormatTable: () => void;
  onTogglePreview: () => void;
  isPreviewVisible: boolean;
}

export function EditorToolbar({
  onInsertMarkdown,
  onFormatTable,
  onTogglePreview,
  isPreviewVisible,
}: EditorToolbarProps) {
  const { t } = useTranslation();

  const actionTitles: Record<string, string> = useMemo(() => ({
    'B': t('note.bold'),
    'I': t('note.italic'),
    'S': t('note.strikethrough'),
    '`': t('note.inlineCode'),
    'H': t('note.heading'),
    '•': t('note.unorderedList'),
    '1.': t('note.orderedList'),
    '□': t('note.taskList'),
    '"': t('note.blockquote'),
    '</>': t('note.codeBlock'),
    '🔗': t('note.link'),
    '▦': t('note.table'),
    '—': t('note.horizontalRule'),
  }), [t]);

  return (
    <div className="markdown-toolbar">
      <div className="markdown-buttons">
        {MARKDOWN_ACTIONS.map((action) => (
          <button
            key={action.label}
            className="markdown-button"
            title={actionTitles[action.label] ?? action.label}
            onClick={() => onInsertMarkdown(action.before, action.after)}
          >
            {action.label}
          </button>
        ))}
        <button className="markdown-button" title={t('note.formatTable')} onClick={onFormatTable}>
          ⊞ {t('note.table')}
        </button>
      </div>
      <button
        className={isPreviewVisible ? 'preview-toggle active' : 'preview-toggle'}
        onClick={onTogglePreview}
      >
        👁 {t('editor.preview')}
      </button>
    </div>
  );
}
