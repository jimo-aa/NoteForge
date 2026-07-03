import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { tauriInvoke as invoke } from '@/utils/invoke';
import { useStore } from '@/stores/context';
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
  const { t } = useTranslation();
  const { notebooks } = useStore();
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

  // ============================================================
  // 渲染函数
  // ============================================================

  if (!note) {
    return (
      <div className="editor-empty">
        <p>{t('editorAdvanced.selectNote')}</p>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* 高级功能工具栏 */}
      <div className="advanced-features-toolbar">
        <div className="toolbar-section">
          <span className="section-label">{t('editorAdvanced.title')}</span>

          <button
            className="toolbar-btn"
            onClick={() => void handleOpenDiffViewer()}
            title={t('editorAdvanced.diffTitle')}
            disabled={loadingVersions}
          >
            {t('editorAdvanced.diff')}
          </button>

          {selectedVersions.from && selectedVersions.to && (
            <div className="version-select-group">
              <select
                value={selectedVersions.from}
                onChange={(e) =>
                  setSelectedVersions({ ...selectedVersions, from: e.target.value })
                }
                className="version-select mini"
                title={t('editorAdvanced.sourceVersion')}
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
                title={t('editorAdvanced.targetVersion')}
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
          <button
            className="toolbar-btn"
            onClick={() => setShowMilestones(true)}
            title={t('editorAdvanced.milestoneTitle')}
          >
            {t('editorAdvanced.milestone')}
          </button>

          <button
            className="toolbar-btn"
            onClick={() => setShowVersionSearch(true)}
            title={t('editorAdvanced.versionSearchTitle')}
          >
            {t('editorAdvanced.versionSearch')}
          </button>

          <button
            className="toolbar-btn"
            onClick={() => setShowExportBackup(true)}
            title={t('editorAdvanced.exportTitle')}
          >
            {t('editorAdvanced.export')}
          </button>
        </div>

        <div className="toolbar-section">
          <button
            className={`toolbar-btn ${editorMode === 'edit' ? 'active' : ''}`}
            onClick={() => setEditorMode('edit')}
            title={t('editorAdvanced.editModeTitle')}
          >
            {t('editorAdvanced.editMode')}
          </button>
          <button
            className={`toolbar-btn ${editorMode === 'preview' ? 'active' : ''}`}
            onClick={() => setEditorMode('preview')}
            title={t('editorAdvanced.previewModeTitle')}
          >
            {t('editorAdvanced.previewMode')}
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
            placeholder={t('editor.placeholder')}
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
          {content.length} {t('editorAdvanced.chars')}
        </span>
        <span className="status-item">
          {content.split('\n').length} {t('editorAdvanced.lines')}
        </span>
        <span className="status-item">
          {Math.ceil(content.split(/\s+/).length)} {t('editorAdvanced.words')}
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
        notebookName={notebooks.find((nb) => nb.id === note.meta.notebookId)?.name ?? ''}
        onClose={() => setShowExportBackup(false)}
      />
    </div>
  );
}


