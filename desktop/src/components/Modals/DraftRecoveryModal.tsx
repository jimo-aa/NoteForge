import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useStore } from '@/stores/context';
import { formatTime } from '@/utils/markdown';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return i18n.t('draftRecovery.justNow');
  if (mins < 60) return i18n.t('draftRecovery.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return i18n.t('draftRecovery.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return i18n.t('draftRecovery.yesterday');
  if (days < 7) return i18n.t('draftRecovery.daysAgo', { count: days });
  return formatTime(ts);
}

function getDateGroup(ts: number): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  if (ts >= today) return i18n.t('draftRecovery.groupToday');
  if (ts >= yesterday) return i18n.t('draftRecovery.groupYesterday');
  const weekAgo = today - 6 * 86400000;
  if (ts >= weekAgo) return i18n.t('draftRecovery.groupWeek');
  return i18n.t('draftRecovery.groupEarlier');
}

export function DraftRecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { recoveryDrafts, notes, clearRecovery, selectNote, showToast } = useStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    return note?.meta.title || t('draftRecovery.deletedNote');
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
    showToast('success', t('draftRecovery.cleared'));
  };

  const handleClearAll = () => {
    safeDrafts.forEach((draft) => clearRecovery(draft.id));
    setSelectedIds(new Set());
    showToast('success', t('draftRecovery.clearedAll'));
  };

  const handleDismissCrash = () => {
    try {
      window.localStorage.removeItem('noteforge:crash:last');
      window.localStorage.removeItem('noteforge:crash:recovered');
    } catch { /* ignore */ }
    showToast('info', t('draftRecovery.clearedCrash'));
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
    showToast('success', t('draftRecovery.restored', { count: selectedIds.size }));
    onClose();
  };

  const handleBatchClear = () => {
    for (const id of selectedIds) {
      clearRecovery(id);
    }
    setSelectedIds(new Set());
    showToast('success', t('draftRecovery.clearedSelected', { count: selectedIds.size }));
  };

  const allSelected = safeDrafts.length > 0 && selectedIds.size === safeDrafts.length;

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal draft-recovery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="draft-recovery-header">
          <h3>{t('draftRecovery.title')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="draft-recovery-body">
          {crashInfo && (
            <div className="draft-recovery-crash-banner">
              <div className="draft-recovery-crash-banner-icon">💥</div>
              <div className="draft-recovery-crash-banner-text">
                <strong>{t('draftRecovery.crashBannerTitle')}</strong>
                <span>{crashInfo.error} · {formatTime(crashInfo.crashedAt)}</span>
              </div>
              <button className="ghost-btn" onClick={handleDismissCrash}>{t('draftRecovery.dismissCrash')}</button>
            </div>
          )}
          {safeDrafts.length === 0 && (
            <div className="draft-recovery-empty">
              <div className="draft-recovery-empty-icon">✓</div>
              <p>{t('draftRecovery.empty')}</p>
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
                <span>{t('draftRecovery.selectAll', { count: safeDrafts.length })}</span>
              </label>
              {selectedIds.size > 1 && (
                <div className="draft-recovery-bulk-btns">
                  <button className="primary-btn" onClick={handleBatchRestore}>{t('draftRecovery.restoreCount', { count: selectedIds.size })}</button>
                  <button className="ghost-btn" onClick={handleBatchClear}>{t('draftRecovery.clearCount', { count: selectedIds.size })}</button>
                </div>
              )}
              <button className="ghost-btn" onClick={handleClearAll}>{t('draftRecovery.clearAll')}</button>
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
                      <strong>{getNoteTitle(draft.id)}{isDeleted ? ` ${t('draftRecovery.deleted')}` : ''}</strong>
                      <span className="draft-recovery-snippet">{draft.content.slice(0, 100)}{draft.content.length > 100 ? '...' : ''}</span>
                      <span className="draft-recovery-meta">
                        <span className="draft-recovery-time">{relativeTime(draft.updatedAt)}</span>
                        <span>{Math.max(1, draft.content.length)} {t('editor.words')}</span>
                      </span>
                    </div>
                    <div className="draft-recovery-actions">
                      <button className="primary-btn" onClick={() => { selectNote(draft.id); onClose(); showToast('info', t('draftRecovery.opened')); }}>{t('draftRecovery.open')}</button>
                      <button className="ghost-btn" onClick={() => handleClear(draft.id)}>{t('draftRecovery.delete')}</button>
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
