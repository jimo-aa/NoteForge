import { useEffect, useState } from 'react';
import type { GitVersionEntry, GitBranchEntry } from '@/types';

interface VersionControlModalProps {
  open: boolean;
  noteId: string;
  onClose: () => void;
  onCheckoutVersion: (commitId: string) => Promise<boolean>;
  onCheckoutBranch: (branch: string) => Promise<boolean>;
  onCreateBranch: (branch: string, fromCommit?: string) => Promise<boolean>;
  onRestore: () => void;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export function VersionControlModal({ open, noteId, onClose, onCheckoutVersion, onCheckoutBranch, onCreateBranch, onRestore }: VersionControlModalProps) {
  const [versions, setVersions] = useState<GitVersionEntry[]>([]);
  const [branches, setBranches] = useState<GitBranchEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [tab, setTab] = useState<'versions' | 'branches'>('versions');
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [selectedVersionForBranch, setSelectedVersionForBranch] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!open || !noteId) return;
    void (async () => {
      setLoadingVersions(true);
      const data = await invoke<GitVersionEntry[]>('list_note_versions', { noteId });
      if (data) setVersions(data);
      setLoadingVersions(false);
    })();
  }, [open, noteId]);

  useEffect(() => {
    if (!open || !noteId || tab !== 'branches') return;
    void (async () => {
      setLoadingBranches(true);
      const data = await invoke<GitBranchEntry[]>('list_note_branches', { noteId });
      if (data) setBranches(data);
      setLoadingBranches(false);
    })();
  }, [open, noteId, tab]);

  const handleCheckoutVersion = async (commitId: string) => {
    setCheckingOut(true);
    const ok = await onCheckoutVersion(commitId);
    if (ok) {
      onRestore();
      onClose();
    }
    setCheckingOut(false);
  };

  const handleCheckoutBranch = async (branch: string) => {
    setCheckingOut(true);
    const ok = await onCheckoutBranch(branch);
    if (ok) {
      onRestore();
      onClose();
    }
    setCheckingOut(false);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setCheckingOut(true);
    const ok = await onCreateBranch(newBranchName.trim(), selectedVersionForBranch || undefined);
    if (ok) {
      setNewBranchName('');
      setShowCreateBranch(false);
      setSelectedVersionForBranch(null);
      const data = await invoke<GitBranchEntry[]>('list_note_branches', { noteId });
      if (data) setBranches(data);
      onRestore();
    }
    setCheckingOut(false);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="version-control-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>版本控制</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${tab === 'versions' ? 'active' : ''}`} onClick={() => setTab('versions')}>
            ⏱ 版本历史 {versions.length > 0 ? `(${versions.length})` : ''}
          </button>
          <button className={`modal-tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>
            🌳 分支 {branches.length > 0 ? `(${branches.length})` : ''}
          </button>
        </div>

        <div className="modal-content">
          {tab === 'versions' && (
            <div className="versions-tab">
              {loadingVersions ? (
                <div className="tab-loading">加载版本中...</div>
              ) : versions.length > 0 ? (
                <div className="versions-list">
                  {versions.map((version) => (
                    <div key={version.id} className="version-item">
                      <div className="version-info">
                        <div className="version-title">{version.title}</div>
                        <div className="version-meta">
                          <span className="version-time">{new Date(version.updatedAt).toLocaleString('zh-CN')}</span>
                          <span className="version-branch">[{version.branch}]</span>
                        </div>
                        {version.summary && <p className="version-summary">{version.summary}</p>}
                      </div>
                      <button className="version-action" onClick={() => void handleCheckoutVersion(version.id)} disabled={checkingOut}>
                        ↩ 恢复
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tab-empty">暂无版本历史</div>
              )}
            </div>
          )}

          {tab === 'branches' && (
            <div className="branches-tab">
              {loadingBranches ? (
                <div className="tab-loading">加载分支中...</div>
              ) : branches.length > 0 ? (
                <div className="branches-list">
                  {branches.map((branch) => (
                    <div key={branch.name} className="branch-item">
                      <div className="branch-info">
                        <div className="branch-name">
                          {branch.isCurrent && <span className="branch-current-badge">✓</span>}
                          {branch.name}
                        </div>
                        {branch.head && <div className="branch-head">{branch.head.slice(0, 8)}</div>}
                      </div>
                      {!branch.isCurrent && (
                        <button className="branch-action" onClick={() => void handleCheckoutBranch(branch.name)} disabled={checkingOut}>
                          切换
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="create-branch-btn" onClick={() => setShowCreateBranch(true)}>
                    + 新建分支
                  </button>
                </div>
              ) : (
                <div className="tab-empty">暂无分支</div>
              )}

              {showCreateBranch && (
                <div className="create-branch-form">
                  <div className="form-group">
                    <label>分支名称</label>
                    <input value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} placeholder="输入新分支名" autoFocus />
                  </div>
                  <div className="form-group">
                    <label>基于版本 (可选)</label>
                    <select value={selectedVersionForBranch || ''} onChange={(e) => setSelectedVersionForBranch(e.target.value || null)}>
                      <option value="">使用当前版本</option>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} - {new Date(v.updatedAt).toLocaleString('zh-CN')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-actions">
                    <button className="ghost-btn" onClick={() => { setShowCreateBranch(false); setSelectedVersionForBranch(null); setNewBranchName(''); }}>
                      取消
                    </button>
                    <button className="primary-btn" onClick={() => void handleCreateBranch()} disabled={!newBranchName.trim() || checkingOut}>
                      创建
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
