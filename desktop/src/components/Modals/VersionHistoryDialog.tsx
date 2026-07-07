import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './VersionHistoryDialog.module.css';
import { tauriInvoke as invoke } from '@/utils/invoke';
import type { NoteSnapshot, DiffResult } from '@/types/advanced-features';
import * as versionApi from '@/services/versionApiService';

interface VersionHistoryDialogProps {
  open: boolean;
  noteId: string;
  onClose: () => void;
  onRestore?: () => void;
}

function relativeTime(ts: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('version.justNow');
  if (mins < 60) return t('version.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('version.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('version.daysAgo', { count: days });
  return new Date(ts).toLocaleDateString();
}

export function VersionHistoryDialog({ open, noteId, onClose, onRestore }: VersionHistoryDialogProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState<'local' | 'cloud'>('local');
  const [tab, setTab] = useState<'timeline' | 'compare' | 'create'>('timeline');

  const [snapshots, setSnapshots] = useState<NoteSnapshot[]>([]);
  const [cloudVersions, setCloudVersions] = useState<versionApi.CloudVersionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [tagTitle, setTagTitle] = useState('');
  const [tagDesc, setTagDesc] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const loadSnapshots = useCallback(async () => {
    if (!noteId) return;
    setLoading(true);
    const data = await invoke<NoteSnapshot[]>('list_snapshots', { noteId });
    if (data) setSnapshots(data);
    setLoading(false);
  }, [noteId]);

  const loadCloudVersions = useCallback(async () => {
    if (!noteId) return;
    setLoading(true);
    const data = await versionApi.listVersions(noteId);
    if (data) setCloudVersions(data);
    setLoading(false);
  }, [noteId]);

  useEffect(() => {
    if (open && noteId) {
      if (source === 'local') loadSnapshots();
      else loadCloudVersions();
      setDiffResult(null);
    }
  }, [open, noteId, source, loadSnapshots, loadCloudVersions]);

  useEffect(() => {
    if (snapshots.length >= 2 && !fromId && !toId) {
      setFromId(snapshots[snapshots.length - 1]!.id);
      setToId(snapshots[0]!.id);
    }
  }, [snapshots]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExpand = async (snap: NoteSnapshot) => {
    if (expandedId === snap.id) {
      setExpandedId(null);
      setPreviewContent('');
      return;
    }
    setExpandedId(snap.id);
    setPreviewLoading(true);
    const full = await invoke<NoteSnapshot>('get_snapshot_content', { snapshotId: snap.id });
    setPreviewContent(full?.content ?? '');
    setPreviewLoading(false);
  };

  const handleRestore = async (snapshotId: string) => {
    const ok = await invoke<boolean>('restore_snapshot', { noteId, snapshotId });
    if (ok !== false) {
      onRestore?.();
      onClose();
    }
  };

  const handleDelete = async (snapshotId: string) => {
    if (!confirm(t('version.deleteConfirm'))) return;
    await invoke<boolean>('delete_snapshot', { snapshotId });
    setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    if (expandedId === snapshotId) {
      setExpandedId(null);
      setPreviewContent('');
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const result = await invoke<NoteSnapshot>('create_manual_snapshot', {
      noteId,
      title: newTitle.trim(),
      description: newDesc.trim(),
    });
    if (result) {
      setSnapshots((prev) => [result, ...prev]);
      setNewTitle('');
      setNewDesc('');
      setTab('timeline');
    }
    setCreating(false);
  };

  const handleTagStart = (snap: NoteSnapshot) => {
    setTaggingId(snap.id);
    setTagTitle(snap.title);
    setTagDesc(snap.description);
  };

  const handleTagSave = async () => {
    if (!taggingId || !tagTitle.trim()) return;
    const result = await invoke<NoteSnapshot>('tag_snapshot', {
      snapshotId: taggingId,
      title: tagTitle.trim(),
      description: tagDesc.trim(),
    });
    if (result) {
      setSnapshots((prev) => prev.map((s) => (s.id === taggingId ? result : s)));
      setTaggingId(null);
    }
  };

  const handleCompare = async () => {
    if (!fromId || !toId) return;
    setDiffLoading(true);
    const result = await invoke<DiffResult>('compare_snapshots', {
      noteId,
      fromSnapshotId: fromId,
      toSnapshotId: toId,
    });
    if (result) setDiffResult(result);
    setDiffLoading(false);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{t('version.title')}</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className={styles.sourceToggle}>
          <button
            className={`${styles.sourceBtn} ${source === 'local' ? styles.activeSource : ''}`}
            onClick={() => setSource('local')}
          >
            {t('version.sourceLocal')}
          </button>
          <button
            className={`${styles.sourceBtn} ${source === 'cloud' ? styles.activeSource : ''}`}
            onClick={() => setSource('cloud')}
          >
            {t('version.sourceCloud')}
          </button>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'timeline' ? styles.activeTab : ''}`} onClick={() => setTab('timeline')}>
            {t('version.timelineTab')}
          </button>
          <button className={`${styles.tab} ${tab === 'compare' ? styles.activeTab : ''}`} onClick={() => setTab('compare')}>
            {t('version.compareTab')}
          </button>
          <button className={`${styles.tab} ${tab === 'create' ? styles.activeTab : ''}`} onClick={() => setTab('create')}>
            {t('version.createTab')}
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'timeline' && (
            <div className={styles.timelineTab}>
              {loading ? (
                <div className={styles.loading}>{t('version.loadingSnapshots')}</div>
              ) : source === 'cloud' ? (
                cloudVersions.length === 0 ? (
                  <div className={styles.empty}>{t('version.noCloudVersions')}</div>
                ) : (
                  <div className={styles.timeline}>
                    {cloudVersions.map((cv) => (
                      <div key={cv.versionNumber} className={styles.timelineItem}>
                        <div className={styles.timelineDot} />
                        <div className={styles.timelineCard}>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardTitleRow}>
                              <span className={styles.versionBadge}>v{cv.versionNumber}</span>
                              <span className={styles.cardTitle}>{cv.title}</span>
                            </div>
                            <div className={styles.cardMeta}>
                              <span>{relativeTime(cv.createdAt, t)}</span>
                              <span className={styles.cloudBadge}>{t('version.cloudBadge')}</span>
                            </div>
                          </div>
                          {cv.description && (
                            <div className={styles.cardDesc}>{cv.description}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : snapshots.length === 0 ? (
                <div className={styles.empty}>{t('version.noSnapshots')}</div>
              ) : (
                <div className={styles.timeline}>
                  {snapshots.map((snap) => (
                    <div key={snap.id} className={styles.timelineItem}>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineCard} onClick={() => handleExpand(snap)}>
                        <div className={styles.cardHeader}>
                          <div className={styles.cardTitleRow}>
                            <span className={styles.versionBadge}>v{snap.versionNumber}</span>
                            <span className={styles.cardTitle}>{snap.title}</span>
                            {snap.isAutoSave && <span className={styles.autoBadge}>{t('version.autoBadge')}</span>}
                          </div>
                          <div className={styles.cardMeta}>
                            <span>{relativeTime(snap.createdAt, t)}</span>
                            <span className={styles.wordCount}>{t('version.words', { count: snap.wordCount })}</span>
                          </div>
                        </div>

                        {snap.description && (
                          <div className={styles.cardDesc}>{snap.description}</div>
                        )}

                        {expandedId === snap.id && (
                          <div className={styles.cardPreview}>
                            {previewLoading ? (
                              <div className={styles.previewLoading}>{t('version.loadingSnapshots')}</div>
                            ) : (
                              <pre className={styles.previewContent}>{previewContent}</pre>
                            )}
                          </div>
                        )}

                        <div className={styles.cardActions}>
                          <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleRestore(snap.id); }}>
                            {t('version.restoreSnapshot')}
                          </button>
                          {snap.isAutoSave && taggingId !== snap.id && (
                            <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleTagStart(snap); }}>
                              {t('version.tagSnapshot')}
                            </button>
                          )}
                          <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={(e) => { e.stopPropagation(); handleDelete(snap.id); }}>
                            {t('version.deleteSnapshot')}
                          </button>
                        </div>

                        {taggingId === snap.id && (
                          <div className={styles.tagForm} onClick={(e) => e.stopPropagation()}>
                            <input
                              className={styles.tagInput}
                              value={tagTitle}
                              onChange={(e) => setTagTitle(e.target.value)}
                              placeholder={t('version.snapshotName')}
                              autoFocus
                            />
                            <textarea
                              className={styles.tagTextarea}
                              value={tagDesc}
                              onChange={(e) => setTagDesc(e.target.value)}
                              placeholder={t('version.snapshotDescPlaceholder')}
                              rows={2}
                            />
                            <div className={styles.tagActions}>
                              <button className={styles.actionBtn} onClick={() => setTaggingId(null)}>{t('version.tagCancel')}</button>
                              <button className={styles.actionBtn} onClick={handleTagSave} disabled={!tagTitle.trim()}>{t('version.tagSave')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'compare' && (
            <div className={styles.compareTab}>
              <div className={styles.compareSelectors}>
                <div className={styles.selectorGroup}>
                  <label>{t('version.selectFrom')}</label>
                  <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
                    <option value="">{t('version.cancel')}</option>
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>v{s.versionNumber} - {s.title}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.selectorGroup}>
                  <label>{t('version.selectTo')}</label>
                  <select value={toId} onChange={(e) => setToId(e.target.value)}>
                    <option value="">{t('version.cancel')}</option>
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>v{s.versionNumber} - {s.title}</option>
                    ))}
                  </select>
                </div>
                <button className={styles.compareBtn} onClick={handleCompare} disabled={!fromId || !toId || diffLoading}>
                  {diffLoading ? t('version.comparing') : t('version.compare')}
                </button>
              </div>

              {diffResult && (
                <div className={styles.diffResult}>
                  <div className={styles.diffSummary}>
                    <span className={styles.similarity}>{t('version.similarity')}: {(diffResult.similarity * 100).toFixed(1)}%</span>
                    <span className={styles.changeStats}>
                      <span className={styles.added}>{t('version.added', { count: diffResult.changeSummary.linesAdded })}</span>
                      <span className={styles.removed}>{t('version.removed', { count: diffResult.changeSummary.linesRemoved })}</span>
                      <span className={styles.modified}>{t('version.modified', { count: diffResult.changeSummary.linesModified })}</span>
                    </span>
                    <span className={styles.wordDelta}>
                      {diffResult.changeSummary.wordCountDelta > 0 ? '+' : ''}{diffResult.changeSummary.wordCountDelta} {t('version.wordDiff')}
                    </span>
                  </div>
                  <div className={styles.opsList}>
                    {diffResult.operations.length === 0 ? (
                      <div className={styles.noDiff}>{t('version.noDiff')}</div>
                    ) : (
                      diffResult.operations.map((op, i) => (
                        <div key={i} className={`${styles.opLine} ${op.opType === 'add' ? styles.opAdd : styles.opRemove}`}>
                          <span className={styles.opTypeLabel}>{op.opType === 'add' ? '+' : '-'}</span>
                          <span className={styles.opLineNum}>L{op.lineNum}</span>
                          <span className={styles.opText}>{op.newText ?? op.oldText ?? ''}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'create' && (
            <div className={styles.createTab}>
              <div className={styles.formGroup}>
                <label>{t('version.snapshotName')}</label>
                <input
                  className={styles.formInput}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('version.snapshotNamePlaceholder')}
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label>{t('version.snapshotDesc')}</label>
                <textarea
                  className={styles.formTextarea}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t('version.snapshotDescPlaceholder')}
                  rows={3}
                />
              </div>
              <button className={styles.createBtn} onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                {creating ? t('version.creatingSnapshot') : t('version.createSnapshot')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
