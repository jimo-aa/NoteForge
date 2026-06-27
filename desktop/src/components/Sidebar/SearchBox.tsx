import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/stores/context';
import { Icon } from '@/components/Common/Icon';

type SearchResult = {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: number;
};

type SearchResultItem = {
  id: string;
  title: string;
  snippet: string;
  score: number;
  tag: string;
  updatedAt: string;
  type: 'note' | 'tag' | 'command';
  noteId?: string;
  line?: number;
  column?: number;
};

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`[Search API Error] ${cmd}:`, error);
    return null;
  }
}

export function SearchBox() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const close = () => {
    setOpen(false);
  };

  const openSearch = () => {
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open || !query) {
      setResults([]);
      return;
    }

    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        // 使用新的搜索 API
        const searchResults = await tauriInvoke<SearchResult[]>('search_notes', { 
          query 
        });

        if (searchResults && searchResults.length > 0) {
          setResults(
            searchResults.map((hit: SearchResult) => ({
              id: hit.note_id,
              title: hit.title,
              snippet: hit.snippet || '暂无内容预览',
              score: hit.score,
              tag: `相关性: ${(hit.score * 100).toFixed(0)}%`,
              updatedAt: new Date(hit.updated_at).toLocaleString(),
              type: 'note' as const,
              noteId: hit.note_id,
              line: 1,
              column: 1,
            }))
          );
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
        setActiveIndex(0);
      }
    }, 300);

    return () => window.clearTimeout(t);
  }, [open, query]);

  // 注册快捷键：Cmd+K (Mac) / Ctrl+K (Windows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // 当搜索框关闭时，清空搜索内容和高亮状态
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      // 只在真正关闭时保持高亮状态，用于视觉反馈
    }
  }, [open]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const handleSelect = async (index: number) => {
    const item = results[index];
    if (!item?.noteId) return;
    
    // 标记为已高亮
    setHighlightedId(item.noteId);
    
    // 更新全局状态
    store.selectNote(item.noteId);
    store.setCurrentNoteId(item.noteId);
    
    // 关闭搜索框
    close();
    
    // 2 秒后清除高亮，只显示一次
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedId(null);
    }, 2000);
  };

  const modal = open
    ? createPortal(
        <div className="search-modal-backdrop" onMouseDown={close}>
          <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="search-modal__header">
              <span className="search-modal__icon">
                <Icon type="search" />
              </span>
              <input
                ref={inputRef}
                autoFocus
                className="search-modal__input"
                value={query}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setQuery(newValue);
                  setActiveIndex(0);
                  // 输入新内容时重置高亮状态
                  if (newValue) {
                    setHighlightedId(null);
                  }
                }}
                placeholder="输入关键词搜索笔记..."
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close();
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex((prev) =>
                      Math.min(prev + 1, Math.max(results.length - 1, 0))
                    );
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex((prev) => Math.max(prev - 1, 0));
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSelect(activeIndex);
                  }
                }}
              />
              <button type="button" className="search-modal__close" onClick={close}>
                ×
              </button>
            </div>

            <div className="search-modal__body">
              <div className="search-modal__section-header">
                <span>搜索结果 {loading && <span className="loading">搜索中...</span>}</span>
                <span>
                  {results.length} 条
                </span>
              </div>

              {!query ? (
                <div className="search-empty">
                  <div className="search-empty__icon">⌕</div>
                  <strong>输入关键词开始搜索</strong>
                  <p>支持中文分词，模糊搜索</p>
                </div>
              ) : results.length === 0 ? (
                <div className="search-empty">
                  <div className="search-empty__icon">⌕</div>
                  <strong>没有找到相关内容</strong>
                  <p>尝试更换关键词，或确认笔记已经完成索引。</p>
                </div>
              ) : (
                <div className="search-results">
                  {results.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`search-result${index === activeIndex ? ' active' : ''}${highlightedId === item.noteId ? ' highlighted' : ''}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void handleSelect(index)}
                    >
                      <div className="search-result__top">
                        <div className="search-result__title-row">
                          <span className="search-result__type search-result__type--note">
                            笔记
                          </span>
                          <strong>{item.title}</strong>
                          <span className="search-result__score">
                            {(item.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <span className="search-result__time">{item.updatedAt}</span>
                      </div>
                      <p className="search-result__snippet">{item.snippet}</p>
                      <div className="search-result__footer">
                        <span>{item.tag}</span>
                        <span>
                          {index === activeIndex
                            ? '回车打开'
                            : highlightedId === item.noteId
                            ? '已打开'
                            : '点击打开'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        className="search-trigger"
        type="button"
        onClick={openSearch}
      >
        <span className="icon">
          <Icon type="search" />
        </span>
        <span className="search-trigger__text">搜索笔记...</span>
        <span className="search-shortcut">⌘K</span>
      </button>
      {modal}
    </>
  );
}
