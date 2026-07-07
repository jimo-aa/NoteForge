// NoteForge — Version API client (backend via Gateway)
// Communicates with VersionController REST endpoints through the API Gateway.

const GATEWAY_BASE = (() => {
  try {
    const custom = window.localStorage.getItem('noteforge:api:gateway-url');
    if (custom) return custom.replace(/\/+$/, '');
  } catch { /* ignore */ }
  return 'http://localhost:8000';
})();

function getToken(): string | null {
  try {
    const raw = window.localStorage.getItem('noteforge:auth:access-token');
    if (raw) return JSON.parse(raw) as string;
  } catch { /* ignore */ }
  return null;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── Types ──

export interface CloudVersionEntry {
  versionNumber: number;
  title: string;
  description: string;
  createdAt: number;
}

export interface CloudDiffOperation {
  opType: 'add' | 'remove' | 'equal';
  lineNum: number;
  oldText: string | null;
  newText: string | null;
}

export interface CloudChangeSummary {
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  wordCountDelta: number;
}

export interface CloudDiffResult {
  fromVersion: number;
  toVersion: number;
  operations: CloudDiffOperation[];
  similarity: number;
  changeSummary: CloudChangeSummary;
}

// ── API functions ──

/** List all cloud versions for a note. */
export async function listVersions(noteId: string): Promise<CloudVersionEntry[] | null> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/notes/${noteId}/versions`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === 0 && Array.isArray(json.data)) {
      return json.data.map((v: Record<string, unknown>) => ({
        versionNumber: v.versionNumber as number,
        title: v.title as string,
        description: (v.description as string) || '',
        createdAt: v.createdAt as number,
      }));
    }
    return null;
  } catch {
    return null;
  }
}

/** Get a specific version's content. */
export async function getVersion(noteId: string, versionNumber: number): Promise<{ content: string; contentPlain: string } | null> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/notes/${noteId}/versions/${versionNumber}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return {
        content: json.data.content as string,
        contentPlain: json.data.contentPlain as string,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Compute diff between two versions. */
export async function compareDiff(
  noteId: string,
  fromVersion: number,
  toVersion: number,
): Promise<CloudDiffResult | null> {
  try {
    const res = await fetch(
      `${GATEWAY_BASE}/api/v1/notes/${noteId}/versions/${fromVersion}/diff?target=${toVersion}`,
      { headers: authHeaders() },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return json.data as CloudDiffResult;
    }
    return null;
  } catch {
    return null;
  }
}

/** Create a manual version snapshot on the server. */
export async function createSnapshot(
  noteId: string,
  title: string,
  description: string,
  content: string,
  contentPlain: string,
): Promise<CloudVersionEntry | null> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/notes/${noteId}/versions/snapshot`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title, description, content, contentPlain }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return {
        versionNumber: json.data.versionNumber as number,
        title: json.data.title as string,
        description: json.data.description as string,
        createdAt: json.data.createdAt as number,
      };
    }
    return null;
  } catch {
    return null;
  }
}
