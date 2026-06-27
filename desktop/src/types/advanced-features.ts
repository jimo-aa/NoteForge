// NoteForge 高级功能 - TypeScript类型定义

// Diff相关类型
export interface DiffOperation {
  opType: 'add' | 'remove' | 'modify';
  lineNum: number;
  oldText?: string;
  newText?: string;
  context: string;
}

export interface ChangeSummary {
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  wordCountDelta: number;
}

export interface DiffResult {
  fromVersion: string;
  toVersion: string;
  operations: DiffOperation[];
  similarity: number;
  changeSummary: ChangeSummary;
}

// 里程碑相关类型
export interface Milestone {
  id: string;
  note_id: string;
  name: string;
  description?: string;
  commit_id: string;
  version_number: number;
  created_at: number;
  tags: string[];
}

// 版本搜索相关类型
export interface VersionSearchResult {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: number;
  version_count?: number;
}

// 版本元数据相关类型
export interface VersionMetadata {
  id: string;
  title: string;
  summary: string;
  updated_at: number;
  branch: string;
  parent_count: number;
}

// 缓存统计相关类型
export interface CacheStats {
  version_cache_entries: number;
  diff_cache_entries: number;
  search_cache_entries: number;
  total_entries: number;
  cache_ttl_seconds: number;
}

// 导出格式类型
export type ExportFormat = 'markdown' | 'html' | 'json';

// 备份配置类型
export interface BackupConfig {
  autoBackup: boolean;
  backupIntervalHours: number;
  maxBackups: number;
  lastBackupAt?: number;
}

// 高级功能状态管理类型
export interface AdvancedFeaturesState {
  showDiffViewer: boolean;
  showMilestones: boolean;
  showVersionSearch: boolean;
  showExportBackup: boolean;
  selectedVersions: {
    from: string;
    to: string;
  };
  selectedMilestone: Milestone | null;
  cacheStats: CacheStats | null;
}

// API调用返回类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
