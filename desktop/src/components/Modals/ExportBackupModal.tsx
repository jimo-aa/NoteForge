import { useState } from 'react';
import '../../../styles/modals.css';
import { tauriInvoke as invoke } from '@/utils/invoke';

type ExportFormat = 'markdown' | 'html' | 'json';

function downloadFile(data: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportBackupModal({ 
  open, 
  noteId,
  noteTitle,
  notebookId,
  notebookName,
  onClose,
}: { 
  open: boolean; 
  noteId: string;
  noteTitle: string;
  notebookId?: string;
  notebookName?: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'export' | 'backup'>('export');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportTarget, setExportTarget] = useState<'note' | 'notebook'>('note');
  const [exporting, setExporting] = useState(false);
  const [backupPath, setBackupPath] = useState('');
  const [backing, setBacking] = useState(false);
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setMessage('');

    try {
      let data: Uint8Array | null = null;
      let filename = '';
      let mimeType = '';

      if (exportTarget === 'note') {
        data = await invoke<Uint8Array>('export_note', {
          note_id: noteId,
          format: exportFormat,
        });
        const ext = exportFormat === 'markdown' ? 'md' : exportFormat;
        filename = `${noteTitle}.${ext}`;
        mimeType = {
          markdown: 'text/markdown',
          html: 'text/html',
          json: 'application/json',
        }[exportFormat];
      } else if (notebookId) {
        data = await invoke<Uint8Array>('export_notebook', {
          notebook_id: notebookId,
          format: exportFormat,
        });
        const ext = exportFormat === 'markdown' ? 'md' : 'json';
        filename = `${notebookName}-export.${ext}`;
        mimeType = exportFormat === 'markdown' ? 'text/markdown' : 'application/json';
      }

      if (data) {
        downloadFile(data, filename, mimeType);
        setMessage('✓ 导出成功');
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage('✗ 导出失败');
      }
    } catch (error) {
      setMessage(`✗ 错误: ${error}`);
    }

    setExporting(false);
  };

  const handleBackup = async () => {
    if (backing || !backupPath.trim()) return;
    setBacking(true);
    setMessage('');

    try {
      const success = await invoke<boolean>('backup_note', {
        note_id: noteId,
        backup_path: backupPath.trim(),
      });

      if (success) {
        setMessage('✓ 备份成功');
        setBackupPath('');
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage('✗ 备份失败');
      }
    } catch (error) {
      setMessage(`✗ 错误: ${error}`);
    }

    setBacking(false);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="export-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>导出与备份</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs horizontal">
          <button 
            className={`modal-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            📤 导出
          </button>
          <button 
            className={`modal-tab ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            💾 备份
          </button>
        </div>

        <div className="modal-content-large">
          {activeTab === 'export' && (
            <div className="export-panel">
              <div className="form-group">
                <label>导出对象</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input 
                      type="radio"
                      checked={exportTarget === 'note'}
                      onChange={() => setExportTarget('note')}
                    />
                    <span>当前笔记</span>
                  </label>
                  {notebookId && (
                    <label className="radio-option">
                      <input 
                        type="radio"
                        checked={exportTarget === 'notebook'}
                        onChange={() => setExportTarget('notebook')}
                      />
                      <span>整个笔记本</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>导出格式</label>
                <div className="format-options">
                  <button 
                    className={`format-btn ${exportFormat === 'markdown' ? 'active' : ''}`}
                    onClick={() => setExportFormat('markdown')}
                  >
                    <span className="format-icon">📝</span>
                    <span className="format-name">Markdown</span>
                    <span className="format-ext">.md</span>
                  </button>
                  <button 
                    className={`format-btn ${exportFormat === 'html' ? 'active' : ''}`}
                    onClick={() => setExportFormat('html')}
                  >
                    <span className="format-icon">🌐</span>
                    <span className="format-name">HTML</span>
                    <span className="format-ext">.html</span>
                  </button>
                  <button 
                    className={`format-btn ${exportFormat === 'json' ? 'active' : ''}`}
                    onClick={() => setExportFormat('json')}
                  >
                    <span className="format-icon">{ }</span>
                    <span className="format-name">JSON</span>
                    <span className="format-ext">.json</span>
                  </button>
                </div>
              </div>

              <div className="format-info">
                {exportFormat === 'markdown' && (
                  <p>• 保存为Markdown格式，方便在其他编辑器中打开<br/>• 完全保留原始内容和格式</p>
                )}
                {exportFormat === 'html' && (
                  <p>• 导出为可视化的HTML网页<br/>• 适合在浏览器中查看和分享</p>
                )}
                {exportFormat === 'json' && (
                  <p>• 导出完整的笔记数据包括元数据<br/>• 保留所有标签、链接等信息</p>
                )}
              </div>

              {message && (
                <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}

              <div className="modal-actions">
                <button className="ghost-btn" onClick={onClose}>
                  取消
                </button>
                <button 
                  className="primary-btn"
                  onClick={() => void handleExport()}
                  disabled={exporting}
                >
                  {exporting ? '导出中...' : '📤 开始导出'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="backup-panel">
              <div className="backup-info">
                <div className="info-box">
                  <p><strong>什么是备份？</strong></p>
                  <p>备份会将笔记的完整数据（包括所有元数据）保存到本地文件，方便后续恢复。</p>
                </div>
              </div>

              <div className="form-group">
                <label>备份文件路径 *</label>
                <div className="path-input-group">
                  <input 
                    type="text"
                    value={backupPath}
                    onChange={(e) => setBackupPath(e.target.value)}
                    placeholder="例如：/backups/note-backup.json 或 D:\\backups\\note.json"
                  />
                  <button 
                    className="ghost-btn small"
                    onClick={() => {
                      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                      const defaultPath = `/backups/${noteTitle}-${timestamp}.json`;
                      setBackupPath(defaultPath);
                    }}
                  >
                    🕐 自动生成
                  </button>
                </div>
              </div>

              {message && (
                <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}

              <div className="modal-actions">
                <button className="ghost-btn" onClick={onClose}>
                  取消
                </button>
                <button 
                  className="primary-btn"
                  onClick={() => void handleBackup()}
                  disabled={backing || !backupPath.trim()}
                >
                  {backing ? '备份中...' : '💾 开始备份'}
                </button>
              </div>

              <div className="backup-tips">
                <p><strong>💡 提示：</strong></p>
                <ul>
                  <li>建议定期为重要笔记创建备份</li>
                  <li>备份文件建议保存在云盘或外部存储</li>
                  <li>可以通过"恢复"功能从备份文件恢复笔记</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
