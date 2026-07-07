// NoteForge — AI Service client
// Communicates with ai-service backend for writing, tagging, and search.

// AI API — routed through API Gateway (port 8000) instead of direct to ai-service
// Custom gateway URL via localStorage key 'noteforge:api:gateway-url'
const AI_API_BASE = (() => {
  try {
    const custom = window.localStorage.getItem('noteforge:api:gateway-url');
    if (custom) return `${custom.replace(/\/+$/, '')}/api/v1/ai`;
  } catch { /* localStorage unavailable */ }
  return 'http://localhost:8000/api/v1/ai';
})();
const AUTH_TOKEN_KEY = 'noteforge:auth:access-token';

function getToken(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as string;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── SSE streaming helpers ──

export interface AiStreamCallbacks {
  onDelta: (content: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
}

async function streamFromSSE(
  url: string,
  body: unknown,
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      callbacks.onError(`AI service error: ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const eventType = parsed.event || 'delta';

            if (eventType === 'delta' && parsed.content) {
              fullContent += parsed.content;
              callbacks.onDelta(parsed.content);
            } else if (eventType === 'done' && parsed.content) {
              fullContent = parsed.content;
              callbacks.onDone(fullContent);
              return;
            } else if (eventType === 'error') {
              callbacks.onError(parsed.error || 'Unknown error');
              return;
            }
          } catch {
            // Handle data as raw content
            fullContent += data;
            callbacks.onDelta(data);
          }
        }
      }
    }

    callbacks.onDone(fullContent);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return; // Cancelled by user
    }
    callbacks.onError(error instanceof Error ? error.message : 'Network error');
  }
}

// ── Tag API ──

async function suggestTags(
  title: string,
  content: string,
  existingTags?: string[],
): Promise<string[]> {
  try {
    const response = await fetch(`${AI_API_BASE}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        title,
        content: content?.slice(0, 2000) ?? '',
        existingTags: existingTags ?? [],
      }),
    });

    if (!response.ok) return [];

    const json = await response.json();
    if (json.code === 0 && json.data?.tags) {
      return json.data.tags as string[];
    }
    return [];
  } catch {
    return [];
  }
}

// ── Embedding API ──

async function createEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${AI_API_BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    if (json.code === 0 && json.data?.embedding) {
      return json.data.embedding as number[];
    }
    return null;
  } catch {
    return null;
  }
}

// ── Writing actions (SSE streaming) ──

export function continueText(
  text: string,
  context: string | undefined,
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return streamFromSSE(
    `${AI_API_BASE}/write`,
    { action: 'continue', text, context },
    callbacks,
    signal,
  );
}

export function rewriteText(
  text: string,
  tone: string,
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return streamFromSSE(
    `${AI_API_BASE}/write`,
    { action: 'rewrite', text, tone },
    callbacks,
    signal,
  );
}

export function translateText(
  text: string,
  targetLang: string,
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return streamFromSSE(
    `${AI_API_BASE}/write`,
    { action: 'translate', text, targetLang },
    callbacks,
    signal,
  );
}

export function completeText(
  text: string,
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  return streamFromSSE(
    `${AI_API_BASE}/write`,
    { action: 'complete', text },
    callbacks,
    signal,
  );
}

// ── Semantic Search ──

export interface SemanticSearchResult {
  noteId: string;
  title: string;
  snippet: string;
  score: number;
}

export async function semanticSearch(
  query: string,
  mode: 'semantic' | 'fulltext' | 'hybrid' = 'hybrid',
  limit = 20,
  offset = 0,
  signal?: AbortSignal,
): Promise<{ results: SemanticSearchResult[]; total: number } | null> {
  try {
    const response = await fetch(`${AI_API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ query, mode, limit, offset }),
      signal,
    });
    if (!response.ok) return null;
    const json = await response.json();
    if (json.code === 0 && json.data) {
      return {
        results: (json.data.results || []).map((r: SemanticSearchResult) => ({
          noteId: r.noteId,
          title: r.title || '',
          snippet: r.snippet || '',
          score: r.score || 0,
        })),
        total: json.data.total || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Re-index a note's embedding (call after create/update).
 */
export async function indexNoteEmbedding(
  noteId: string,
  title: string,
  content: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${AI_API_BASE}/search/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ noteId, title, content }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export { suggestTags, createEmbedding };
