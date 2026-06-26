import { useState, useEffect, useMemo } from 'react';
import type { GitVersionEntry, GitBranchEntry } from '@/types';

interface BranchNode {
  branch: string;
  commits: GitVersionEntry[];
  isExpanded: boolean;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export function VersionControlModal({ open, noteId, onClose, onCheckoutVersion, onCheckoutBranch, onCreateBranch, onRestore }: {
  open: boolean; noteId: string; onClose: () => void;
  onCheckoutVersion: (commitId: string) => Promise<boolean>;
  onCheckoutBranch: (branch: string) => Promise<boolean>;
  onCreateBranch: (branch: string, fromCommit?: string) => Promise<boolean>;
  onRestore: () => void;
}) {
  const [versions, setVersions] = useState<GitVersionEntry[]>([]);
  const [branches, setBranches] = useState<GitBranchEntry[]>([]);
  const [branchCommits, setBranchCommits] = useState<Record<string, GitVersionEntry[]>>({});
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [tab, setTab] = useState<'tree' | 'versions' | 'branches'>('tree');
  const [newBranchName, setNewBranchName] = useState('');
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [selectedVersionForBranch, setSelectedVersionForBranch] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [selectedVersion, setSelectedVersion] = useState<GitVersionEntry | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [newVersionTitle, setNewVersionTitle] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);

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

  useEffect(() => {
    if (!open || !noteId || tab !== 'tree') return;
    void (async () => {
      setLoadingBranches(true);
      const branchList = await invoke<GitBranchEntry[]>('list_note_branches', { noteId });
      if (branchList) {
        const commits: Record<string, GitVersionEntry[]> = {};
        for (const branch of branchList) {
          const branchVersions = versions.filter((v) => v.branch === branch.name);
          commits[branch.name] = branchVersions;
        }
        setBranchCommits(commits);
      }
      setLoadingBranches(false);
    })();
  }, [open, noteId, tab, versions]);

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

  const handleCreateVersion = async () => {
    if (!newVersionTitle.trim()) return;
    setCreatingVersion(true);
    const commitId = await invoke<string>('create_note_version', { 
      noteId, 
      title: newVersionTitle.trim(),
      description: newVersionDesc.trim() || null,
    });
    if (commitId) {
      setNewVersionTitle('');
      setNewVersionDesc('');
      setShowCreateVersion(false);
      const data = await invoke<GitVersionEntry[]>('list_note_versions', { noteId });
      if (data) setVersions(data);
    }
    setCreatingVersion(false);
  };

  const handleDeleteVersion = async (commitId: string) => {
    setDeletingVersion(commitId);
    const ok = await invoke<boolean>('delete_note_version', { noteId, commitId });
    if (ok !== false) {
      const data = await invoke<GitVersionEntry[]>('list_note_versions', { noteId });
      if (data) setVersions(data);
      if (selectedVersion?.id === commitId) {
        setSelectedVersion(null);
        setPreviewContent('');
      }
    }
    setDeletingVersion(null);
  };

  const handleDeleteBranch = async (branch: string) => {
    setDeletingBranch(branch);
    const ok = await invoke<boolean>('delete_note_branch', { noteId, branch });
    if (ok !== false) {
      setBranches((prev) => prev.filter((b) => b.name !== branch));
    }
    setDeletingBranch(null);
  };

  const handlePreviewVersion = async (version: GitVersionEntry) => {
    setSelectedVersion(version);
    setLoadingPreview(true);
    const content = await invoke<string>('get_note_version_content', { 
      noteId, 
      commitId: version.id 
    });
    if (content) setPreviewContent(content);
    setLoadingPreview(false);
  };

  const toggleBranchExpanded = (branch: string) => {
    const next = new Set(expandedBranches);
    if (next.has(branch)) next.delete(branch);
    else next.add(branch);
    setExpandedBranches(next);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="version-control-modal fixed-size" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>版本控制</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs horizontal">
          <button className={`modal-tab ${tab === 'tree' ? 'active' : ''}`} onClick={() => setTab('tree')}>
            🌳 分支树
          </button>
          <button className={`modal-tab ${tab === 'versions' ? 'active' : ''}`} onClick={() => setTab('versions')}>
            ⏱ 版本历史 {versions.length > 0 ? `(${versions.length})` : ''}
          </button>
          <button className={`modal-tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>
            🔀 分支管理 {branches.length > 0 ? `(${branches.length})` : ''}
          </button>
        </div>

        <div className="modal-content-large">
          {tab === 'tree' && (
            <div className="tree-tab">
              <div className="tree-header">
                <button className="primary-btn small" onClick={() => setShowCreateVersion(true)}>
                  + 新建版本
                </button>
              </div>
              {loadingBranches ? (
                <div className="tab-loading">加载中...</div>
              ) : branches.length > 0 ? (
                <div className="branch-tree">
                  {branches.map((branch) => (
                    <div key={branch.name} className="branch-node">
                      <button 
                        className="branch-toggle"
                        onClick={() => toggleBranchExpanded(branch.name)}
                      >
                        {expandedBranches.has(branch.name) ? '▼' : '▶'} {branch.isCurrent && '●'} {branch.name}
                      </button>
                      {expandedBranches.has(branch.name) && (
                        <div className="branch-commits">
                          {branchCommits[branch.name]?.map((version) => (
                            <div key={version.id} className="commit-item" onClick={() => handlePreviewVersion(version)}>
                              <div className="commit-dot" />
                              <div className="commit-info">
                                <div className="commit-title">{version.title}</div>
                                <div className="commit-meta">{new Date(version.updatedAt).toLocaleString('zh-CN')}</div>
                              </div>
                              <button 
                                className="commit-action" 
                                onClick={() => void handleCheckoutVersion(version.id)}
                                disabled={checkingOut}
                              >
                                ↩
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tab-empty">暂无分支</div>
              )}
            </div>
          )}

          {tab === 'versions' && (
            <div className="versions-split">
              <div className="versions-list-pane">
                <div className="list-header">
                  <button className="primary-btn small" onClick={() => setShowCreateVersion(true)}>
                    + 新建版本
                  </button>
                </div>
                {loadingVersions ? (
                  <div className="tab-loading">加载版本中...</div>
                ) : versions.length > 0 ? (
                  <div className="versions-list">
                    {versions.map((version) => (
                      <div 
                        key={version.id} 
                        className={`version-item-list ${selectedVersion?.id === version.id ? 'active' : ''}`}
                        onClick={() => handlePreviewVersion(version)}
                      >
                        <div className="version-title">{version.title}</div>
                        <div className="version-meta">{new Date(version.updatedAt).toLocaleString('zh-CN')}</div>
                        <div className="version-item-actions">
                          <button 
                            className="version-restore"
                            onClick={(e) => { e.stopPropagation(); void handleCheckoutVersion(version.id); }}
                            disabled={checkingOut}
                            title="恢复此版本"
                          >
                            ↩
                          </button>
                          <button
                            className="version-delete"
                            onClick={(e) => { e.stopPropagation(); void handleDeleteVersion(version.id); }}
                            disabled={deletingVersion === version.id}
                            title="删除此版本"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tab-empty">暂无版本历史</div>
                )}
              </div>
              <div className="version-preview-pane">
                {selectedVersion ? (
                  <div className="preview-panel">
                    <div className="preview-header">
                      <h3>{selectedVersion.title}</h3>
                      <span className="preview-time">{new Date(selectedVersion.updatedAt).toLocaleString('zh-CN')}</span>
                    </div>
                    {loadingPreview ? (
                      <div className="preview-loading">加载内容中...</div>
                    ) : (
                      <div className="preview-content">
                        <pre>{previewContent}</pre>
                      </div>
                    )}
                    {selectedVersion.summary && (
                      <div className="preview-footer">
                        <p><strong>描述：</strong></p>
                        <p>{selectedVersion.summary}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="preview-empty">选择版本查看内容</div>
                )}
              </div>
            </div>
          )}

          {tab === 'branches' && (
            <div className="branches-tab">
              {loadingBranches ? (
                <div className="tab-loading">加载分支中...</div>
              ) : branches.length > 0 ? (
                    <div className="branches-list">
                  {branches.map((branch) => (
                    <div key={branch.name} className="branch-item-full">
                      <div className="branch-info">
                        <div className="branch-name-full">
                          {branch.isCurrent && <span className="branch-current-badge">✓</span>}
                          {branch.name}
                        </div>
                        {branch.head && <div className="branch-head">{branch.head.slice(0, 8)}</div>}
                      </div>
                      <div className="branch-actions">
                        {!branch.isCurrent && (
                          <button className="branch-action" onClick={() => void handleCheckoutBranch(branch.name)} disabled={checkingOut} title="切换到此分支">
                            切换
                          </button>
                        )}
                        {branch.name !== 'main' && (
                          <button 
                            className="branch-action delete" 
                            onClick={() => void handleDeleteBranch(branch.name)}
                            disabled={deletingBranch === branch.name}
                            title="删除此分支"
                          >
                            🗑
                          </button>
                        )}
                      </div>
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

          {showCreateVersion && (
            <div className="modal-backdrop-inner" onClick={() => setShowCreateVersion(false)}>
              <div className="create-version-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>新建版本</h3>
                  <button className="modal-close" onClick={() => setShowCreateVersion(false)}>×</button>
                </div>
                <div className="create-version-form">
                  <div className="form-group">
                    <label>版本标题</label>
                    <input 
                      value={newVersionTitle} 
                      onChange={(e) => setNewVersionTitle(e.target.value)} 
                      placeholder="例如：重构介绍段落" 
                      autoFocus 
                    />
                  </div>
                  <div className="form-group">
                    <label>版本描述 (可选)</label>
                    <textarea 
                      value={newVersionDesc} 
                      onChange={(e) => setNewVersionDesc(e.target.value)} 
                      placeholder="记录此版本的改动内容"
                      rows={3}
                    />
                  </div>
                  <div className="form-actions">
                    <button className="ghost-btn" onClick={() => { setShowCreateVersion(false); setNewVersionTitle(''); setNewVersionDesc(''); }}>
                      取消
                    </button>
                    <button className="primary-btn" onClick={() => void handleCreateVersion()} disabled={!newVersionTitle.trim() || creatingVersion}>
                      {creatingVersion ? '创建中...' : '创建'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
