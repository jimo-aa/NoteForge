import { useState, useEffect, useMemo } from 'react';
import { tauriInvoke as invoke } from '@/utils/invoke';
import type { Note } from '@/types';
import { DiffViewerModal } from '../Modals/DiffViewerModal';
import { MilestoneModal } from '../Modals/MilestoneModal';
import { VersionSearchModal } from '../Modals/VersionSearchModal';
import { ExportBackupModal } from '../Modals/ExportBackupModal';

/**
 * 完整的编辑器集成示例
 * 展示如何使用所有高级功能组件
 */
export function EditorWithAdvancedFeatures({
  note,
  onSave,
  onRefresh,
}: {
  note: Note | null;
  onSave: (content: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  // ============================================================
  // 状态管理
  // ============================================================
  
  const [content, setContent] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');

  // 高级功能模态框状态
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showVersionSearch, setShowVersionSearch] = useState(false);
  const [showExportBackup, setShowExportBackup] = useState(false);

  // 版本选择状态
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersions, setSelectedVersions] = useState({
    from: '',
    to: '',
  });
  const [loadingVersions, setLoadingVersions] = useState(false);

  // ============================================================
  // 初始化
  // ============================================================

  useEffect(() => {
    if (note?.content) {
      setContent(note.content);
    }
  }, [note]);

  // ============================================================
  // 版本列表加载
  // ============================================================

  const loadVersions = async () => {
    if (!note) return;
    setLoadingVersions(true);
    const data = await invoke<any[]>('list_note_versions_cached', {
      note_id: note.meta.id,
    });
    if (data && data.length > 0) {
      setVersions(data);
      // 自动选择最新的两个版本
      if (data.length >= 2) {
        setSelectedVersions({
          from: data[1].id,
          to: data[0].id,
        });
      }
    }
    setLoadingVersions(false);
  };

  // ============================================================
  // 高级功能回调
  // ============================================================

  const handleOpenDiffViewer = async () => {
    await loadVersions();
    setShowDiffViewer(true);
  };

  const handleMilestoneCheckout = async (milestoneId: string) => {
    const content = await invoke<string>('checkout_milestone', {
      note_id: note?.meta.id,
      milestone_id: milestoneId,
    });
    if (content) {
      setContent(content);
      await onRefresh();
    }
  };

  const handleExport = async (format: string, target: string) => {
    if (!note) return;

    let filename = '';
    if (target === 'note') {
      filename = `${note.meta.title}.${format === 'markdown' ? 'md' : format}`;
    }
    // 导出逻辑会在ExportBackupModal中处理
  };

  // ============================================================
  // 渲染函数
  // ============================================================

  if (!note) {
    return (
      <div className="editor-empty">
        <p>选择一个笔记来开始编辑</p>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* 高级功能工具栏 */}
      <div className="advanced-features-toolbar">
        <div className="toolbar-section">
          <span className="section-label">🚀 高级功能</span>

          {/* Diff对比 */}
          <button
            className="toolbar-btn"
            onClick={() => void handleOpenDiffViewer()}
            title="对比两个版本的差异"
            disabled={loadingVersions}
          >
            📊 Diff
          </button>

          {/* 版本选择 */}
          {selectedVersions.from && selectedVersions.to && (
            <div className="version-select-group">
              <select
                value={selectedVersions.from}
                onChange={(e) =>
                  setSelectedVersions({ ...selectedVersions, from: e.target.value })
                }
                className="version-select mini"
                title="选择源版本"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title.slice(0, 20)}
                  </option>
                ))}
              </select>
              <span className="select-arrow">→</span>
              <select
                value={selectedVersions.to}
                onChange={(e) =>
                  setSelectedVersions({ ...selectedVersions, to: e.target.value })
                }
                className="version-select mini"
                title="选择目标版本"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title.slice(0, 20)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="toolbar-section">
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
            🔍 搜索
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

        {/* 编辑/预览切换 */}
        <div className="toolbar-section">
          <button
            className={`toolbar-btn ${editorMode === 'edit' ? 'active' : ''}`}
            onClick={() => setEditorMode('edit')}
            title="编辑模式"
          >
            ✎ 编辑
          </button>
          <button
            className={`toolbar-btn ${editorMode === 'preview' ? 'active' : ''}`}
            onClick={() => setEditorMode('preview')}
            title="预览模式"
          >
            👁️ 预览
          </button>
        </div>
      </div>

      {/* 编辑器内容区域 */}
      <div className="editor-content">
        {editorMode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => void onSave(content)}
            className="editor-textarea"
            placeholder="开始编写笔记..."
            spellCheck="false"
          />
        ) : (
          <div className="editor-preview">
            <div className="preview-content">
              {/* 这里应该使用Markdown渲染 */}
              <pre>{content}</pre>
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="editor-statusbar">
        <span className="status-item">
          {content.length} 字符
        </span>
        <span className="status-item">
          {content.split('\n').length} 行
        </span>
        <span className="status-item">
          {Math.ceil(content.split(/\s+/).length)} 词
        </span>
      </div>

      {/* 高级功能模态框 */}
      <DiffViewerModal
        open={showDiffViewer}
        noteId={note.meta.id}
        fromVersion={selectedVersions.from}
        toVersion={selectedVersions.to}
        onClose={() => setShowDiffViewer(false)}
      />

      <MilestoneModal
        open={showMilestones}
        noteId={note.meta.id}
        onClose={() => setShowMilestones(false)}
        onCheckout={handleMilestoneCheckout}
      />

      <VersionSearchModal
        open={showVersionSearch}
        noteId={note.meta.id}
        onClose={() => setShowVersionSearch(false)}
      />

      <ExportBackupModal
        open={showExportBackup}
        noteId={note.meta.id}
        noteTitle={note.meta.title}
        notebookId={note.meta.notebookId ?? undefined}
        notebookName="笔记本"
        onClose={() => setShowExportBackup(false)}
      />
    </div>
  );
}

// 样式补充
const editorStyles = `
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background-primary);
}

.editor-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  font-size: 16px;
}

.editor-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-textarea {
  flex: 1;
  padding: 16px;
  border: none;
  resize: none;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: var(--background-primary);
  color: var(--text-primary);
  outline: none;
}

.editor-preview {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.preview-content {
  max-width: 800px;
  line-height: 1.8;
}

.editor-statusbar {
  display: flex;
  gap: 24px;
  padding: 8px 16px;
  background: var(--surface-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-tertiary);
}

.status-item {
  display: flex;
  align-items: center;
}

.version-select-group {
  display: flex;
  align-items: center;
  gap: 4px;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  padding: 0 8px;
}

.select-arrow {
  color: var(--text-tertiary);
  font-weight: 600;
}
`;
