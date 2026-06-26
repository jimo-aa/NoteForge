import { useState, useEffect } from 'react';
import styles from './AdvancedVersioningPanel.module.css';

interface DiffResult {
  from_version: string;
  to_version: string;
  operations: DiffOperation[];
  similarity: number;
  change_summary: ChangeSummary;
}

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

interface Milestone {
  id: string;
  note_id: string;
  name: string;
  description?: string;
  commit_id: string;
  version_number: number;
  created_at: number;
  tags: string[];
}

interface GitVersionEntry {
  id: string;
  title: string;
  updated_at: number;
  summary: string;
  branch: string;
  parent_count: number;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`Command ${cmd} failed:`, error);
    return null;
  }
}

export function AdvancedVersioningPanel({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'diff' | 'milestone' | 'export' | 'search'>('diff');
  
  // Diff tab
  const [versions, setVersions] = useState<GitVersionEntry[]>([]);
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  
  // Milestone tab
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDesc, setNewMilestoneDesc] = useState('');
  const [newMilestoneVersion, setNewMilestoneVersion] = useState(1);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  
  // Export tab
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html' | 'json'>('markdown');
  const [exporting, setExporting] = useState(false);
  
  // Search tab
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GitVersionEntry[]>([]);
  const [searching, setSearching] = useState(false);

  // Load versions on mount
  useEffect(() => {
    if (!noteId) return;
    const loadVersions = async () => {
      const data = await invoke<GitVersionEntry[]>('list_note_versions_cached', { note_id: noteId });
      if (data) {
        setVersions(data);
        if (data.length >= 2) {
          setSelectedFrom(data[data.length - 1].id);
          setSelectedTo(data[0].id);
        }
      }
    };
    loadVersions();
  }, [noteId]);

  // Load milestones
  useEffect(() => {
    if (activeTab !== 'milestone' || !noteId) return;
    const loadMilestones = async () => {
      setLoadingMilestones(true);
      const data = await invoke<Milestone[]>('list_milestones', { note_id: noteId });
      if (data) setMilestones(data);
      setLoadingMilestones(false);
    };
    loadMilestones();
  }, [activeTab, noteId]);

  // Diff calculation
  const handleComputeDiff = async () => {
    if (!selectedFrom || !selectedTo || !noteId) return;
    
    setLoadingDiff(true);
    const result = await invoke<DiffResult>('get_version_diff_cached', {
      note_id: noteId,
      from_commit: selectedFrom,
      to_commit: selectedTo
    });
    if (result) setDiff(result);
    setLoadingDiff(false);
  };

  // Create milestone
  const handleCreateMilestone = async () => {
    if (!newMilestoneName || !noteId) return;
    
    setCreatingMilestone(true);
    const result = await invoke<Milestone>('create_milestone', {
      note_id: noteId,
      name: newMilestoneName,
      description: newMilestoneDesc || null,
      version_number: newMilestoneVersion
    });
    
    if (result) {
      setMilestones([result, ...milestones]);
      setNewMilestoneName('');
      setNewMilestoneDesc('');
      setNewMilestoneVersion(newMilestoneVersion + 1);
    }
    setCreatingMilestone(false);
  };

  // Export note
  const handleExport = async () => {
    if (!noteId) return;
    
    setExporting(true);
    const data = await invoke<number[]>('export_note', {
      note_id: noteId,
      format: exportFormat
    });
    
    if (data) {
      const blob = new Blob([new Uint8Array(data)], {
        type: exportFormat === 'markdown' ? 'text/markdown' : 
              exportFormat === 'html' ? 'text/html' : 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note.${exportFormat === 'markdown' ? 'md' : exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  // Search versions
  const handleSearch = async () => {
    if (!searchQuery || !noteId) return;
    
    setSearching(true);
    const data = await invoke<GitVersionEntry[]>('search_versions_cached', {
      note_id: noteId,
      query: searchQuery
    });
    if (data) setSearchResults(data);
    setSearching(false);
  };

  // Checkout milestone
  const handleCheckoutMilestone = async (milestone: Milestone) => {
    const content = await invoke<string>('checkout_milestone', {
      note_id: noteId,
      milestone_id: milestone.id
    });
    if (content) {
      console.log('Checked out milestone:', milestone.name);
      onClose();
    }
  };

  // Delete milestone
  const handleDeleteMilestone = async (milestone: Milestone) => {
    const confirmed = window.confirm(`确定删除里程碑 "${milestone.name}" 吗？`);
    if (!confirmed) return;
    
    const result = await invoke<boolean>('delete_milestone', {
      note_id: noteId,
      milestone_id: milestone.id
    });
    if (result) {
      setMilestones(milestones.filter(m => m.id !== milestone.id));
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>高级版本控制</h2>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'diff' ? styles.active : ''}`}
          onClick={() => setActiveTab('diff')}
        >
          📊 版本对比
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'milestone' ? styles.active : ''}`}
          onClick={() => setActiveTab('milestone')}
        >
          🎯 里程碑
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'export' ? styles.active : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📦 导出/备份
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 搜索版本
        </button>
      </div>

      <div className={styles.content}>
        {/* Diff Tab */}
        {activeTab === 'diff' && (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <label>从版本:</label>
              <select value={selectedFrom || ''} onChange={(e) => setSelectedFrom(e.target.value)}>
                <option value="">选择版本...</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({new Date(v.updated_at).toLocaleString()})
                  </option>
                ))}
              </select>

              <label style={{ marginTop: '1rem' }}>到版本:</label>
              <select value={selectedTo || ''} onChange={(e) => setSelectedTo(e.target.value)}>
                <option value="">选择版本...</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({new Date(v.updated_at).toLocaleString()})
                  </option>
                ))}
              </select>

              <button 
                className={styles.btn}
                onClick={handleComputeDiff}
                disabled={loadingDiff || !selectedFrom || !selectedTo}
                style={{ marginTop: '1rem' }}
              >
                {loadingDiff ? '计算中...' : '计算Diff'}
              </button>
            </div>

            {diff && (
              <div className={styles.diffResult}>
                <div className={styles.diffHeader}>
                  <span className={styles.similarity}>
                    相似度: {(diff.similarity * 100).toFixed(1)}%
                  </span>
                  <span className={styles.stats}>
                    +{diff.change_summary.lines_added} 
                    -{diff.change_summary.lines_removed} 
                    ~{diff.change_summary.lines_modified}
                  </span>
                </div>

                <div className={styles.operations}>
                  {diff.operations.slice(0, 20).map((op, idx) => (
                    <div key={idx} className={`${styles.operation} ${styles[op.op_type]}`}>
                      <span className={styles.opType}>
                        {op.op_type === 'add' ? '➕' : op.op_type === 'remove' ? '➖' : '✏️'}
                      </span>
                      <span className={styles.opLine}>Line {op.line_num}</span>
                      <span className={styles.opText}>
                        {op.old_text && <span className={styles.oldText}>{op.old_text.substring(0, 50)}</span>}
                        {op.new_text && <span className={styles.newText}>{op.new_text.substring(0, 50)}</span>}
                      </span>
                    </div>
                  ))}
                  {diff.operations.length > 20 && (
                    <div className={styles.more}>还有 {diff.operations.length - 20} 个变更...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Milestone Tab */}
        {activeTab === 'milestone' && (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <h3>创建新里程碑</h3>
              <input 
                type="text"
                placeholder="里程碑名称 (如: v1.0)"
                value={newMilestoneName}
                onChange={(e) => setNewMilestoneName(e.target.value)}
                className={styles.input}
              />
              <textarea
                placeholder="描述 (可选)"
                value={newMilestoneDesc}
                onChange={(e) => setNewMilestoneDesc(e.target.value)}
                className={styles.textarea}
              />
              <label>版本号:</label>
              <input
                type="number"
                value={newMilestoneVersion}
                onChange={(e) => setNewMilestoneVersion(parseInt(e.target.value))}
                className={styles.input}
              />
              <button
                className={styles.btn}
                onClick={handleCreateMilestone}
                disabled={creatingMilestone || !newMilestoneName}
              >
                {creatingMilestone ? '创建中...' : '创建里程碑'}
              </button>
            </div>

            <div className={styles.section}>
              <h3>已有里程碑 ({milestones.length})</h3>
              {loadingMilestones ? (
                <p>加载中...</p>
              ) : milestones.length === 0 ? (
                <p className={styles.empty}>暂无里程碑</p>
              ) : (
                <div className={styles.milestoneList}>
                  {milestones.map(m => (
                    <div key={m.id} className={styles.milestoneItem}>
                      <div className={styles.milestoneName}>
                        <strong>{m.name}</strong>
                        <span className={styles.version}>v{m.version_number}</span>
                      </div>
                      {m.description && <p className={styles.desc}>{m.description}</p>}
                      <div className={styles.milestoneActions}>
                        <button 
                          className={styles.smallBtn}
                          onClick={() => handleCheckoutMilestone(m)}
                        >
                          切换到此版本
                        </button>
                        <button 
                          className={`${styles.smallBtn} ${styles.danger}`}
                          onClick={() => handleDeleteMilestone(m)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <h3>导出笔记</h3>
              <div className={styles.exportOptions}>
                <label>
                  <input
                    type="radio"
                    value="markdown"
                    checked={exportFormat === 'markdown'}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                  />
                  Markdown (.md)
                </label>
                <label>
                  <input
                    type="radio"
                    value="html"
                    checked={exportFormat === 'html'}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                  />
                  HTML (.html)
                </label>
                <label>
                  <input
                    type="radio"
                    value="json"
                    checked={exportFormat === 'json'}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                  />
                  JSON (.json)
                </label>
              </div>
              <button
                className={styles.btn}
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? '导出中...' : '下载导出文件'}
              </button>
            </div>
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <h3>搜索版本历史</h3>
              <div className={styles.searchBox}>
                <input
                  type="text"
                  placeholder="搜索版本标题或摘要..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className={styles.input}
                />
                <button
                  className={styles.btn}
                  onClick={handleSearch}
                  disabled={searching || !searchQuery}
                >
                  {searching ? '搜索中...' : '搜索'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className={styles.searchResults}>
                  <h4>找到 {searchResults.length} 个结果</h4>
                  {searchResults.map(result => (
                    <div key={result.id} className={styles.searchResult}>
                      <strong>{result.title}</strong>
                      <p>{result.summary.substring(0, 100)}...</p>
                      <small>{new Date(result.updated_at).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
