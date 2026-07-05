// NoteForge 版本快照类型 (NoteSnapshot)

// 版本快照
export interface NoteSnapshot {
  id: string;
  noteId: string;
  versionNumber: number;
  title: string;
  description: string;
  content: string;
  contentPlain: string;
  wordCount: number;
  isAutoSave: boolean;
  createdAt: number;
}

// Diff 操作
export interface DiffOperation {
  opType: 'add' | 'remove';
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
