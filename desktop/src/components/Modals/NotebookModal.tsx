import { useEffect, useState } from 'react';

export interface NotebookModalState {
  open: boolean;
  mode: 'create' | 'rename' | null;
  title: string;
  value: string;
  notebookId?: string | null;
}

const NOTEBOOK_ICONS = ['📓', '📔', '📙', '📕', '📚', '📖', '📝', '✏️', '📋', '📰', '📑', '🗂️'];

interface NotebookModalProps {
  state: NotebookModalState;
  onClose: () => void;
  onConfirm: (name: string, icon?: string) => void;
}

export function NotebookModal({ state, onClose, onConfirm }: NotebookModalProps) {
  const [name, setName] = useState(state.value);
  const [selectedIcon, setSelectedIcon] = useState(NOTEBOOK_ICONS[0]);

  useEffect(() => {
    if (state.open) {
      setName(state.value);
      setSelectedIcon(NOTEBOOK_ICONS[0]);
    }
  }, [state.open]);

  if (!state.open || !state.mode) return null;

  const handleConfirm = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    onConfirm(trimmedName, selectedIcon);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{state.title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <label className="form-field">
            <span className="form-label">笔记本名称</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入笔记本名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
                if (e.key === 'Escape') onClose();
              }}
            />
          </label>

          <div className="form-field">
            <span className="form-label">选择图标</span>
            <div className="icon-picker">
              {NOTEBOOK_ICONS.map((icon) => (
                <button
                  key={icon}
                  className={`icon-button ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                  title={icon}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!name.trim()}
          >
            {state.mode === 'create' ? '创建' : '重命名'}
          </button>
        </div>
      </div>
    </div>
  );
}
