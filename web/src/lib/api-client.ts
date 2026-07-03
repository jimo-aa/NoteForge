// NoteForge Web — Backend API Client
// Communicates with the API Gateway (port 8000) or individual services.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('noteforge:auth:access-token');
  } catch { return null; }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ code: number; data?: T; message?: string }> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json();
}

// ── Auth ──

export const auth = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: import('./types').AuthUser }>(
      'POST', '/api/v1/auth/login', { email, password }
    ),
  register: (name: string, email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: import('./types').AuthUser }>(
      'POST', '/api/v1/auth/register', { name, email, password }
    ),
  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string; user: import('./types').AuthUser }>(
      'POST', '/api/v1/auth/refresh', { refreshToken }
    ),
  me: () => request<import('./types').AuthUser>('GET', '/api/v1/auth/me'),
  logout: (refreshToken: string) =>
    request('POST', '/api/v1/auth/logout', { refreshToken }),
};

// ── Notes ──

export const notes = {
  list: () => request<import('./types').NoteResponseItem[]>('GET', '/api/v1/notes'),
  get: (id: string) => request<import('./types').NoteResponseItem>('GET', `/api/v1/notes/${id}`),
  create: (data: { title: string; content?: string; notebookId?: string; tags?: string[] }) =>
    request<import('./types').NoteResponseItem>('POST', '/api/v1/notes', data),
  update: (id: string, data: { title?: string; content?: string; notebookId?: string; tags?: string[]; isPinned?: boolean; isFavorite?: boolean }) =>
    request<import('./types').NoteResponseItem>('PUT', `/api/v1/notes/${id}`, data),
  delete: (id: string) => request('DELETE', `/api/v1/notes/${id}`),
  search: (query: string) => request<import('./types').NoteResponseItem[]>(
    'GET', `/api/v1/notes/search?q=${encodeURIComponent(query)}`
  ),
};

// ── Notebooks ──

export const notebooks = {
  list: () => request<import('./types').Notebook[]>('GET', '/api/v1/notebooks'),
  create: (data: { name: string; icon?: string; color?: string }) =>
    request<import('./types').Notebook>('POST', '/api/v1/notebooks', data),
  rename: (id: string, name: string) =>
    request<import('./types').Notebook>('PUT', `/api/v1/notebooks/${id}`, { name }),
  delete: (id: string) => request('DELETE', `/api/v1/notebooks/${id}`),
};

// ── Tags ──

export const tags = {
  list: () => request<import('./types').Tag[]>('GET', '/api/v1/tags'),
};

// ── AI ──

export const ai = {
  tag: (title: string, content: string) =>
    request<{ tags: string[] }>('POST', '/api/v1/ai/tag', { title, content }),
};
