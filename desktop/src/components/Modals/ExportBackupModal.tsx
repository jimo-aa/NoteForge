import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/modals.css';
import { tauriInvoke as invoke } from '@/utils/invoke';

type ExportFormat = 'markdown' | 'html' | 'json';

function downloadFile(data: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
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
  const { t } = useTranslation();
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
        setMessage(t('export.exportSuccess'));
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage(t('export.exportFailed'));
      }
    } catch (error) {
      setMessage(t('export.exportError', { error: String(error) }));
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
        setMessage(t('export.backupSuccess'));
        setBackupPath('');
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage(t('export.backupFailed'));
      }
    } catch (error) {
      setMessage(t('export.exportError', { error: String(error) }));
    }

    setBacking(false);
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="export-backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('export.title')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs horizontal">
          <button 
            className={`modal-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            {t('export.export')}
          </button>
          <button 
            className={`modal-tab ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            {t('export.backup')}
          </button>
        </div>

        <div className="modal-content-large">
          {activeTab === 'export' && (
            <div className="export-panel">
              <div className="form-group">
                <label>{t('export.exportTarget')}</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input 
                      type="radio"
                      checked={exportTarget === 'note'}
                      onChange={() => setExportTarget('note')}
                    />
                    <span>{t('export.targetNote')}</span>
                  </label>
                  {notebookId && (
                    <label className="radio-option">
                      <input 
                        type="radio"
                        checked={exportTarget === 'notebook'}
                        onChange={() => setExportTarget('notebook')}
                      />
                      <span>{t('export.targetNotebook')}</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>{t('export.exportFormat')}</label>
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
                  <p>{t('export.formatInfoMarkdown')}</p>
                )}
                {exportFormat === 'html' && (
                  <p>{t('export.formatInfoHtml')}</p>
                )}
                {exportFormat === 'json' && (
                  <p>{t('export.formatInfoJson')}</p>
                )}
              </div>

              {message && (
                <div className={`message ${message.includes('✓') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}

              <div className="modal-actions">
                <button className="ghost-btn" onClick={onClose}>
                  {t('common.cancel')}
                </button>
                <button 
                  className="primary-btn"
                  onClick={() => void handleExport()}
                  disabled={exporting}
                >
                  {exporting ? t('export.exporting') : t('export.startExport')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="backup-panel">
              <div className="backup-info">
                <div className="info-box">
                  <p><strong>{t('export.backupWhatTitle')}</strong></p>
                  <p>{t('export.backupWhatDesc')}</p>
                </div>
              </div>

              <div className="form-group">
                <label>{t('export.backupPathLabel')}</label>
                <div className="path-input-group">
                  <input 
                    type="text"
                    value={backupPath}
                    onChange={(e) => setBackupPath(e.target.value)}
                    placeholder={t('export.backupPathPlaceholder')}
                  />
                  <button 
                    className="ghost-btn small"
                    onClick={() => {
                      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                      const defaultPath = `/backups/${noteTitle}-${timestamp}.json`;
                      setBackupPath(defaultPath);
                    }}
                  >
                    {t('export.autoGenerate')}
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
                  {t('common.cancel')}
                </button>
                <button 
                  className="primary-btn"
                  onClick={() => void handleBackup()}
                  disabled={backing || !backupPath.trim()}
                >
                  {backing ? t('export.backing') : t('export.startBackup')}
                </button>
              </div>

              <div className="backup-tips">
                <p><strong>{t('export.tipsTitle')}</strong></p>
                <ul>
                  <li>{t('export.tipRegular')}</li>
                  <li>{t('export.tipStorage')}</li>
                  <li>{t('export.tipRestore')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
