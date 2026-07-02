import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/modals.css';
import { tauriInvoke as invoke } from '@/utils/invoke';

interface DiffOperation {
  op_type: 'add' | 'remove' | 'modify';
  line_num: number;
  old_text?: string;
  new_text?: string;
  context: string;
}

interface ChangeSummary {
  lines_added: number;
  lines_removed: number;
  lines_modified: number;
  word_count_delta: number;
}

interface DiffResult {
  from_version: string;
  to_version: string;
  operations: DiffOperation[];
  similarity: number;
  change_summary: ChangeSummary;
}

export function DiffViewerModal({ 
  open, 
  noteId, 
  fromVersion, 
  toVersion,
  onClose 
}: { 
  open: boolean; 
  noteId: string;
  fromVersion: string;
  toVersion: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextLines, setContextLines] = useState(3);

  useEffect(() => {
    if (!open || !noteId || !fromVersion || !toVersion) return;

    void (async () => {
      setLoading(true);
      const result = await invoke<DiffResult>('compare_versions_with_context', {
        note_id: noteId,
        from_commit: fromVersion,
        to_commit: toVersion,
        context_lines: contextLines,
      });
      if (result) setDiff(result);
      setLoading(false);
    })();
  }, [open, noteId, fromVersion, toVersion, contextLines]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="diff-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('diff.title')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="modal-content-large">
            <div className="loading-state">{t('common.loading')}</div>
          </div>
        ) : diff ? (
          <>
            <div className="diff-stats">
              <div className="stats-row">
                <div className="stat-item">
                  <span className="stat-label">{t('diff.similarity')}</span>
                  <span className="stat-value">{(diff.similarity * 100).toFixed(1)}%</span>
                </div>
                <div className="stat-item added">
                  <span className="stat-label">+</span>
                  <span className="stat-value">{diff.change_summary.lines_added}</span>
                </div>
                <div className="stat-item removed">
                  <span className="stat-label">−</span>
                  <span className="stat-value">{diff.change_summary.lines_removed}</span>
                </div>
                <div className="stat-item modified">
                  <span className="stat-label">~</span>
                  <span className="stat-value">{diff.change_summary.lines_modified}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('diff.wordCountDelta')}</span>
                  <span className={`stat-value ${diff.change_summary.word_count_delta >= 0 ? 'positive' : 'negative'}`}>
                    {diff.change_summary.word_count_delta > 0 ? '+' : ''}{diff.change_summary.word_count_delta}
                  </span>
                </div>
              </div>
            </div>

            <div className="diff-options">
              <label>{t('diff.contextLines')}</label>
              <select value={contextLines} onChange={(e) => setContextLines(Number(e.target.value))}>
                <option value={1}>{t('diff.lineCount', { count: 1 })}</option>
                <option value={3}>{t('diff.lineCount', { count: 3 })}</option>
                <option value={5}>{t('diff.lineCount', { count: 5 })}</option>
                <option value={10}>{t('diff.lineCount', { count: 10 })}</option>
              </select>
            </div>

            <div className="modal-content-large">
              <div className="diff-operations">
                {diff.operations.length > 0 ? (
                  diff.operations.map((op, idx) => (
                    <div key={idx} className={`diff-operation diff-${op.op_type}`}>
                      <div className="operation-header">
                        <span className="line-num">{t('diff.lineLabel', { num: op.line_num })}</span>
                        <span className={`op-type op-type-${op.op_type}`}>
                          {op.op_type === 'add' ? t('diff.opAdd') : op.op_type === 'remove' ? t('diff.opRemove') : t('diff.opModify')}
                        </span>
                      </div>
                      {op.old_text && (
                        <div className="operation-old">
                          <span className="label">{t('diff.oldText')}</span>
                          <code>{op.old_text}</code>
                        </div>
                      )}
                      {op.new_text && (
                        <div className="operation-new">
                          <span className="label">{t('diff.newText')}</span>
                          <code>{op.new_text}</code>
                        </div>
                      )}
                      <div className="operation-context">
                        <span className="context-label">{t('diff.context')}</span>
                        <pre>{op.context}</pre>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-changes">{t('diff.noChanges')}</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="modal-content-large">
            <div className="error-state">{t('diff.loadFailed')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
