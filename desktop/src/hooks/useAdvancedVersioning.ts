import { useState, useCallback } from 'react';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`Command ${cmd} failed:`, error);
    return null;
  }
}

export function useAdvancedVersioning(noteId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export note
  const exportNote = useCallback(async (format: 'markdown' | 'html' | 'json') => {
    if (!noteId) {
      setError('没有选择笔记');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const data = await invoke<number[]>('export_note', {
        note_id: noteId,
        format: format
      });

      if (!data) {
        throw new Error('导出失败');
      }

      // 触发下载
      const mimeTypes = {
        'markdown': 'text/markdown',
        'html': 'text/html',
        'json': 'application/json'
      };

      const blob = new Blob([new Uint8Array(data)], { 
        type: mimeTypes[format] 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // Backup note
  const backupNote = useCallback(async () => {
    if (!noteId) {
      setError('没有选择笔记');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupPath = `backups/note-${noteId}-${timestamp}.json`;

      const success = await invoke<boolean>('backup_note', {
        note_id: noteId,
        backup_path: backupPath
      });

      if (success) {
        return backupPath;
      } else {
        throw new Error('备份失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '备份失败';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // Get version diff
  const getVersionDiff = useCallback(async (fromCommit: string, toCommit: string) => {
    if (!noteId) {
      setError('没有选择笔记');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const diff = await invoke<any>('get_version_diff_cached', {
        note_id: noteId,
        from_commit: fromCommit,
        to_commit: toCommit
      });

      return diff;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取Diff失败';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // Create milestone
  const createMilestone = useCallback(async (
    name: string,
    description?: string,
    versionNumber: number = 1
  ) => {
    if (!noteId) {
      setError('没有选择笔记');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const milestone = await invoke<any>('create_milestone', {
        note_id: noteId,
        name,
        description: description || null,
        version_number: versionNumber
      });

      return milestone;
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建里程碑失败';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // Search versions
  const searchVersions = useCallback(async (query: string) => {
    if (!noteId) {
      setError('没有选择笔记');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await invoke<any[]>('search_versions_cached', {
        note_id: noteId,
        query
      });

      return results || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : '搜索失败';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // Clear cache
  const clearCache = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await invoke<boolean>('clear_cache');
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : '清空缓存失败';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get cache stats
  const getCacheStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stats = await invoke<any>('get_cache_stats');
      return stats;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取缓存统计失败';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    exportNote,
    backupNote,
    getVersionDiff,
    createMilestone,
    searchVersions,
    clearCache,
    getCacheStats,
  };
}
