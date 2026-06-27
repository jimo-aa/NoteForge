import { useEffect, useState, useRef } from 'react';

export interface NotebookModalState {
  open: boolean;
  mode: 'create' | 'rename' | null;
  title: string;
  value: string;
  notebookId?: string | null;
}

const NOTEBOOK_ICONS = ['📓', '📔', '📙', '📕', '📚', '📖', '📝', '✏️', '📋', '📰', '📑', '🗂️', '💻', '🎯', '🔄', '🤖'];

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
  const [name, setName] = useState(state.value);
  const [selectedIcon, setSelectedIcon] = useState(NOTEBOOK_ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(NOTEBOOK_COLORS[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.open) {
      setName(state.value);
      setSelectedIcon(NOTEBOOK_ICONS[0]);
      setSelectedColor(NOTEBOOK_COLORS[0].value);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [state.open, state.value]);

  if (!state.open || !state.mode) return null;

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsLoading(true);
    try {
      await onConfirm(trimmedName, selectedIcon, selectedColor);
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
          <span>{selectedIcon}</span>
          <h3>{state.title}</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label="关闭">✕</button>
        </div>

        <label className="new-note-field new-note-field--full">
          <span>名称</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isCreate ? '给笔记本起个名字吧' : '输入新名称'}
            disabled={isLoading}
          />
          {name.trim().length > 0 && name.trim().length < 1 && (
            <span className="nb-field-hint nb-hint-error">名称不能为空</span>
          )}
        </label>

        <div className="new-note-grid">
          <div className="new-note-field">
            <span>图标</span>
            <div className="nb-icon-grid">
              {NOTEBOOK_ICONS.map((icon) => (
                <button
                  key={icon}
                  className={`nb-icon-btn ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                  type="button"
                  title={icon}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="new-note-field">
            <span>颜色</span>
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
          <span className="nb-preview-icon">{selectedIcon}</span>
          <span className="nb-preview-name">{name.trim() || '笔记本名称'}</span>
          <span className="nb-preview-color-dot" style={{ backgroundColor: selectedColor }} />
          <span className="nb-preview-count">0 条笔记</span>
        </div>

        <div className="nb-keyboard-hint">
          <span>按 <kbd>Enter</kbd> {isCreate ? '创建' : '确认'}</span>
          <span>按 <kbd>Esc</kbd> 取消</span>
        </div>

        <div className="modal-actions new-note-actions">
          <button className="ghost-btn" onClick={onClose} disabled={isLoading}>
            取消
          </button>
          <button
            className="primary-btn"
            onClick={handleConfirm}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? '处理中...' : isCreate ? '创建笔记本' : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
