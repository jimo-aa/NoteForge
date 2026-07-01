import { useStore } from '@/stores/context';
import { formatTime } from '@/utils/markdown';

export function DraftRecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { recoveryDrafts, notes, clearRecovery, selectNote, showToast } = useStore();

  if (!open) return null;

  const safeNotes = notes || [];
  const safeDrafts = recoveryDrafts || [];

  // Check for crash recovery data
  let crashInfo: { crashedAt: number; error: string } | null = null;
  try {
    const raw = window.localStorage.getItem('noteforge:crash:last');
    if (raw) {
      crashInfo = JSON.parse(raw) as { crashedAt: number; error: string };
    }
  } catch { /* ignore */ }

  const getNoteTitle = (id: string) => {
    const note = safeNotes.find((n) => n.meta.id === id);
    return note?.meta.title || '(已删除的笔记)';
  };

  const handleClear = (id: string) => {
    clearRecovery(id);
    showToast('success', '已清除草稿');
  };

  const handleClearAll = () => {
    safeDrafts.forEach((draft) => clearRecovery(draft.id));
    showToast('success', '已清除全部草稿');
  };

  const handleDismissCrash = () => {
    try {
      window.localStorage.removeItem('noteforge:crash:last');
      window.localStorage.removeItem('noteforge:crash:recovered');
    } catch { /* ignore */ }
    showToast('info', '已清除崩溃记录');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal draft-recovery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="draft-recovery-header">
          <h3>📝 恢复草稿</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="draft-recovery-body">
          {crashInfo && (
            <div className="draft-recovery-crash-banner">
              <div className="draft-recovery-crash-banner-icon">💥</div>
              <div className="draft-recovery-crash-banner-text">
                <strong>检测到上次崩溃</strong>
                <span>{crashInfo.error} · {formatTime(crashInfo.crashedAt)}</span>
              </div>
              <button className="ghost-btn" onClick={handleDismissCrash}>忽略</button>
            </div>
          )}
          {safeDrafts.length === 0 && (
            <div className="draft-recovery-empty">
              <div className="draft-recovery-empty-icon">✓</div>
              <p>没有需要恢复的草稿</p>
            </div>
          )}
          {safeDrafts.length > 1 && (
            <div className="draft-recovery-bulk-actions">
              <button className="ghost-btn" onClick={handleClearAll}>清除全部草稿</button>
            </div>
          )}
          {safeDrafts.map((draft, i) => (
            <div key={`${draft.id}-${i}`} className="draft-recovery-item">
              <div className="draft-recovery-info">
                <strong>{getNoteTitle(draft.id)}</strong>
                <span className="draft-recovery-snippet">{draft.content.slice(0, 80)}...</span>
                <span className="draft-recovery-time">{formatTime(draft.updatedAt)}</span>
              </div>
              <div className="draft-recovery-actions">
                <button className="primary-btn" onClick={() => { selectNote(draft.id); onClose(); showToast('info', '已打开草稿笔记'); }}>打开</button>
                <button className="ghost-btn" onClick={() => handleClear(draft.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
