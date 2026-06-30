// NoteForge — 附件管理面板

import { useState, useEffect, useCallback } from 'react';
import type { Attachment } from '@/types';

const STORAGE_PREFIX = 'noteforge:auth';
const API_BASE = 'http://localhost:8080/api/v1/attachments';
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

interface AttachmentPanelProps {
  noteId: string;
}

export function AttachmentPanel({ noteId }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchAttachments = useCallback(async () => {
    if (!noteId) return;
    setIsLoading(true);
    setError('');
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}?noteId=${encodeURIComponent(noteId)}`, { headers });
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
  }, [noteId]);

  useEffect(() => { void fetchAttachments(); }, [fetchAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setError('文件大小不能超过 50MB'); return; }

    setIsUploading(true);
    setError('');
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('noteId', noteId);

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', headers, body: formData });
      if (!res.ok) { setError('上传失败'); return; }
      await fetchAttachments();
    } catch {
      setError('上传失败，请检查网络');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/${attachmentId}`, { method: 'DELETE', headers });
      if (!res.ok) { setError('删除失败'); return; }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      setError('删除失败');
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const token = getToken();
    const params = new URLSearchParams({ noteId: attachment.noteId });
    const url = `${API_BASE}/${attachment.id}/download?${params}`;
    if (token) {
      // Use fetch and download blob (for authenticated requests)
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
  };

  return (
    <div className="attachment-panel" data-note-id={noteId}>
      <div className="attachment-panel-header">
        <h4>附件 ({attachments.length})</h4>
        <label className="attachment-upload-btn" title="上传附件">
          {isUploading ? '上传中...' : '＋'}
          <input type="file" onChange={handleUpload} disabled={isUploading} hidden />
        </label>
      </div>

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
          {attachments.map((att) => (
            <li key={att.id} className="attachment-item">
              <span className="attachment-icon">{getFileIcon(att.mimeType)}</span>
              <div className="attachment-info">
                <span className="attachment-name" title={att.fileName}>{att.fileName}</span>
                <span className="attachment-meta">{formatFileSize(att.fileSize)}</span>
              </div>
              <div className="attachment-actions">
                <button className="attachment-action-btn" onClick={() => handleDownload(att)} title="下载" type="button">⬇</button>
                <button className="attachment-action-btn attachment-action-btn--danger" onClick={() => handleDelete(att.id)} title="删除" type="button">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
