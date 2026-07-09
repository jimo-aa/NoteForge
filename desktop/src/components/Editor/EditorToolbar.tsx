// NoteForge — Editor Toolbar
// Supports both Source mode (markdown syntax buttons) and WYSIWYG mode (TipTap commands).
// Mode switch is on the right side; formatting buttons on the left.

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToolbarAction, EditorMode } from './types/editor';

// ── Inline SVG Icons ──

/** Eye icon — WYSIWYG / rendered view */
function IconWysiwyg() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 4C5 4 2 10 2 10s3 6 8 6 8-6 8-6-3-6-8-6z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

/** Angle brackets icon — Source / code view */
function IconSource() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 6l-4 4 4 4" />
      <path d="M13 6l4 4-4 4" />
    </svg>
  );
}

// ── Constants ──

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

interface PluginToolbarItem {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
}

interface EditorToolbarProps {
  /** Current editor mode */
  editorMode: EditorMode;
  /** Called when the user toggles between WYSIWYG and Source */
  onToggleMode: () => void;
  /** Source mode: insert markdown syntax */
  onInsertMarkdown: (before: string, after: string) => void;
  /** Source mode: format the table under cursor */
  onFormatTable: () => void;
  /** Source mode: toggle preview pane visibility */
  onTogglePreview: () => void;
  /** Source mode: is the preview pane visible */
  isPreviewVisible: boolean;
  /** Toolbar items contributed by active plugins */
  pluginItems?: PluginToolbarItem[];
}

export function EditorToolbar({
  editorMode,
  onToggleMode,
  onInsertMarkdown,
  onFormatTable,
  onTogglePreview,
  isPreviewVisible,
  pluginItems,
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
      {/* ── Left: formatting buttons ── */}
      <div className="markdown-buttons">
        {/* Source mode: markdown formatting buttons */}
        {editorMode === 'source' && MARKDOWN_ACTIONS.map((action) => (
          <button
            key={action.label}
            className="markdown-button"
            title={actionTitles[action.label] ?? action.label}
            onClick={() => onInsertMarkdown(action.before, action.after)}
          >
            {action.label}
          </button>
        ))}

        {/* Plugin toolbar items (shown in both modes) */}
        {pluginItems && pluginItems.length > 0 && (
          <span className="document-divider" />
        )}
        {pluginItems?.map((item) => (
          <button
            key={item.id}
            className="markdown-button"
            title={item.label}
            onClick={item.action}
          >
            {item.icon ?? item.label.slice(0, 2)}
          </button>
        ))}

        {/* Source mode: table format button */}
        {editorMode === 'source' && (
          <button className="markdown-button" title={t('note.formatTable')} onClick={onFormatTable}>
            ⊞ {t('note.table')}
          </button>
        )}
      </div>

      {/* ── Right: mode switch + preview toggle ── */}
      <div className="toolbar-actions">
        {/* Mode switch: WYSIWYG <-> Source */}
        <button
          className={`mode-toggle ${editorMode === 'wysiwyg' ? 'active' : ''}`}
          onClick={onToggleMode}
          title={editorMode === 'wysiwyg' ? t('editor.sourceMode') : t('editor.visualMode')}
        >
          {editorMode === 'wysiwyg' ? <IconWysiwyg /> : <IconSource />}
          <span>{editorMode === 'wysiwyg' ? t('editor.visualMode') : t('editor.sourceMode')}</span>
        </button>

        {/* Source mode: preview toggle */}
        {editorMode === 'source' && (
          <button
            className={`preview-toggle ${isPreviewVisible ? 'active' : ''}`}
            onClick={onTogglePreview}
          >
            👁 {t('editor.preview')}
          </button>
        )}
      </div>
    </div>
  );
}
