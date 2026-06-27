import { useEffect, useRef } from 'react';

export function ConfirmDialog({ open, title, message, confirmLabel = '确认', cancelLabel = '取消', danger = false, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 60);
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h3 className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="ghost-btn" onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} className={danger ? 'danger-btn' : 'primary-btn'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
