// NoteForge Web — AI Service client (port of desktop/src/services/aiService.ts)

const AI_API_BASE = process.env.NEXT_PUBLIC_AI_API_BASE || 'http://localhost:8083';
const AUTH_TOKEN_KEY = 'noteforge:auth:access-token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface AiStreamCallbacks {
  onDelta: (content: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
}

const SSE_ENDPOINT = `${AI_API_BASE}/api/v1/ai/write`;

async function streamFromSSE(
  body: unknown,
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(SSE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) { callbacks.onError(`AI error: ${response.status}`); return; }
    const reader = response.body?.getReader();
    if (!reader) { callbacks.onError('No response body'); return; }
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
            if (parsed.event === 'delta' && parsed.content) { fullContent += parsed.content; callbacks.onDelta(parsed.content); }
            else if (parsed.event === 'done') { callbacks.onDone(fullContent || parsed.content); return; }
            else if (parsed.event === 'error') { callbacks.onError(parsed.error); return; }
          } catch { fullContent += data; callbacks.onDelta(data); }
        }
      }
    }
    callbacks.onDone(fullContent);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    callbacks.onError(error instanceof Error ? error.message : 'Network error');
  }
}

export function continueText(text: string, context: string | undefined, callbacks: AiStreamCallbacks, signal?: AbortSignal): Promise<void> {
  return streamFromSSE({ action: 'continue', text, context }, callbacks, signal);
}
export function rewriteText(text: string, tone: string, callbacks: AiStreamCallbacks, signal?: AbortSignal): Promise<void> {
  return streamFromSSE({ action: 'rewrite', text, tone }, callbacks, signal);
}
export function translateText(text: string, targetLang: string, callbacks: AiStreamCallbacks, signal?: AbortSignal): Promise<void> {
  return streamFromSSE({ action: 'translate', text, targetLang }, callbacks, signal);
}
export function completeText(text: string, callbacks: AiStreamCallbacks, signal?: AbortSignal): Promise<void> {
  return streamFromSSE({ action: 'complete', text }, callbacks, signal);
}
