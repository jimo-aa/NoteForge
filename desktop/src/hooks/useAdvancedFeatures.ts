// 高级功能Hooks - 用于简化组件中的API调用

import { useState, useCallback, useEffect } from 'react';
import type { DiffResult, Milestone, VersionSearchResult } from '../types/advanced-features';

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`invoke ${cmd} failed:`, error);
    return null;
  }
}

// Diff查看器Hook
export function useDiffViewer(noteId: string, fromVersion: string, toVersion: string) {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDiff = useCallback(async (contextLines: number = 3) => {
    if (!noteId || !fromVersion || !toVersion) return;
    
    setLoading(true);
    setError(null);
    
    const result = await invoke<DiffResult>('compare_versions_with_context', {
      note_id: noteId,
      from_commit: fromVersion,
      to_commit: toVersion,
      context_lines: contextLines,
    });
    
    if (result) {
      setDiff(result);
    } else {
      setError('Failed to load diff');
    }
    
    setLoading(false);
  }, [noteId, fromVersion, toVersion]);

  return { diff, loading, error, loadDiff };
}

// 里程碑管理Hook
export function useMilestones(noteId: string) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMilestones = useCallback(async () => {
    if (!noteId) return;
    
    setLoading(true);
    setError(null);
    
    const data = await invoke<Milestone[]>('list_milestones', {
      note_id: noteId,
    });
    
    if (data) {
      setMilestones(data.sort((a, b) => b.created_at - a.created_at));
    } else {
      setError('Failed to load milestones');
    }
    
    setLoading(false);
  }, [noteId]);

  const createMilestone = useCallback(async (
    name: string,
    description?: string,
    versionNumber: number = 1,
  ) => {
    const result = await invoke<Milestone>('create_milestone', {
      note_id: noteId,
      name,
      description: description || null,
      version_number: versionNumber,
    });
    
    if (result) {
      await loadMilestones();
      return result;
    }
    return null;
  }, [noteId, loadMilestones]);

  const updateMilestone = useCallback(async (
    milestoneId: string,
    name?: string,
    description?: string,
    tags?: string[],
  ) => {
    const result = await invoke<Milestone>('update_milestone', {
      note_id: noteId,
      milestone_id: milestoneId,
      name,
      description,
      tags,
    });
    
    if (result) {
      await loadMilestones();
      return result;
    }
    return null;
  }, [noteId, loadMilestones]);

  const deleteMilestone = useCallback(async (milestoneId: string) => {
    const result = await invoke<boolean>('delete_milestone', {
      note_id: noteId,
      milestone_id: milestoneId,
    });
    
    if (result) {
      await loadMilestones();
    }
    return result;
  }, [noteId, loadMilestones]);

  const checkoutMilestone = useCallback(async (milestoneId: string) => {
    return invoke<string>('checkout_milestone', {
      note_id: noteId,
      milestone_id: milestoneId,
    });
  }, [noteId]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  return {
    milestones,
    loading,
    error,
    loadMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    checkoutMilestone,
  };
}

// 版本搜索Hook
export function useVersionSearch(noteId: string) {
  const [results, setResults] = useState<VersionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchVersions = useCallback(async (query: string) => {
    if (!query.trim() || !noteId) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const data = await invoke<VersionSearchResult[]>('search_versions', {
      note_id: noteId,
      query,
    });
    
    if (data) {
      setResults(data);
    } else {
      setError('Search failed');
    }
    
    setLoading(false);
  }, [noteId]);

  const searchGlobal = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const data = await invoke<any[]>('search_notes_with_versions', {
      query,
    });
    
    if (data) {
      setResults(data);
    } else {
      setError('Search failed');
    }
    
    setLoading(false);
  }, []);

  return { results, loading, error, searchVersions, searchGlobal };
}

// 导出备份Hook
export function useExportBackup(noteId: string) {
  const [exporting, setExporting] = useState(false);
  const [backing, setBacking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportNote = useCallback(async (format: 'markdown' | 'html' | 'json') => {
    setExporting(true);
    setError(null);
    
    const data = await invoke<Uint8Array>('export_note', {
      note_id: noteId,
      format,
    });
    
    setExporting(false);
    
    if (data) {
      return data;
    } else {
      setError('Export failed');
      return null;
    }
  }, [noteId]);

  const exportNotebook = useCallback(async (notebookId: string, format: 'markdown' | 'json') => {
    setExporting(true);
    setError(null);
    
    const data = await invoke<Uint8Array>('export_notebook', {
      notebook_id: notebookId,
      format,
    });
    
    setExporting(false);
    
    if (data) {
      return data;
    } else {
      setError('Export failed');
      return null;
    }
  }, []);

  const backupNote = useCallback(async (backupPath: string) => {
    setBacking(true);
    setError(null);
    
    const result = await invoke<boolean>('backup_note', {
      note_id: noteId,
      backup_path: backupPath,
    });
    
    setBacking(false);
    
    if (result) {
      return result;
    } else {
      setError('Backup failed');
      return false;
    }
  }, [noteId]);

  const restoreNote = useCallback(async (backupPath: string) => {
    setBacking(true);
    setError(null);
    
    const result = await invoke<any>('restore_note', {
      backup_path: backupPath,
    });
    
    setBacking(false);
    
    if (result) {
      return result;
    } else {
      setError('Restore failed');
      return null;
    }
  }, []);

  return {
    exporting,
    backing,
    error,
    exportNote,
    exportNotebook,
    backupNote,
    restoreNote,
  };
}

// 缓存管理Hook
export function useCacheManagement() {
  const [stats, setStats] = useState(null);

  const getCacheStats = useCallback(async () => {
    const result = await invoke<any>('get_cache_stats');
    if (result) {
      setStats(result);
      return result;
    }
    return null;
  }, []);

  const clearCache = useCallback(async () => {
    return invoke<boolean>('clear_cache');
  }, []);

  useEffect(() => {
    getCacheStats();
  }, [getCacheStats]);

  return { stats, getCacheStats, clearCache };
}
