// 状态管理上下文 — 统一导出
// V1: Context-based providers (legacy, from noteStore.tsx and authStore.tsx)
// V2: Zustand stores (new, incremental migration path)
//
// Migration strategy:
// 1. New components should import from useAuthStore / useNoteStore / useUIStore directly
// 2. Existing components continue to use useStore() / useAuth() via Context
// 3. When all consumers are migrated, remove Context providers

export { useStore, NoteProvider } from './noteStore';
export { useAuth, AuthProvider } from './authStore';

// Zustand stores — preferred for new code
export { useAuthStore } from './useAuthStore';
