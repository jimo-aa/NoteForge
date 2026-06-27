import { useState, useEffect } from 'react';
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
          <h2>版本对比</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="modal-content-large">
            <div className="loading-state">加载中...</div>
          </div>
        ) : diff ? (
          <>
            <div className="diff-stats">
              <div className="stats-row">
                <div className="stat-item">
                  <span className="stat-label">相似度</span>
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
                  <span className="stat-label">字数变化</span>
                  <span className={`stat-value ${diff.change_summary.word_count_delta >= 0 ? 'positive' : 'negative'}`}>
                    {diff.change_summary.word_count_delta > 0 ? '+' : ''}{diff.change_summary.word_count_delta}
                  </span>
                </div>
              </div>
            </div>

            <div className="diff-options">
              <label>上下文行数：</label>
              <select value={contextLines} onChange={(e) => setContextLines(Number(e.target.value))}>
                <option value={1}>1行</option>
                <option value={3}>3行</option>
                <option value={5}>5行</option>
                <option value={10}>10行</option>
              </select>
            </div>

            <div className="modal-content-large">
              <div className="diff-operations">
                {diff.operations.length > 0 ? (
                  diff.operations.map((op, idx) => (
                    <div key={idx} className={`diff-operation diff-${op.op_type}`}>
                      <div className="operation-header">
                        <span className="line-num">行 {op.line_num}</span>
                        <span className={`op-type op-type-${op.op_type}`}>
                          {op.op_type === 'add' ? '➕ 添加' : op.op_type === 'remove' ? '➖ 删除' : '✏️ 修改'}
                        </span>
                      </div>
                      {op.old_text && (
                        <div className="operation-old">
                          <span className="label">旧文本</span>
                          <code>{op.old_text}</code>
                        </div>
                      )}
                      {op.new_text && (
                        <div className="operation-new">
                          <span className="label">新文本</span>
                          <code>{op.new_text}</code>
                        </div>
                      )}
                      <div className="operation-context">
                        <span className="context-label">上下文</span>
                        <pre>{op.context}</pre>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-changes">没有检测到改动</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="modal-content-large">
            <div className="error-state">加载失败，请重试</div>
          </div>
        )}
      </div>
    </div>
  );
}
