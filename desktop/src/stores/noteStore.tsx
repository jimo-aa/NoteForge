// NoteForge — 全局状态管理

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { Note, NoteFilter, ToastMessage, ContextMenuState, SortOption } from '@/types';
import { generateId, countWords } from '@/utils/markdown';

// ================================================================
// Tauri invoke wrapper (graceful fallback)
// ================================================================

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

// ================================================================
// 初始示例数据（Tauri 后端不可用时回退）
// ================================================================

const DEMO_NOTES: Note[] = [
  {
    meta: { id: '1', title: 'NoteForge 架构设计', notebookId: 'tech',
      tags: ['架构', 'Rust', 'Tauri', 'NoteForge'], isPinned: true, isFavorite: false,
      wordCount: 128, version: 3, createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 300000, backlinks: 2 },
    content: `# NoteForge 架构设计\n\n## 系统概览\n\nNoteForge 采用 **离线优先** 架构。` +
      `Rust 引擎驱动：\n\n- **Markdown 解析** — pulldown-cmark，10万字 < 8ms\n` +
      `- **本地存储** — SQLite + WAL 模式\n- **全文搜索** — Tantivy\n` +
      `- **CRDT 同步** — Automerge 冲突自由合并\n\n` +
      `| 层级 | 技术 | 说明 |\n|------|------|------|\n| 桌面端 | Tauri + React | 高性能原生 |\n` +
      `| 核心引擎 | Rust | 零成本抽象 |\n\n` +
      `> 🎯 **核心原则**：数据属于用户。\n\n参考：\`[[同步协议设计]]\``,
  },
  {
    meta: { id: '2', title: 'Rust 内存安全入门', notebookId: 'tech',
      tags: ['Rust'], isPinned: false, isFavorite: true, wordCount: 340, version: 2,
      createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 3600000, backlinks: 0 },
    content: `# Rust 内存安全入门\n\n## 所有权系统\n\nRust 在**编译期**保证内存安全。\n` +
      `\`\`\`rust\nlet s = String::from("hello");\nlet s2 = s;\n// println!("{}", s);  // ❌\n\`\`\``,
  },
  {
    meta: { id: '3', title: '2026 Q2 学习计划', notebookId: 'default',
      tags: ['计划'], isPinned: true, isFavorite: false, wordCount: 89, version: 1,
      createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000 * 2, backlinks: 0 },
    content: `# 2026 Q2 学习计划\n\n- [ ] 深入 Rust 异步编程\n- [ ] 学习 Tauri 插件开发\n- [ ] 完成 NoteForge MVP\n` +
      `- [ ] 学习 Flutter 移动端开发`,
  },
  {
    meta: { id: '4', title: 'CRDT 同步协议设计', notebookId: 'project',
      tags: ['同步', '架构'], isPinned: false, isFavorite: true, wordCount: 3200, version: 5,
      createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000, backlinks: 3 },
    content: `# CRDT 同步协议设计\n\n## 什么是 CRDT\n\nCRDT ` +
      `(Conflict-free Replicated Data Types) 是一种无需中心化协调即可自动合并的数据结构。\n\n` +
      `### 优势\n\n- 去中心化\n- 天然支持离线\n- 自动合并，无需冲突解决`,
  },
];

const DEMO_NOTEBOOKS = [
  { id: 'all', name: '全部笔记', icon: '📋', noteCount: 4 },
  { id: 'default', name: '默认笔记本', icon: '📓', noteCount: 1 },
  { id: 'tech', name: '技术笔记', icon: '💻', noteCount: 2 },
  { id: 'project', name: '项目文档', icon: '🗂️', noteCount: 1 },
];

// ================================================================
// Store Hook
// ================================================================

export function useNoteStore() {
  const [notes, setNotes] = useState<Note[]>(DEMO_NOTES);
  const [notebooks, setNotebooks] = useState(DEMO_NOTEBOOKS);
  const [currentNoteId, setCurrentNoteId] = useState<string>(() => {
    return localStorage.getItem('nf_last_note') || '1';
  });
  const [currentFilter, setCurrentFilter] = useState<NoteFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNotebook, setActiveNotebook] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, noteId: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toastIdRef = useRef(0);

  // ===== 加载 Tauri 后端数据 =====
  useEffect(() => {
    (async () => {
      const backendNotes = await tauriInvoke<Note[]>('list_notes');
      if (backendNotes && backendNotes.length > 0) {
        setNotes(backendNotes);
      }
      const backendNbs = await tauriInvoke<typeof DEMO_NOTEBOOKS>('list_notebooks');
      if (backendNbs && backendNbs.length > 0) {
        setNotebooks([
          { id: 'all', name: '全部笔记', icon: '📋', noteCount: backendNotes?.length || 0 },
          ...backendNbs,
        ]);
      }
      setIsLoading(false);
    })();
  }, []);

  // ===== 持久化 =====
  useEffect(() => {
    localStorage.setItem('nf_last_note', currentNoteId);
  }, [currentNoteId]);

  // ===== 排序 =====
  const sortNotes = useCallback((notesToSort: Note[]) => {
    const copy = [...notesToSort];
    switch (sortBy) {
      case 'updated':
        copy.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt);
        break;
      case 'created':
        copy.sort((a, b) => b.meta.createdAt - a.meta.createdAt);
        break;
      case 'title':
        copy.sort((a, b) => a.meta.title.localeCompare(b.meta.title));
        break;
      case 'words':
        copy.sort((a, b) => b.meta.wordCount - a.meta.wordCount);
        break;
    }
    return copy;
  }, [sortBy]);

  // ===== 过滤 + 排序 =====
  const filteredNotes = sortNotes(notes.filter(n => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = n.meta.title.toLowerCase().includes(q) ||
        n.meta.tags.some(t => t.toLowerCase().includes(q)) ||
        n.content.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (activeNotebook !== 'all' && n.meta.notebookId !== activeNotebook) return false;
    if (currentFilter === 'favorites' && !n.meta.isFavorite) return false;
    if (currentFilter === 'pinned' && !n.meta.isPinned) return false;
    return true;
  }));

  const currentNote = notes.find(n => n.meta.id === currentNoteId) || null;

  // ===== 操作 =====
  const selectNote = useCallback((id: string) => {
    setCurrentNoteId(id);
  }, []);

  const createNote = useCallback(
    (title: string, content: string, notebookId: string, tags: string[]) => {
      const now = Date.now();
      const note: Note = {
        meta: {
          id: generateId(), title, notebookId,
          tags, isPinned: false, isFavorite: false,
          wordCount: countWords(content), version: 1,
          createdAt: now, updatedAt: now, backlinks: 0,
        },
        content,
      };
      setNotes(prev => [note, ...prev]);
      setCurrentNoteId(note.meta.id);
      tauriInvoke('create_note', {
        request: {
          title, content, notebook_id: notebookId, tags,
        },
      });
      // 更新笔记本计数
      setNotebooks(prev => prev.map(nb => {
        if (nb.id === 'all') return { ...nb, noteCount: nb.noteCount + 1 };
        if (nb.id === notebookId) return { ...nb, noteCount: nb.noteCount + 1 };
        return nb;
      }));
      return note;
    },
    [],
  );

  const updateNote = useCallback(
    (id: string, updates: Partial<Note['meta'] & { content: string }>) => {
      setNotes(prev => {
        const newNotes = prev.map(n => {
          if (n.meta.id !== id) return n;
          const newMeta = { ...n.meta, ...updates, updatedAt: Date.now() };
          if (updates.content !== undefined) {
            newMeta.wordCount = countWords(updates.content);
          }
          return { meta: newMeta, content: updates.content ?? n.content };
        });
        // Sync to Tauri
        if (updates.title !== undefined || updates.content !== undefined) {
          tauriInvoke('update_note', {
            id,
            title: updates.title ?? null,
            content: updates.content ?? null,
            tags: null,
            isPinned: null,
            isFavorite: null,
          });
        }
        return newNotes;
      });
    },
    [],
  );

  // ===== Toast (定义在引用者之前) =====
  const showToast = useCallback(
    (type: ToastMessage['type'], message: string) => {
      const id = ++toastIdRef.current;
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
    },
    [],
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotes(prev => prev.filter(n => n.meta.id !== id));
      if (currentNoteId === id) {
        const remaining = notes.filter(n => n.meta.id !== id);
        setCurrentNoteId(remaining.length > 0 ? remaining[0].meta.id : '');
      }
      tauriInvoke('delete_note', { id });
      setNotebooks(prev => prev.map(nb => ({ ...nb, noteCount: Math.max(0, nb.noteCount - 1) })));
    },
    [currentNoteId, notes, showToast],
  );

  const duplicateNote = useCallback(
    (id: string) => {
      const note = notes.find(n => n.meta.id === id);
      if (!note) return;
      const copy: Note = {
        meta: {
          ...note.meta,
          id: generateId(),
          title: note.meta.title + ' (副本)',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        content: note.content,
      };
      setNotes(prev => {
        const idx = prev.findIndex(n => n.meta.id === id);
        const next = [...prev];
        next.splice(idx + 1, 0, copy);
        return next;
      });
      setCurrentNoteId(copy.meta.id);
      showToast('success', '📋 已复制');
    },
    [notes, showToast],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      setNotes(prev => prev.map(n =>
        n.meta.id === id
          ? { ...n, meta: { ...n.meta, isFavorite: !n.meta.isFavorite, updatedAt: Date.now() } }
          : n,
      ));
      tauriInvoke('update_note', { id, isFavorite: null, isPinned: null, title: null, content: null, tags: null });
    },
    [],
  );

  const togglePin = useCallback(
    (id: string) => {
      setNotes(prev => prev.map(n =>
        n.meta.id === id
          ? { ...n, meta: { ...n.meta, isPinned: !n.meta.isPinned, updatedAt: Date.now() } }
          : n,
      ));
      tauriInvoke('update_note', { id, isPinned: null, isFavorite: null, title: null, content: null, tags: null });
    },
    [],
  );

  // ===== 统计 =====
  const totalCount = notes.length;
  const favoriteCount = notes.filter(n => n.meta.isFavorite).length;
  const searchResultCount = searchQuery ? filteredNotes.length : null;

  return {
    notes, filteredNotes, currentNote, currentNoteId,
    notebooks, activeNotebook, currentFilter, searchQuery, sortBy,
    isPreviewVisible, isGraphOpen, isPropertiesOpen,
    toasts, contextMenu, settingsOpen, isLoading,
    totalCount, favoriteCount, searchResultCount,

    setActiveNotebook, setCurrentFilter, setSearchQuery, setSortBy,
    setIsPreviewVisible, setIsGraphOpen, setIsPropertiesOpen,
    setContextMenu, setSettingsOpen,

    selectNote, createNote, updateNote, deleteNote, duplicateNote,
    toggleFavorite, togglePin,
    showToast, setCurrentNoteId,
  };
}

// ================================================================
// Context Provider
// ================================================================

export const NoteContext = createContext<NoteStore | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const store = useNoteStore();
  return (
    <NoteContext.Provider value={store}>
      {children}
    </NoteContext.Provider>
  );
}

export function useStore(): NoteStore {
  const store = useContext(NoteContext);
  if (!store) throw new Error('useStore must be used within NoteProvider');
  return store;
}

export type NoteStore = ReturnType<typeof useNoteStore>;
