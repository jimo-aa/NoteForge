// NoteForge — 同步服务（桌面↔后端 REST 同步）

import type {
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncStatus,
  SyncChangeItem,
} from '@/types';

const STORAGE_PREFIX = 'noteforge:sync';
const AUTH_TOKEN_KEY = 'noteforge:auth:access-token';
const SYNC_API_BASE = 'http://localhost:8081/api/v1/sync';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

type SyncListener = (status: SyncStatus) => void;

function getToken(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    // Stored via JSON.stringify by authStore — need to parse
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
    this.loadPendingQueue();
  }

  // ── Pending queue persistence ──

  private loadPendingQueue() {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:pending`);
      if (raw) this.pendingQueue = JSON.parse(raw);
    } catch {
      this.pendingQueue = [];
    }
  }

  private savePendingQueue() {
    try {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}:pending`,
        JSON.stringify(this.pendingQueue),
      );
    } catch {
      /* storage full — skip */
    }
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
        // 401/403 — auth expired, no point retrying
        if (res.status === 401 || res.status === 403) return res;
        // 4xx/5xx — retry with backoff
        if (attempt < retries - 1) await delay(RETRY_DELAY_MS * (attempt + 1));
        else return res;
      } catch {
        // Network error — retry
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
        body: JSON.stringify({ lastVersion } satisfies {
          lastVersion: number;
        }),
      },
    );
    if (!res) return null;
    try {
      const json = await res.json();
      // Backend wraps in ApiResponse { code, message, data }
      if (json.code === 0 && json.data) return json.data as SyncPullResponse;
      return null;
    } catch {
      return null;
    }
  }

  // ── Sync push ──

  async syncPush(
    changes: SyncChangeItem[],
  ): Promise<SyncPushResponse | null> {
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
          this.savePendingQueue();
        }
        // If push failed (network error), keep queue for retry
      }

      // Then pull latest
      const pullResult = await this.syncPull(lastVersion);
      this.setStatus(pullResult ? 'online' : 'error');
      return pullResult;
    } finally {
      this.isSyncing = false;
    }
  }

  // ── Change queue ──

  queueChange(change: SyncChangeItem) {
    // Replace existing pending change for same noteId
    const idx = this.pendingQueue.findIndex(
      (c) => c.noteId === change.noteId,
    );
    if (idx >= 0) {
      this.pendingQueue[idx] = change;
    } else {
      this.pendingQueue.push(change);
    }
    this.savePendingQueue();
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
        // Return the pull result so caller can apply it
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
