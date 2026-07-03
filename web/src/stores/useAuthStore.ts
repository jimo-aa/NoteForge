'use client';

import { create } from 'zustand';
import { auth as authApi } from '@/lib/api-client';
import type { AuthUser } from '@/lib/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,

  hydrate: () => {
    try {
      const accessToken = localStorage.getItem('noteforge:auth:access-token');
      const refreshToken = localStorage.getItem('noteforge:auth:refresh-token');
      const userRaw = localStorage.getItem('noteforge:auth:user');
      if (accessToken && userRaw) {
        set({
          accessToken,
          refreshToken,
          user: JSON.parse(userRaw) as AuthUser,
          isAuthenticated: true,
        });
      }
    } catch { /* ignore */ }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(email, password);
      if (res.code === 0 && res.data) {
        const { accessToken, refreshToken, user } = res.data;
        localStorage.setItem('noteforge:auth:access-token', accessToken);
        localStorage.setItem('noteforge:auth:refresh-token', refreshToken);
        localStorage.setItem('noteforge:auth:user', JSON.stringify(user));
        set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Network error' };
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.register(name, email, password);
      if (res.code === 0 && res.data) {
        const { accessToken, refreshToken, user } = res.data;
        localStorage.setItem('noteforge:auth:access-token', accessToken);
        localStorage.setItem('noteforge:auth:refresh-token', refreshToken);
        localStorage.setItem('noteforge:auth:user', JSON.stringify(user));
        set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
        return { success: true };
      }
      return { success: false, message: res.message || 'Registration failed' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Network error' };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('noteforge:auth:access-token');
    localStorage.removeItem('noteforge:auth:refresh-token');
    localStorage.removeItem('noteforge:auth:user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));
