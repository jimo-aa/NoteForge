// NoteForge — Document Header
// Title input, favorite/pin toggle, and action buttons.
// Extracted from the legacy Editor.tsx.

import { useTranslation } from 'react-i18next';
import { Icon } from '../Common/Icon';

interface DocumentHeaderProps {
  title: string;
  isFavorite: boolean;
  isPinned: boolean;
  onTitleChange: (title: string) => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onOpenProperties: () => void;
  onClearDraft: () => void;
  onExport: () => void;
  onToggleAttachment: () => void;
  isAttachmentOpen: boolean;
}

export function DocumentHeader({
  title,
  isFavorite,
  isPinned,
  onTitleChange,
  onToggleFavorite,
  onTogglePin,
  onOpenProperties,
  onClearDraft,
  onExport,
  onToggleAttachment,
  isAttachmentOpen,
}: DocumentHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="document-header">
      <input
        className="document-title"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <div className="document-actions">
        <button
          className={isFavorite ? 'state-button active' : 'state-button'}
          onClick={onToggleFavorite}
          title={isFavorite ? t('note.unfavorite') : t('note.favorite')}
        >
          <Icon type="shoucang" />
        </button>
        <button
          className={isPinned ? 'state-button active' : 'state-button'}
          onClick={onTogglePin}
          title={isPinned ? t('note.unpin') : t('note.pin')}
        >
          <Icon type="gudin" />
        </button>
        <span className="document-divider" />
        <button className="plain-action" onClick={onOpenProperties} title={t('note.properties')}>
          i
        </button>
        <button className="plain-action" onClick={onClearDraft} title={t('note.clearDraft')}>
          ↺
        </button>
        <button className="plain-action" onClick={onExport} title={t('note.download')}>
          ⬇
        </button>
        <button
          className={isAttachmentOpen ? 'state-button active' : 'plain-action'}
          onClick={onToggleAttachment}
          title={t('attachment.title')}
        >
          📎
        </button>
      </div>
    </header>
  );
}
