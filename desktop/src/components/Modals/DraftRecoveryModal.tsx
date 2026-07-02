import { useState, useMemo } from 'react';
import { useStore } from '@/stores/context';
import { formatTime } from '@/utils/markdown';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return formatTime(ts);
}

function getDateGroup(ts: number): string {
  const now = new Date();
  const date = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  if (ts >= today) return '今天';
  if (ts >= yesterday) return '昨天';
  const weekAgo = today - 6 * 86400000;
  if (ts >= weekAgo) return '最近 7 天';
  return '更早';
}

export function DraftRecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { recoveryDrafts, notes, clearRecovery, selectNote, showToast } = useStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const getNoteStatus = (id: string): 'existing' | 'deleted' => {
    return safeNotes.some((n) => n.meta.id === id) ? 'existing' : 'deleted';
  };

  // Group drafts by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof safeDrafts> = {};
    for (const draft of safeDrafts) {
      const group = getDateGroup(draft.updatedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(draft);
    }
    return groups;
  }, [safeDrafts]);

  const handleClear = (id: string) => {
    clearRecovery(id);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    showToast('success', '已清除草稿');
  };

  const handleClearAll = () => {
    safeDrafts.forEach((draft) => clearRecovery(draft.id));
    setSelectedIds(new Set());
    showToast('success', '已清除全部草稿');
  };

  const handleDismissCrash = () => {
    try {
      window.localStorage.removeItem('noteforge:crash:last');
      window.localStorage.removeItem('noteforge:crash:recovered');
    } catch { /* ignore */ }
    showToast('info', '已清除崩溃记录');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchRestore = () => {
    for (const id of selectedIds) {
      selectNote(id);
    }
    setSelectedIds(new Set());
    showToast('success', `已恢复 ${selectedIds.size} 个草稿`);
    onClose();
  };

  const handleBatchClear = () => {
    for (const id of selectedIds) {
      clearRecovery(id);
    }
    setSelectedIds(new Set());
    showToast('success', `已清除 ${selectedIds.size} 个草稿`);
  };

  const allSelected = safeDrafts.length > 0 && selectedIds.size === safeDrafts.length;

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
          {safeDrafts.length > 0 && (
            <div className="draft-recovery-bulk-actions">
              <label className="draft-recovery-select-all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) setSelectedIds(new Set());
                    else setSelectedIds(new Set(safeDrafts.map((d) => d.id)));
                  }}
                />
                <span>全选 ({safeDrafts.length})</span>
              </label>
              {selectedIds.size > 1 && (
                <div className="draft-recovery-bulk-btns">
                  <button className="primary-btn" onClick={handleBatchRestore}>恢复 {selectedIds.size} 项</button>
                  <button className="ghost-btn" onClick={handleBatchClear}>清除 {selectedIds.size} 项</button>
                </div>
              )}
              <button className="ghost-btn" onClick={handleClearAll}>清除全部</button>
            </div>
          )}
          {Object.entries(grouped).map(([groupName, drafts]) => (
            <div key={groupName}>
              <div className="draft-recovery-group-header">{groupName}</div>
              {drafts.map((draft, i) => {
                const status = getNoteStatus(draft.id);
                const isDeleted = status === 'deleted';
                return (
                  <div key={`${draft.id}-${i}`} className={`draft-recovery-item${isDeleted ? ' draft-recovery-item--deleted' : ''}`}>
                    <label className="draft-recovery-checkbox" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(draft.id)}
                        onChange={() => toggleSelect(draft.id)}
                      />
                    </label>
                    <div className="draft-recovery-info">
                      <strong>{getNoteTitle(draft.id)}{isDeleted ? ' (已删除)' : ''}</strong>
                      <span className="draft-recovery-snippet">{draft.content.slice(0, 100)}{draft.content.length > 100 ? '...' : ''}</span>
                      <span className="draft-recovery-meta">
                        <span className="draft-recovery-time">{relativeTime(draft.updatedAt)}</span>
                        <span>{Math.max(1, draft.content.length)} 字</span>
                      </span>
                    </div>
                    <div className="draft-recovery-actions">
                      <button className="primary-btn" onClick={() => { selectNote(draft.id); onClose(); showToast('info', '已打开草稿笔记'); }}>打开</button>
                      <button className="ghost-btn" onClick={() => handleClear(draft.id)}>删除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
