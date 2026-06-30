// NoteForge — 认证状态管理

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { AuthUser, AuthState } from '@/types';

const STORAGE_PREFIX = 'noteforge:auth';
const AUTH_EVENT = 'noteforge:auth-changed';

const safeRead = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const safeWrite = (key: string, value: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

const safeRemove = (key: string) => {
  try { window.localStorage.removeItem(key); } catch {}
};

function dispatchAuthEvent() {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

const BASE_URL = 'http://localhost:8082/api/v1/auth';

// Backend UserResponse: { id, email, name, avatarUrl, ... }
// Desktop AuthUser:    { id, email, username, avatar? }
function mapUserResponse(user: Record<string, unknown>): AuthUser {
  return {
    id: user.id as string,
    email: user.email as string,
    username: (user.name as string) || '',
    avatar: (user.avatarUrl as string) || undefined,
  };
}

async function authFetch(url: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

export function useAuthStore() {
  const [user, setUser] = useState<AuthUser | null>(() => safeRead<AuthUser | null>(`${STORAGE_PREFIX}:user`, null));
  const [accessToken, setAccessToken] = useState<string | null>(() => safeRead<string | null>(`${STORAGE_PREFIX}:access-token`, null));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => safeRead<string | null>(`${STORAGE_PREFIX}:refresh-token`, null));
  const [isLoading, setIsLoading] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);

  // Persist state changes to localStorage
  const persistTokens = useCallback((access: string | null, refresh: string | null, userData: AuthUser | null) => {
    setAccessToken(access);
    setRefreshToken(refresh);
    setUser(userData);
    if (access) safeWrite(`${STORAGE_PREFIX}:access-token`, access);
    else safeRemove(`${STORAGE_PREFIX}:access-token`);
    if (refresh) safeWrite(`${STORAGE_PREFIX}:refresh-token`, refresh);
    else safeRemove(`${STORAGE_PREFIX}:refresh-token`);
    if (userData) safeWrite(`${STORAGE_PREFIX}:user`, userData);
    else safeRemove(`${STORAGE_PREFIX}:user`);
    dispatchAuthEvent();
  }, []);

  const clearAuth = useCallback(() => {
    persistTokens(null, null, null);
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, [persistTokens]);

  // Schedule token refresh before expiry (default: 15min before)
  const scheduleRefresh = useCallback((expiresInMs: number) => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    const refreshAt = Math.max(expiresInMs - 15 * 60 * 1000, 60 * 1000); // at least 1min from now
    refreshTimerRef.current = window.setTimeout(async () => {
      const currentRefresh = refreshToken;
      if (!currentRefresh) return;
      try {
        const res = await authFetch(`${BASE_URL}/refresh`, { refreshToken: currentRefresh });
        if (!res.ok) { clearAuth(); return; }
        const json = await res.json();
        if (json.code === 0 && json.data) {
          const { accessToken: newAccess, refreshToken: newRefresh, user: userData } = json.data;
          persistTokens(newAccess, newRefresh, userData ? mapUserResponse(userData) : null);
          // Re-schedule based on typical 1h expiry
          scheduleRefresh(60 * 60 * 1000);
        }
      } catch {
        clearAuth();
      }
    }, refreshAt);
  }, [refreshToken, clearAuth, persistTokens]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const res = await authFetch(`${BASE_URL}/login`, { email, password });
        const json = await res.json();
      if (json.code === 0 && json.data) {
        const { accessToken: access, refreshToken: refresh, user: userData } = json.data;
        persistTokens(access, refresh, userData ? mapUserResponse(userData) : null);
        scheduleRefresh(60 * 60 * 1000);
        return { success: true };
      }
      return { success: false, message: json.message || '登录失败' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '网络错误，请检查后端服务' };
    } finally {
      setIsLoading(false);
    }
  }, [persistTokens, scheduleRefresh]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const res = await authFetch(`${BASE_URL}/register`, { name, email, password });
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const { accessToken: access, refreshToken: refresh, user: userData } = json.data;
        persistTokens(access, refresh, userData ? mapUserResponse(userData) : null);
        scheduleRefresh(60 * 60 * 1000);
        return { success: true };
      }
      return { success: false, message: json.message || '注册失败' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : '网络错误，请检查后端服务' };
    } finally {
      setIsLoading(false);
    }
  }, [persistTokens, scheduleRefresh]);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  // Auto-refresh on mount if we have a refresh token
  useEffect(() => {
    const storedRefresh = safeRead<string | null>(`${STORAGE_PREFIX}:refresh-token`, null);
    if (storedRefresh && !refreshToken) {
      void (async () => {
        try {
          const res = await authFetch(`${BASE_URL}/refresh`, { refreshToken: storedRefresh });
          if (!res.ok) { clearAuth(); return; }
          const json = await res.json();
          if (json.code === 0 && json.data) {
            const { accessToken: access, refreshToken: refresh, user: userData } = json.data;
            persistTokens(access, refresh, userData ? mapUserResponse(userData) : null);
            scheduleRefresh(60 * 60 * 1000);
          } else {
            clearAuth();
          }
        } catch {
          clearAuth();
        }
      })();
    }
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authState: AuthState = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
  };

  return {
    ...authState,
    login,
    register,
    logout,
  };
}

export const AuthContext = createContext<AuthStore | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={useAuthStore()}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthStore {
  const store = useContext(AuthContext);
  if (!store) throw new Error('useAuth must be used within AuthProvider');
  return store;
}
export type AuthStore = ReturnType<typeof useAuthStore>;
