import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type EntityModalMode = 'create-notebook' | 'rename-notebook' | 'rename-note';

export interface EntityModalState {
  open: boolean;
  mode: EntityModalMode | null;
  title: string;
  label: string;
  value: string;
  confirmText: string;
  targetId?: string | null;
}

export function EntityModal({ state, onClose, onConfirm }: { state: EntityModalState; onClose: () => void; onConfirm: (value: string) => void; }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(state.value);

  useEffect(() => { if (state.open) setValue(state.value); }, [state.open, state.value]);
  if (!state.open || !state.mode) return null;

  return (
    <div className="modal-backdrop new-note-backdrop" onClick={onClose}>
      <div className="modal new-note-modal" onClick={(e) => e.stopPropagation()}>
        <div className="new-note-title"><span>✎</span><h3>{state.title}</h3></div>
        <label className="new-note-field new-note-field--full"><span>{state.label}</span><input value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></label>
        <div className="modal-actions new-note-actions"><button className="ghost-btn" onClick={onClose}>{t('common.cancel')}</button><button className="primary-btn" onClick={() => onConfirm(value.trim())}>{state.confirmText}</button></div>
      </div>
    </div>
  );
}
