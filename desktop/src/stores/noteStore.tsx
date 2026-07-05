// NoteForge — 全局状态管理
// Compat layer — re-exports from Zustand useNoteStore
// @deprecated Import directly from '@/stores/useNoteStore' for new code.
// Use selectors to avoid unnecessary re-renders: useNoteStore((s) => s.notes)

import type { ReactNode } from 'react';
import { useNoteStore, type NoteStore } from './useNoteStore';

/** @deprecated Use useNoteStore directly — selectors avoid re-renders */
export function useStore(): NoteStore {
  return useNoteStore();
}

/** @deprecated Provider no longer needed — Zustand stores are global. */
export function NoteProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export type { NoteStore };
