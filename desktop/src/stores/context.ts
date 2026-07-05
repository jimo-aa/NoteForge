// 状态管理上下文 — 统一导出
// Zustand stores are preferred over Context providers.
//
// Migration: New components should import from the specific store file directly.
// Context providers (NoteProvider, AuthProvider) are no-ops kept for backward compat.

export { useStore, NoteProvider } from './noteStore';
export { useAuth, AuthProvider } from './authStore';

// Zustand stores — preferred for new code (supports selectors)
export { useNoteStore } from './useNoteStore';
export { useAuthStore } from './useAuthStore';
