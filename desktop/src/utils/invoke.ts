import { invoke } from '@tauri-apps/api/core';

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`[TauriCmd] ${cmd} failed:`, error);
    return null;
  }
}
