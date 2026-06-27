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
  total_hits: number;
};

type SearchPage = {
  results: SearchResult[];
  total_hits: number;
};

type SearchResultItem = {
  id: string;
  title: string;
  snippet: string;
  score: number;
  updatedAt: string;
  noteId?: string;
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
  const [currentPage, setCurrentPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [fuzzyFallback, setFuzzyFallback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageSize = 5;

  const close = () => {
    setOpen(false);
  };

  const openSearch = () => {
    setQuery('');
    setActiveIndex(0);
    setResults([]);
    setTotalResults(0);
    setFuzzyFallback(false);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open || !query) {
      setResults([]);
      setCurrentPage(0);
      setTotalResults(0);
      setFuzzyFallback(false);
      return;
    }

    const t = window.setTimeout(async () => {
      setLoading(true);
      setFuzzyFallback(false);
      try {
        const page = await tauriInvoke<SearchPage>('search_notes_advanced', {
          query,
          limit: pageSize,
          offset: 0,
        });

        if (page && page.results.length > 0) {
          setTotalResults(page.total_hits);
          setResults(
            page.results.map((hit: SearchResult) => ({
              id: hit.note_id,
              title: hit.title,
              snippet: hit.snippet || '暂无内容预览',
              score: hit.score,
              updatedAt: new Date(hit.updated_at).toLocaleString(),
              noteId: hit.note_id,
            }))
          );
          setCurrentPage(0);
        } else {
          const fuzzyResults = await tauriInvoke<SearchResult[]>('search_notes_fuzzy', {
            query,
          });
          if (fuzzyResults && fuzzyResults.length > 0) {
            setTotalResults(fuzzyResults.length);
            setResults(
              fuzzyResults.slice(0, pageSize).map((hit: SearchResult) => ({
                id: hit.note_id,
                title: hit.title,
                snippet: hit.snippet || '暂无内容预览',
                score: hit.score,
                updatedAt: new Date(hit.updated_at).toLocaleString(),
                noteId: hit.note_id,
              }))
            );
            setFuzzyFallback(true);
          } else {
            setResults([]);
            setTotalResults(0);
          }
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setTotalResults(0);
      } finally {
        setLoading(false);
        setActiveIndex(0);
      }
    }, 300);

    return () => window.clearTimeout(t);
  }, [open, query]);

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
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setCurrentPage(0);
      setTotalResults(0);
      setFuzzyFallback(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const loadPage = async (pageNum: number) => {
    if (!query) return;

    try {
      setLoading(true);
      const page = await tauriInvoke<SearchPage>('search_notes_advanced', {
        query,
        limit: pageSize,
        offset: pageNum * pageSize,
      });

      if (page && page.results.length > 0) {
        setResults(
          page.results.map((hit: SearchResult) => ({
            id: hit.note_id,
            title: hit.title,
            snippet: hit.snippet || '暂无内容预览',
            score: hit.score,
            updatedAt: new Date(hit.updated_at).toLocaleString(),
            noteId: hit.note_id,
          }))
        );
        setTotalResults(page.total_hits);
        setCurrentPage(pageNum);
        setActiveIndex(0);
      }
    } catch (error) {
      console.error('Page load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (index: number) => {
    const item = results[index];
    if (!item?.noteId) return;

    setHighlightedId(item.noteId);
    store.selectNote(item.noteId);
    store.setCurrentNoteId(item.noteId);
    close();

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedId(null);
    }, 2000);
  };

  const totalPages = totalResults > 0 ? Math.ceil(totalResults / pageSize) : 0;
  const currentPageNum = currentPage + 1;

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
                <span>
                  搜索结果 {loading && <span className="loading">搜索中...</span>}
                  {fuzzyFallback && !loading && <span className="loading" style={{color:'var(--warning)'}}> 已启用模糊匹配</span>}
                </span>
                <span>
                  {totalResults > 0
                    ? `${currentPageNum}/${totalPages} 页 (共 ${totalResults} 条)`
                    : ''}
                </span>
              </div>

              {!query ? (
                <div className="search-empty">
                  <div className="search-empty__icon">⌕</div>
                  <strong>输入关键词开始搜索</strong>
                  <p>支持中文分词，自动模糊匹配</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="search-empty">
                  <div className="search-empty__icon">⌕</div>
                  <strong>没有找到相关内容</strong>
                  <p>尝试更换关键词，搜索会自动启用模糊匹配。</p>
                </div>
              ) : results.length === 0 ? null : (
                <>
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
                          </div>
                          <span className="search-result__time">{item.updatedAt}</span>
                        </div>
                        <p className="search-result__snippet">{item.snippet}</p>
                        <div className="search-result__footer">
                          <span>{index === activeIndex ? '回车打开' : '点击打开'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="search-pagination">
                      <button
                        type="button"
                        className="search-pagination__btn"
                        onClick={() => void loadPage(currentPage - 1)}
                        disabled={currentPage === 0 || loading}
                      >
                        ← 上一页
                      </button>
                      <span className="search-pagination__info">
                        {currentPageNum} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className="search-pagination__btn"
                        onClick={() => void loadPage(currentPage + 1)}
                        disabled={currentPage >= totalPages - 1 || loading}
                      >
                        下一页 →
                      </button>
                    </div>
                  )}
                </>
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
