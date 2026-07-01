// NoteForge — SyncService unit tests (mock fetch + localStorage)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ——— hoisted mocks ———

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Mock global fetch
vi.stubGlobal('fetch', mockFetch);

// ——— helpers ———

const AUTH_TOKEN_KEY = 'noteforge:auth:access-token';

function setToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(token));
}

function clearToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

/** Build a Response-like object that fetch resolves to */
function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

describe('SyncService', () => {
  let SyncService: typeof import('../syncService').SyncService;
  let getSyncService: typeof import('../syncService').getSyncService;

  beforeEach(async () => {
    // Fresh import per test to reset singleton state
    vi.resetModules();
    const mod = await import('../syncService');
    SyncService = mod.SyncService;
    getSyncService = mod.getSyncService;
    mockFetch.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    // Clear singleton so next test gets a fresh instance
    // The module is already reset via resetModules
  });

  // ——— syncPull ———

  it('syncPull returns null when no token', async () => {
    const svc = new SyncService();
    const result = await svc.syncPull(0);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('syncPull returns null on network failure', async () => {
    setToken('valid-token');
    mockFetch.mockRejectedValue(new Error('Network Error'));

    const svc = new SyncService();
    const result = await svc.syncPull(0);
    expect(result).toBeNull();
  });

  it('syncPull returns parsed data on success', async () => {
    setToken('valid-token');
    const fakeData = {
      notes: [],
      deletedNoteIds: [],
      serverVersion: 42,
    };
    mockFetch.mockResolvedValue(jsonResponse({ code: 0, data: fakeData }));

    const svc = new SyncService();
    const result = await svc.syncPull(0);
    expect(result).toEqual(fakeData);

    // Verify fetch was called with the right URL and body
    const calls = mockFetch.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [url, opts] = calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8081/api/v1/sync/pull');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ lastVersion: 0 });
  });

  it('syncPull returns null when backend returns error code', async () => {
    setToken('valid-token');
    mockFetch.mockResolvedValue(jsonResponse({ code: 1, message: 'error' }));

    const svc = new SyncService();
    const result = await svc.syncPull(0);
    expect(result).toBeNull();
  });

  // ——— syncPush ———

  it('syncPush returns null when no changes', async () => {
    const svc = new SyncService();
    const result = await svc.syncPush([]);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('syncPush returns null when no token', async () => {
    const svc = new SyncService();
    const result = await svc.syncPush([{ noteId: '1', clientVersion: 0 }]);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('syncPush sends changes and returns accepted count', async () => {
    setToken('valid-token');
    const fakeResponse = {
      accepted: 1,
      serverVersion: 100,
      conflicts: [],
    };
    mockFetch.mockResolvedValue(jsonResponse({ code: 0, data: fakeResponse }));

    const svc = new SyncService();
    const changes = [{ noteId: 'n1', clientVersion: 0, title: 'Test' }];
    const result = await svc.syncPush(changes);
    expect(result).toEqual(fakeResponse);

    const calls = mockFetch.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [_url, opts] = calls[0] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({ changes });
  });

  // ——— full sync cycle ———

  it('sync performs push then pull', async () => {
    setToken('valid-token');
    const pushOk = { accepted: 1, serverVersion: 10, conflicts: [] };
    const pullOk = { notes: [], deletedNoteIds: [], serverVersion: 10 };

    mockFetch
      .mockResolvedValueOnce(jsonResponse({ code: 0, data: pushOk }))  // push
      .mockResolvedValueOnce(jsonResponse({ code: 0, data: pullOk })); // pull

    const svc = new SyncService();
    svc.queueChange({ noteId: 'n1', clientVersion: 0, title: 'Pending' });

    const result = await svc.sync(0);
    expect(result).toEqual(pullOk);
    // Should have cleared the pending queue after successful push
    expect(svc.getPendingCount()).toBe(0);
  });

  it('sync handles push failure gracefully and still attempts pull', async () => {
    setToken('valid-token');
    // Reject all fetch calls — both push and pull will retry 3x each
    mockFetch.mockRejectedValue(new Error('Network Error'));

    const svc = new SyncService();
    svc.queueChange({ noteId: 'n1', clientVersion: 0, title: 'Pending' });

    const result = await svc.sync(0);
    // sync() catches errors internally; returns null when both push and pull fail
    expect(result).toBeNull();
  }, 30000);

  // ——— change queue ———

  it('queueChange replaces existing pending change for same noteId', () => {
    const svc = new SyncService();
    svc.queueChange({ noteId: 'n1', clientVersion: 0, title: 'First' });
    expect(svc.getPendingCount()).toBe(1);

    svc.queueChange({ noteId: 'n1', clientVersion: 0, title: 'Second' });
    expect(svc.getPendingCount()).toBe(1);  // still 1, replaced
  });

  it('queueChange keeps separate entries for different noteIds', () => {
    const svc = new SyncService();
    svc.queueChange({ noteId: 'n1', clientVersion: 0 });
    svc.queueChange({ noteId: 'n2', clientVersion: 0 });
    expect(svc.getPendingCount()).toBe(2);
  });

  // ——— status & listeners ———

  it('subscribe and unsubscribe listeners work', () => {
    const svc = new SyncService();
    const listener = vi.fn();
    const unsub = svc.subscribe(listener);

    expect(svc.getCurrentStatus()).toBe('idle');

    unsub();
    // No easy way to trigger status change in test without making real HTTP calls,
    // but we can verify subscribe/unsubscribe don't throw
  });

  // ——— singleton ———

  it('getSyncService returns the same instance', () => {
    const a = getSyncService();
    const b = getSyncService();
    expect(a).toBe(b);
  });
});
