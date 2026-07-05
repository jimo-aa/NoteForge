// NoteForge — 认证状态管理
// Compat layer — re-exports from Zustand useAuthStore
// @deprecated Import directly from '@/stores/useAuthStore' for new code

import type { ReactNode } from 'react';
import { useAuthStore, type AuthStore } from './useAuthStore';

/**
 * @deprecated Use useAuthStore from '@/stores/useAuthStore' directly.
 * Kept for backward compatibility — provides the same API via Zustand.
 */
export function useAuth(): AuthStore {
  return useAuthStore();
}

/**
 * @deprecated Provider no longer needed — Zustand stores are global.
 * Kept as no-op wrapper so existing <AuthProvider> doesn't break.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}


