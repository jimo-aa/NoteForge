import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Icon';

export interface NotebookModalState {
  open: boolean;
  mode: 'create' | 'rename' | null;
  title: string;
  value: string;
  notebookId?: string | null;
}

const NOTEBOOK_COLORS = [
  { value: '#6366f1', name: '靛蓝' },
  { value: '#8b5cf6', name: '紫色' },
  { value: '#ec4899', name: '粉色' },
  { value: '#ef4444', name: '红色' },
  { value: '#f59e0b', name: '琥珀' },
  { value: '#10b981', name: '翠绿' },
  { value: '#06b6d4', name: '青色' },
  { value: '#64748b', name: '石板' },
];

interface NotebookModalProps {
  state: NotebookModalState;
  onClose: () => void;
  onConfirm: (name: string, icon?: string, color?: string) => void;
}

export function NotebookModal({ state, onClose, onConfirm }: NotebookModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(state.value);
  const [selectedColor, setSelectedColor] = useState(NOTEBOOK_COLORS[0]!.value);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.open) {
      setName(state.value);
      setSelectedColor(NOTEBOOK_COLORS[0]!.value);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [state.open, state.value]);

  if (!state.open || !state.mode) return null;

  const trimmedName = name.trim();

  const handleConfirm = async () => {
    if (!trimmedName) return;
    setIsLoading(true);
    try {
      await onConfirm(trimmedName, '', selectedColor);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter' && name.trim()) {
      e.preventDefault();
      handleConfirm();
    }
  };

  const isCreate = state.mode === 'create';

  return (
    <div className="modal-backdrop new-note-backdrop" onClick={onClose}>
      <div className="modal new-note-modal nb-modal" onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}>
        <div className="new-note-title">
          <span className="nb-modal-title-icon" style={{ color: selectedColor }}>
            <Icon type="notebook" size={20} />
          </span>
          <h3>{state.title}</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label={t('common.close')}>
            <Icon type="close" size={16} />
          </button>
        </div>

        <label className="new-note-field new-note-field--full">
          <span>{t('notebook.name')}</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isCreate ? t('notebook.namePlaceholderCreate') : t('notebook.namePlaceholderRename')}
            disabled={isLoading}
          />
          {!trimmedName && (
            <span className="nb-field-hint nb-hint-error">{t('notebook.nameRequired')}</span>
          )}
        </label>

        <div className="new-note-grid">
          <div className="new-note-field">
            <span>{t('notebook.color')}</span>
            <div className="nb-color-grid">
              {NOTEBOOK_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`nb-color-btn ${selectedColor === c.value ? 'selected' : ''}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setSelectedColor(c.value)}
                  type="button"
                  title={c.name}
                />
              ))}
            </div>
            <div className="nb-color-preview">
              <span className="nb-color-preview-dot" style={{ backgroundColor: selectedColor }} />
              <span className="nb-color-preview-name">
                {NOTEBOOK_COLORS.find((c) => c.value === selectedColor)?.name ?? ''}
              </span>
            </div>
          </div>
        </div>

        <div className="nb-preview-card">
          <span className="nb-preview-icon" style={{ color: selectedColor }}>
            <Icon type="notebook" size={20} />
          </span>
          <span className="nb-preview-color-dot" style={{ backgroundColor: selectedColor }} />
          <span className="nb-preview-name">{name.trim() || t('notebook.previewTitle')}</span>
          <span className="nb-preview-count">{t('notebook.noteCount', { count: 0 })}</span>
        </div>

        <div className="nb-keyboard-hint">
          <span>{t('notebook.hintEnterCreate')}</span>
          <span>{t('notebook.hintEsc')}</span>
        </div>

        <div className="modal-actions new-note-actions">
          <button className="ghost-btn" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </button>
          <button
            className="primary-btn"
            onClick={handleConfirm}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? t('notebook.processing') : isCreate ? t('notebook.confirmCreate') : t('notebook.confirmRename')}
          </button>
        </div>
      </div>
    </div>
  );
}
