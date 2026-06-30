// NoteForge — 同步状态指示器

import { useState, useEffect } from 'react';
import { getSyncService } from '@/services/syncService';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { SyncStatus } from '@/types';

const STATUS_LABELS: Record<SyncStatus, string> = {
  idle: '已同步',
  syncing: '同步中...',
  online: '在线',
  offline: '离线',
  error: '同步失败',
};

const STATUS_CLASSES: Record<SyncStatus, string> = {
  idle: 'sync-dot--idle',
  syncing: 'sync-dot--syncing',
  online: 'sync-dot--online',
  offline: 'sync-dot--offline',
  error: 'sync-dot--error',
};

export function SyncIndicator() {
  const { isOnline } = useOnlineStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isOnline ? 'idle' : 'offline');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const sync = getSyncService();
    const unsub = sync.subscribe((status) => {
      setSyncStatus(status);
      setPendingCount(sync.getPendingCount());
    });
    setPendingCount(sync.getPendingCount());
    return unsub;
  }, []);

  useEffect(() => {
    setSyncStatus((prev) => {
      if (!isOnline) return 'offline';
      if (prev === 'offline') return 'idle';
      return prev;
    });
  }, [isOnline]);

  const displayStatus = isOnline ? syncStatus : 'offline';
  const label = STATUS_LABELS[displayStatus];

  return (
    <span className="sync-indicator" title={`同步状态: ${label}${pendingCount > 0 ? ` · ${pendingCount} 个待同步` : ''}`}>
      <span className={`sync-dot ${STATUS_CLASSES[displayStatus]}`} />
      <span className="sync-label">{label}</span>
      {pendingCount > 0 && <span className="sync-pending-badge">{pendingCount}</span>}
    </span>
  );
}
