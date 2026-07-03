// NoteForge — Zustand auth store
// Replaces the Context-based AuthProvider with a lightweight Zustand store.
// Tokens are persisted to localStorage with auto-refresh scheduling.

import { create } from 'zustand';
import type { AuthUser } from '@/types';

const STORAGE_PREFIX = 'noteforge:auth';
const AUTH_EVENT = 'noteforge:auth-changed';
const BASE_URL = 'http://localhost:8082/api/v1/auth';

// ── localStorage helpers ──

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function safeRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

function dispatchAuthEvent(): void {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

// ── Backend response mapper ──

function mapUserResponse(user: Record<string, unknown>): AuthUser {
  return {
    id: user.id as string,
    email: user.email as string,
    username: (user.name as string) || '',
    avatar: (user.avatarUrl as string) || undefined,
  };
}

// ── Store types ──

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  clearAuth: () => void;
}

type AuthStore = AuthState & AuthActions;

// ── Helpers ──

async function authFetch(url: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

function persistTokens(
  set: (partial: Partial<AuthStore>) => void,
  access: string | null,
  refresh: string | null,
  userData: AuthUser | null,
): void {
  set({ accessToken: access, refreshToken: refresh, user: userData });
  if (access) safeWrite(`${STORAGE_PREFIX}:access-token`, access);
  else safeRemove(`${STORAGE_PREFIX}:access-token`);
  if (refresh) safeWrite(`${STORAGE_PREFIX}:refresh-token`, refresh);
  else safeRemove(`${STORAGE_PREFIX}:refresh-token`);
  if (userData) safeWrite(`${STORAGE_PREFIX}:user`, userData);
  else safeRemove(`${STORAGE_PREFIX}:user`);
  dispatchAuthEvent();
}

// ── Store ──

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // State — hydrated from localStorage
  user: safeRead<AuthUser | null>(`${STORAGE_PREFIX}:user`, null),
  accessToken: safeRead<string | null>(`${STORAGE_PREFIX}:access-token`, null),
  refreshToken: safeRead<string | null>(`${STORAGE_PREFIX}:refresh-token`, null),
  isLoading: false,

  // Actions
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authFetch(`${BASE_URL}/login`, { email, password });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const { accessToken: access, refreshToken: refresh, user: userData } = json.data;
        persistTokens(set, access, refresh, userData ? mapUserResponse(userData) : null);
        scheduleTokenRefresh(set, get, 60 * 60 * 1000);
        return { success: true };
      }
      return { success: false, message: json.message || '登录失败' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '网络错误，请检查后端服务' };
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authFetch(`${BASE_URL}/register`, { name, email, password });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const { accessToken: access, refreshToken: refresh, user: userData } = json.data;
        persistTokens(set, access, refresh, userData ? mapUserResponse(userData) : null);
        scheduleTokenRefresh(set, get, 60 * 60 * 1000);
        return { success: true };
      }
      return { success: false, message: json.message || '注册失败' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '网络错误，请检查后端服务' };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    get().clearAuth();
  },

  clearAuth: () => {
    persistTokens(set, null, null, null);
  },
}));

// ── Token refresh scheduling ──

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

async function doRefresh(
  set: (partial: Partial<AuthStore>) => void,
  get: () => AuthStore,
): Promise<void> {
  const currentRefresh = get().refreshToken;
  if (!currentRefresh) return;
  try {
    const res = await authFetch(`${BASE_URL}/refresh`, { refreshToken: currentRefresh });
    if (!res.ok) { get().clearAuth(); return; }
    const json = await res.json();
    if (json.code === 0 && json.data) {
      const { accessToken: access, refreshToken: refresh, user: userData } = json.data;
      persistTokens(set, access, refresh, userData ? mapUserResponse(userData) : null);
      if (import.meta.env.DEV) console.log('[Auth] Token auto-refreshed');
    }
  } catch {
    get().clearAuth();
  }
}

function scheduleTokenRefresh(
  set: (partial: Partial<AuthStore>) => void,
  get: () => AuthStore,
  expiresInMs: number,
): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const refreshAt = Math.max(expiresInMs - 15 * 60 * 1000, 60 * 1000);
  refreshTimer = setTimeout(() => { void doRefresh(set, get); }, refreshAt);
}

// Auto-refresh on module load if token exists
const storedRefresh = safeRead<string | null>(`${STORAGE_PREFIX}:refresh-token`, null);
if (storedRefresh) {
  const set = useAuthStore.setState.bind(useAuthStore);
  void doRefresh(set, () => useAuthStore.getState());
}
