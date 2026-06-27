let _invoke: (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | null = null;

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    if (!_invoke) {
      const mod = await import('@tauri-apps/api/core');
      _invoke = mod.invoke;
    }
    return await _invoke<T>(cmd, args);
  } catch (error) {
    console.error(`[TauriCmd] ${cmd} failed:`, error);
    return null;
  }
}
