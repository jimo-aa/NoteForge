// NoteForge — Status Bar
// Shows character count, line count, save status, and last saved timestamp.
// Extracted from the legacy Editor.tsx.

import { useTranslation } from 'react-i18next';
import type { SaveStatus } from './types/editor';

interface StatusBarProps {
  wordCount: number;
  lineCount: number;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  updatedAt: number;
  jumpLine?: number | null;
}

export function StatusBar({
  wordCount,
  lineCount,
  saveStatus,
  lastSavedAt,
  updatedAt,
  jumpLine,
}: StatusBarProps) {
  const { t } = useTranslation();

  const getStatusText = (status: SaveStatus): string => {
    switch (status) {
      case 'saving': return t('editor.saveStatus_saving');
      case 'unsaved': return t('editor.saveStatus_unsaved');
      case 'saved': return t('editor.saveStatus_saved');
    }
  };

  const getTimestamp = (): string => {
    if (lastSavedAt) {
      return Date.now() - lastSavedAt < 3000
        ? t('note.savedJustNow')
        : `${t('note.lastSavedAt')}${new Date(lastSavedAt).toLocaleString()}`;
    }
    return `${t('note.lastEditedAt')}${new Date(updatedAt).toLocaleString()}`;
  };

  return (
    <footer className="document-statusbar">
      <span>{t('editor.chars')} {wordCount}</span>
      <span>{t('editor.lines')} {lineCount}</span>
      <span
        className={`editor-status-indicator status-${saveStatus}`}
        title={getStatusText(saveStatus)}
      >
        <span className="status-dot" />
        <span className="status-text">{getStatusText(saveStatus)}</span>
      </span>
      {jumpLine ? <span>{t('note.jumpToLine', { line: jumpLine })}</span> : null}
      <span className="status-timestamp">{getTimestamp()}</span>
    </footer>
  );
}
