import { useState } from 'react';
import { DiffViewerModal } from './DiffViewerModal';
import { MilestoneModal } from './MilestoneModal';
import { VersionSearchModal } from './VersionSearchModal';
import { ExportBackupModal } from './ExportBackupModal';
import { tauriInvoke as invoke } from '@/utils/invoke';

interface GitVersionEntry {
  id: string;
  title: string;
  updatedAt: number;
  summary?: string;
}

export function AdvancedFeaturesToolbar({ 
  noteId,
  noteTitle,
  notebookId,
  notebookName,
  onVersionRestored,
}: { 
  noteId: string;
  noteTitle: string;
  notebookId?: string;
  notebookName?: string;
  onVersionRestored?: () => void;
}) {
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showVersionSearch, setShowVersionSearch] = useState(false);
  const [showExportBackup, setShowExportBackup] = useState(false);

  const [diffVersions, setDiffVersions] = useState({ from: '', to: '' });
  const [versions, setVersions] = useState<GitVersionEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const handleSelectDiffVersions = async () => {
    setLoadingVersions(true);
    const data = await invoke<GitVersionEntry[]>('list_note_versions_cached', {
      note_id: noteId,
    });
    if (data && data.length >= 2) {
      setVersions(data);
      // 自动选择最新的两个版本
      setDiffVersions({
        from: data[1].id,
        to: data[0].id,
      });
    }
    setLoadingVersions(false);
  };

  const handleMilestoneCheckout = async (milestoneId: string) => {
    const content = await invoke<string>('checkout_milestone', {
      note_id: noteId,
      milestone_id: milestoneId,
    });
    if (content && onVersionRestored) {
      onVersionRestored();
    }
  };

  return (
    <>
      <div className="advanced-features-toolbar">
        <div className="toolbar-section">
          <span className="section-label">高级功能</span>

          {/* 版本对比 */}
          <div className="toolbar-group">
            <button 
              className="toolbar-btn"
              onClick={async () => {
                await handleSelectDiffVersions();
                setShowDiffViewer(true);
              }}
              title="对比两个版本的差异"
              disabled={loadingVersions}
            >
              📊 Diff
            </button>
            {diffVersions.from && diffVersions.to && (
              <select 
                className="version-select mini"
                value={diffVersions.from}
                onChange={(e) => setDiffVersions({ ...diffVersions, from: e.target.value })}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* 里程碑 */}
          <button 
            className="toolbar-btn"
            onClick={() => setShowMilestones(true)}
            title="管理版本里程碑"
          >
            🎯 里程碑
          </button>

          {/* 版本搜索 */}
          <button 
            className="toolbar-btn"
            onClick={() => setShowVersionSearch(true)}
            title="搜索版本历史"
          >
            🔍 搜索版本
          </button>

          {/* 导出/备份 */}
          <button 
            className="toolbar-btn"
            onClick={() => setShowExportBackup(true)}
            title="导出或备份笔记"
          >
            📤 导出/备份
          </button>
        </div>
      </div>

      {/* 模态框 */}
      <DiffViewerModal 
        open={showDiffViewer}
        noteId={noteId}
        fromVersion={diffVersions.from}
        toVersion={diffVersions.to}
        onClose={() => setShowDiffViewer(false)}
      />

      <MilestoneModal 
        open={showMilestones}
        noteId={noteId}
        onClose={() => setShowMilestones(false)}
        onCheckout={handleMilestoneCheckout}
      />

      <VersionSearchModal 
        open={showVersionSearch}
        noteId={noteId}
        onClose={() => setShowVersionSearch(false)}
      />

      <ExportBackupModal 
        open={showExportBackup}
        noteId={noteId}
        noteTitle={noteTitle}
        notebookId={notebookId}
        notebookName={notebookName}
        onClose={() => setShowExportBackup(false)}
      />
    </>
  );
}
