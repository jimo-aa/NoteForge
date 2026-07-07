// NoteForge — 同步服务（桌面↔后端 REST 同步，SQLite 持久化）

import { invoke } from '@tauri-apps/api/core';
import type {
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncStatus,
  SyncChangeItem,
} from '@/types';

const AUTH_TOKEN_KEY = 'noteforge:auth:access-token';
// Sync API — routed through API Gateway (port 8000) instead of direct to note-service
// Configure the gateway URL via localStorage key 'noteforge:api:gateway-url' if needed
const SYNC_API_BASE = (() => {
  try {
    const custom = window.localStorage.getItem('noteforge:api:gateway-url');
    if (custom) return `${custom.replace(/\/+$/, '')}/api/v1/sync`;
  } catch { /* localStorage unavailable */ }
  return 'http://localhost:8000/api/v1/sync';
})();
const PENDING_QUEUE_KEY = 'noteforge:sync:pending-queue';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface SyncQueueItem {
  id: string;
  noteId: string;
  operation: string;
  payload: string;
  createdAt: number;
}

type SyncListener = (status: SyncStatus) => void;

function getToken(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as string;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SyncService {
  private status: SyncStatus = 'idle';
  private listeners = new Set<SyncListener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pendingQueue: SyncChangeItem[] = [];
  private isSyncing = false;

  constructor() {
    void this.loadPendingQueue();
  }

  // ── Pending queue persistence (SQLite via Tauri + localStorage fallback) ──

  /** Load queue from localStorage (browser-only mode fallback) */
  private loadFromLocalStorage(): SyncChangeItem[] {
    try {
      const raw = window.localStorage.getItem(PENDING_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Save queue to localStorage */
  private saveToLocalStorage(): void {
    try {
      window.localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(this.pendingQueue));
    } catch { /* localStorage full or unavailable */ }
  }

  private async loadPendingQueue(): Promise<void> {
    // Try Tauri SQLite first
    try {
      const items = await invoke<SyncQueueItem[]>('get_pending_sync_changes');
      this.pendingQueue = items.map((item) => JSON.parse(item.payload) as SyncChangeItem);
      return;
    } catch {
      // Tauri invoke failed (browser-only mode) — fall back to localStorage
      this.pendingQueue = this.loadFromLocalStorage();
    }
  }

  private async persistQueue(): Promise<void> {
    // Queue is persisted per-item via queueChange(); this is a no-op now.
  }

  // ── Status management ──

  private setStatus(next: SyncStatus) {
    if (this.status === next) return;
    this.status = next;
    this.listeners.forEach((fn) => fn(next));
  }

  getCurrentStatus(): SyncStatus {
    return this.status;
  }

  subscribe(fn: SyncListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── HTTP helpers ──

  private getAuthHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = MAX_RETRIES,
  ): Promise<Response | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
        if (res.status === 401 || res.status === 403) return res;
        if (attempt < retries - 1) await delay(RETRY_DELAY_MS * (attempt + 1));
        else return res;
      } catch {
        if (attempt < retries - 1) await delay(RETRY_DELAY_MS * (attempt + 1));
        else return null;
      }
    }
    return null;
  }

  // ── Sync pull ──

  async syncPull(lastVersion: number): Promise<SyncPullResponse | null> {
    if (!getToken()) return null;
    const res = await this.fetchWithRetry(
      `${SYNC_API_BASE}/pull`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ lastVersion } satisfies { lastVersion: number }),
      },
    );
    if (!res) return null;
    try {
      const json = await res.json();
      if (json.code === 0 && json.data) return json.data as SyncPullResponse;
      return null;
    } catch {
      return null;
    }
  }

  // ── Sync push ──

  async syncPush(changes: SyncChangeItem[]): Promise<SyncPushResponse | null> {
    if (changes.length === 0) return null;
    if (!getToken()) return null;
    const res = await this.fetchWithRetry(
      `${SYNC_API_BASE}/push`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ changes } satisfies SyncPushRequest),
      },
    );
    if (!res) return null;
    try {
      const json = await res.json();
      if (json.code === 0 && json.data) return json.data as SyncPushResponse;
      return null;
    } catch {
      return null;
    }
  }

  // ── Full sync cycle: push pending → pull latest ──

  async sync(lastVersion: number): Promise<SyncPullResponse | null> {
    if (this.isSyncing) return null;
    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      // Push pending changes first
      if (this.pendingQueue.length > 0) {
        const pushResult = await this.syncPush(this.pendingQueue);
        if (pushResult) {
          // Remove accepted changes from queue
          this.pendingQueue = this.pendingQueue.slice(pushResult.accepted);
          // Update localStorage immediately
          this.saveToLocalStorage();
          // Clear the SQLite queue and re-add remaining items
          if (pushResult.accepted > 0) {
            try {
              await invoke('clear_sync_queue');
              for (const item of this.pendingQueue) {
                await invoke('enqueue_sync_change', {
                  noteId: item.noteId,
                  operation: item.isDeleted ? 'delete' : 'update',
                  payload: JSON.stringify(item),
                });
              }
            } catch { /* queue cleanup failed silently */ }
          }
        }
      }

      // Then pull latest
      const pullResult = await this.syncPull(lastVersion);
      this.setStatus(pullResult ? 'online' : 'error');
      return pullResult;
    } finally {
      this.isSyncing = false;
    }
  }

  // ── Change queue (persisted to SQLite + localStorage fallback) ──

  queueChange(change: SyncChangeItem) {
    // Replace existing pending change for same noteId in memory
    const idx = this.pendingQueue.findIndex((c) => c.noteId === change.noteId);
    if (idx >= 0) {
      this.pendingQueue[idx] = change;
    } else {
      this.pendingQueue.push(change);
    }
    // Always persist to localStorage (works in browser-only mode)
    this.saveToLocalStorage();
    // Also persist to Tauri SQLite if available
    const operation = change.isDeleted ? 'delete' : 'update';
    void invoke('enqueue_sync_change', {
      noteId: change.noteId,
      operation,
      payload: JSON.stringify(change),
    }).catch(() => {});
  }

  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  // ── Polling ──

  startPolling(intervalMs = 30000, lastVersion: () => number) {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      if (this.isSyncing) return;
      const result = await this.sync(lastVersion());
      if (result) {
        this.notifyPullResult(result);
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ── Pull result callback (wired by noteStore) ──

  private onPullResult: ((result: SyncPullResponse) => void) | null = null;

  onPullResultCallback(cb: (result: SyncPullResponse) => void) {
    this.onPullResult = cb;
  }

  private notifyPullResult(result: SyncPullResponse) {
    this.onPullResult?.(result);
  }

  // ── Cleanup ──

  destroy() {
    this.stopPolling();
    this.listeners.clear();
    this.onPullResult = null;
  }
}

// Singleton
let instance: SyncService | null = null;
export function getSyncService(): SyncService {
  if (!instance) instance = new SyncService();
  return instance;
}
