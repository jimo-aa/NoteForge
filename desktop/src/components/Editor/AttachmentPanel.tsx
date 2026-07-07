// NoteForge — 附件管理面板（增强版：上传进度 + 重命名 + 拖拽排序）

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Attachment } from '@/types';

const STORAGE_PREFIX = 'noteforge:auth';
const GATEWAY_BASE = (() => {
  try {
    const custom = window.localStorage.getItem('noteforge:api:gateway-url');
    if (custom) return custom.replace(/\/+$/, '');
  } catch { /* ignore */ }
  return 'http://localhost:8000';
})();
const API_BASE = `${GATEWAY_BASE}/api/v1/attachments`;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getToken(): string | null {
  try { return window.localStorage.getItem(`${STORAGE_PREFIX}:access-token`); } catch { return null; }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_ICONS: Record<string, string> = {
  'image/': '🖼',
  'video/': '🎬',
  'audio/': '🎵',
  'application/pdf': '📄',
  'application/zip': '📦',
  'text/': '📝',
};
function getFileIcon(mimeType: string): string {
  for (const [prefix, icon] of Object.entries(MIME_ICONS)) {
    if (mimeType.startsWith(prefix)) return icon;
  }
  return '📎';
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

interface AttachmentPanelProps {
  noteId: string;
}

export function AttachmentPanel({ noteId }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  // Track recently-synced attachment IDs (uploaded this session)
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const fetchAttachments = useCallback(async () => {
    if (!noteId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}?noteId=${encodeURIComponent(noteId)}`, { headers: getAuthHeaders() });
      if (!res.ok) { setError('获取附件列表失败'); setAttachments([]); return; }
      const json = await res.json();
      const list: Attachment[] = json.data ?? json ?? [];
      setAttachments(Array.isArray(list) ? list : []);
    } catch {
      setError('网络错误');
      setAttachments([]);
    } finally {
      setIsLoading(false);
    }
  }, [noteId, getAuthHeaders]);

  useEffect(() => { void fetchAttachments(); }, [fetchAttachments]);

  // 取消上传
  const cancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
  }, []);

  // 上传附件（带进度）
  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      if (file.size > MAX_FILE_SIZE) { setError(`文件大小不能超过 50MB: ${file.name}`); continue; }

      setIsUploading(true);
      setUploadProgress(0);
      setError('');

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('noteId', noteId);

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        await new Promise<void>((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Network error')));
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
          xhr.open('POST', `${API_BASE}/upload`);
          const authHeaders = getAuthHeaders();
          Object.entries(authHeaders).forEach(([key, val]) => xhr.setRequestHeader(key, val));
          xhr.send(formData);
        });

        await fetchAttachments();
        // Mark this file as synced
        setSyncedIds((prev) => new Set(prev).add(file.name + '-' + file.size));
      } catch (err) {
        if (err instanceof Error && err.message !== 'Upload cancelled') {
          setError(`上传失败: ${file.name}`);
        }
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        xhrRef.current = null;
      }
    }
  }, [noteId, fetchAttachments, getAuthHeaders]);

  const handleUploadClick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    void handleUpload(e.target.files);
    e.target.value = '';
  }, [handleUpload]);

  // 删除附件（带确认）
  const handleDelete = useCallback(async (attachmentId: string, fileName: string) => {
    if (!window.confirm(`确定删除附件「${fileName}」？`)) return;
    try {
      const res = await fetch(`${API_BASE}/${attachmentId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { setError('删除失败'); return; }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      setError('删除失败');
    }
  }, [getAuthHeaders]);

  // 重命名附件
  const startRename = useCallback((attachmentId: string, currentName: string) => {
    setRenamingId(attachmentId);
    setRenameDraft(currentName);
    setTimeout(() => renameInputRef.current?.select(), 50);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renamingId || !renameDraft.trim()) { setRenamingId(null); return; }
    const newName = renameDraft.trim();
    try {
      const res = await fetch(`${API_BASE}/${renamingId}`, { method: 'PATCH', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: newName }) });
      if (!res.ok) { setError('重命名失败'); return; }
      setAttachments((prev) => prev.map((a) => a.id === renamingId ? { ...a, fileName: newName } : a));
    } catch {
      setError('重命名失败');
    } finally {
      setRenamingId(null);
    }
  }, [renamingId, renameDraft, getAuthHeaders]);

  // 拖拽排序
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setAttachments((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      if (moved) updated.splice(index, 0, moved);
      return updated;
    });
    setDragIndex(index);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handleDownload = useCallback((attachment: Attachment) => {
    const token = getToken();
    const url = `${API_BASE}/${attachment.id}/download?noteId=${encodeURIComponent(attachment.noteId)}`;
    if (token) {
      void (async () => {
        try {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) { setError('下载失败'); return; }
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = attachment.fileName;
          link.click();
          URL.revokeObjectURL(blobUrl);
        } catch { setError('下载失败'); }
      })();
    } else {
      window.open(url, '_blank');
    }
  }, []);

  return (
    <div className="attachment-panel" data-note-id={noteId}>
      <div className="attachment-panel-header">
        <h4>附件 ({attachments.length})</h4>
        <div className="attachment-header-actions">
          {isUploading && (
            <button className="attachment-cancel-btn" onClick={cancelUpload} title="取消上传">✕</button>
          )}
          <label className="attachment-upload-btn" title="上传附件">
            {isUploading ? `${uploadProgress}%` : '＋'}
            <input type="file" onChange={handleUploadClick} disabled={isUploading} hidden multiple />
          </label>
        </div>
      </div>

      {/* 上传进度条 */}
      {isUploading && (
        <div className="attachment-upload-progress">
          <div className="attachment-upload-bar" style={{ width: `${uploadProgress}%` }} />
          <span className="attachment-upload-text">{uploadProgress}%</span>
        </div>
      )}

      {error && <div className="attachment-error">{error}</div>}

      {isLoading ? (
        <div className="attachment-loading">加载中...</div>
      ) : attachments.length === 0 ? (
        <div className="attachment-empty">
          <p>暂无附件</p>
          <span>点击 ＋ 上传文件（最大 50MB）</span>
        </div>
      ) : (
        <ul className="attachment-list">
          {attachments.map((att, index) => (
            <li
              key={att.id}
              className={`attachment-item${dragIndex === index ? ' dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              {/* 图片缩略图或文件图标 */}
              {isImage(att.mimeType) ? (
                <img
                  className="attachment-thumb"
                  src={`${API_BASE}/${att.id}/download?noteId=${encodeURIComponent(att.noteId)}`}
                  alt={att.fileName}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span className="attachment-icon">{getFileIcon(att.mimeType)}</span>
              )}
              <div className="attachment-info">
                {renamingId === att.id ? (
                  <input
                    ref={renameInputRef}
                    className="attachment-rename-input"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => void confirmRename()}
                    onKeyDown={(e) => { if (e.key === 'Enter') void confirmRename(); if (e.key === 'Escape') setRenamingId(null); }}
                    autoFocus
                  />
                ) : (
                  <span className="attachment-name" title={att.fileName} onDoubleClick={() => startRename(att.id, att.fileName)}>{att.fileName}</span>
                )}
                <span className="attachment-meta">{formatFileSize(att.fileSize)}</span>
                {/* Sync status */}
                <span
                  className={`attachment-sync-badge ${syncedIds.has(att.fileName + '-' + att.fileSize) ? 'synced' : 'pending'}`}
                  title={syncedIds.has(att.fileName + '-' + att.fileSize) ? '已同步' : '待同步'}
                >
                  {syncedIds.has(att.fileName + '-' + att.fileSize) ? '☁' : '○'}
                </span>
              </div>
              <div className="attachment-actions">
                <button className="attachment-action-btn" onClick={() => startRename(att.id, att.fileName)} title="重命名" type="button">✏</button>
                <button className="attachment-action-btn" onClick={() => handleDownload(att)} title="下载" type="button">⬇</button>
                <button className="attachment-action-btn attachment-action-btn--danger" onClick={() => void handleDelete(att.id, att.fileName)} title="删除" type="button">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
