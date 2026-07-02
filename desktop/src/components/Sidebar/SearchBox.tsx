import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/stores/context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Icon';
import { tauriInvoke } from '@/utils/invoke';
import { searchCache } from '@/utils/searchCache';

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

interface SearchDirective {
  kind: 'tag' | 'notebook' | 'pinned' | 'favorite';
  raw: string;
  value: string;
}

const HISTORY_KEY = 'noteforge:search:history';
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

function pushHistory(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const prev = loadHistory().filter((q) => q !== trimmed);
  saveHistory([trimmed, ...prev]);
}

/** Parse search directives from query; returns { textOnly, directives }. */
function parseDirectives(raw: string): { textOnly: string; directives: SearchDirective[] } {
  const dirs: SearchDirective[] = [];
  const parts: string[] = [];
  for (const token of raw.split(/\s+/)) {
    const tagMatch = token.match(/^tag:(\S+)$/i);
    if (tagMatch?.[1]) {
      dirs.push({ kind: 'tag', raw: token, value: tagMatch[1] });
      continue;
    }
    const nbMatch = token.match(/^notebook:(\S+)$/i);
    if (nbMatch?.[1]) {
      dirs.push({ kind: 'notebook', raw: token, value: nbMatch[1] });
      continue;
    }
    const isMatch = token.match(/^is:(\S+)$/i);
    if (isMatch?.[1]) {
      const val = isMatch[1].toLowerCase();
      if (val === 'pinned') {
        dirs.push({ kind: 'pinned', raw: token, value: 'pinned' });
        continue;
      }
      if (val === 'favorite' || val === 'fav') {
        dirs.push({ kind: 'favorite', raw: token, value: 'favorite' });
        continue;
      }
    }
    parts.push(token);
  }
  return { textOnly: parts.join(' ').trim(), directives: dirs };
}

export function SearchBox() {
  const store = useStore();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [fuzzyFallback, setFuzzyFallback] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadHistory());
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageSize = 5;

  const directives = useMemo(() => parseDirectives(query), [query]);
  const textQuery = directives.textOnly;

  const close = () => {
    setOpen(false);
    setShowHistory(false);
  };

  const openSearch = () => {
    setQuery('');
    setActiveIndex(0);
    setResults([]);
    setTotalResults(0);
    setFuzzyFallback(false);
    setShowHistory(true);
    setSearchHistory(loadHistory());
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  /** Apply parsed directives to the store as local filters. */
  const applyDirectives = useCallback((dirs: SearchDirective[]) => {
    for (const d of dirs) {
      switch (d.kind) {
        case 'tag': {
          const cur = store.tags;
          if (cur.includes(d.value)) {
            store.setActiveTags((prev: string[]) =>
              prev.includes(d.value) ? prev : [...prev, d.value],
            );
          }
          break;
        }
        case 'notebook': {
          const found = store.notebooks.find(
            (nb: { name: string }) => nb.name.toLowerCase() === d.value.toLowerCase(),
          );
          if (found) store.setActiveNotebook(found.id);
          break;
        }
        case 'pinned':
          store.setCurrentFilter('pinned');
          break;
        case 'favorite':
          store.setCurrentFilter('favorites');
          break;
      }
    }
  }, [store]);

  const removeDirective = useCallback((kind: SearchDirective['kind']) => {
    switch (kind) {
      case 'tag': break; // tags are managed individually
      case 'notebook': store.setActiveNotebook('all'); break;
      case 'pinned': store.setCurrentFilter('all'); break;
      case 'favorite': store.setCurrentFilter('all'); break;
    }
  }, [store]);

  useEffect(() => {
    if (!open || !query) {
      setResults([]);
      setCurrentPage(0);
      setTotalResults(0);
      setFuzzyFallback(false);
      return;
    }

    // Apply directives to store as side-effect
    if (directives.directives.length > 0) {
      applyDirectives(directives.directives);
    }

    // If no text query after stripping directives, skip backend search
    if (!textQuery) {
      setResults([]);
      setTotalResults(0);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      // Check cache first
      const cached = searchCache.get<SearchPage>('adv', textQuery, 0);
      if (cached) {
        setTotalResults(cached.total_hits);
        setResults(
          cached.results.map((hit: SearchResult) => ({
            id: hit.note_id,
            title: hit.title,
            snippet: hit.snippet || t('search.noPreview'),
            score: hit.score,
            updatedAt: new Date(hit.updated_at).toLocaleString(),
            noteId: hit.note_id,
          }))
        );
        setCurrentPage(0);
        setLoading(false);
        setActiveIndex(0);
        return;
      }

      setLoading(true);
      setFuzzyFallback(false);
      const t0 = performance.now();
      try {
        const page = await tauriInvoke<SearchPage>('search_notes_advanced', {
          query: textQuery,
          limit: pageSize,
          offset: 0,
        });

        if (page && page.results.length > 0) {
          searchCache.set('adv', textQuery, 0, page);
          setTotalResults(page.total_hits);
          setResults(
            page.results.map((hit: SearchResult) => ({
              id: hit.note_id,
              title: hit.title,
              snippet: hit.snippet || t('search.noPreview'),
              score: hit.score,
              updatedAt: new Date(hit.updated_at).toLocaleString(),
              noteId: hit.note_id,
            }))
          );
          setCurrentPage(0);
        } else {
          const fuzzyResults = await tauriInvoke<SearchResult[]>('search_notes_fuzzy', {
            query: textQuery,
          });
          if (fuzzyResults && fuzzyResults.length > 0) {
            setTotalResults(fuzzyResults.length);
            setResults(
              fuzzyResults.slice(0, pageSize).map((hit: SearchResult) => ({
                id: hit.note_id,
                title: hit.title,
                snippet: hit.snippet || t('search.noPreview'),
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
        const elapsed = performance.now() - t0;
        if (elapsed > 100) {
          console.debug(`[Perf] search "${textQuery}" took ${elapsed.toFixed(0)}ms`);
        }
        setLoading(false);
        setActiveIndex(0);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [open, textQuery, directives.directives, applyDirectives]);

  useEffect(() => {
    const handler = () => openSearch();
    window.addEventListener('noteforge:open-search', handler);
    return () => window.removeEventListener('noteforge:open-search', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open]);  

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const loadPage = async (pageNum: number) => {
    const useQuery = textQuery || query;
    if (!useQuery) return;

    try {
      setLoading(true);
      const page = await tauriInvoke<SearchPage>('search_notes_advanced', {
        query: useQuery,
        limit: pageSize,
        offset: pageNum * pageSize,
      });

      if (page && page.results.length > 0) {
        setResults(
          page.results.map((hit: SearchResult) => ({
            id: hit.note_id,
            title: hit.title,
            snippet: hit.snippet || t('search.noPreview'),
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

    pushHistory(textQuery || query);
    setSearchHistory(loadHistory());

    setHighlightedId(item.noteId);
    store.selectNote(item.noteId);
    close();

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedId(null);
    }, 2000);
  };

  const handleHistorySelect = (q: string) => {
    setQuery(q);
    setShowHistory(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    saveHistory([]);
    setSearchHistory([]);
  };

  const removeFilterChip = (d: SearchDirective) => {
    // Remove directive from query
    const parts = query.split(/\s+/).filter((t) => t !== d.raw);
    setQuery(parts.join(' ').trim());
    removeDirective(d.kind);
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
                onFocus={() => {
                  if (!query) setShowHistory(true);
                }}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setQuery(newValue);
                  setActiveIndex(0);
                  setShowHistory(false);
                  if (newValue) {
                    setHighlightedId(null);
                  }
                }}
                placeholder={t('search.placeholder')}
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

            {/* Filter chips */}
            {directives.directives.length > 0 && (
              <div className="search-filter-chips">
                {directives.directives.map((d) => (
                  <span key={d.raw} className={`search-chip search-chip--${d.kind}`}>
                    {d.kind === 'tag' && <>{t('search.filterTag', { value: d.value })}</>}
                    {d.kind === 'notebook' && <>{t('search.filterNotebook', { value: d.value })}</>}
                    {d.kind === 'pinned' && <>{t('search.filterPinned')}</>}
                    {d.kind === 'favorite' && <>{t('search.filterFavorite')}</>}
                    <button className="search-chip__remove" onClick={() => removeFilterChip(d)}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="search-modal__body">
              {/* Search history dropdown */}
              {!query && showHistory && searchHistory.length > 0 && (
                <div className="search-history-dropdown">
                  <div className="search-history-header">
                    <span>{t('search.recentSearches')}</span>
                    <button className="search-history-clear" onClick={clearHistory}>{t('search.clear')}</button>
                  </div>
                  {searchHistory.map((hq, i) => (
                    <button
                      key={hq}
                      className="search-history-item"
                      onClick={() => handleHistorySelect(hq)}
                    >
                      <span className="search-history-icon">⌕</span>
                      <span className="search-history-query">{hq}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="search-modal__section-header">
                <span>
                  {t('search.searchResults')} {loading && <span className="loading">{t('search.searching')}</span>}
                  {fuzzyFallback && !loading && <span className="loading" style={{color:'var(--warning)'}}> {t('search.fuzzyActive')}</span>}
                </span>
                <span>
                  {totalResults > 0
                    ? t('search.pagination', { current: currentPageNum, total: totalPages, count: totalResults })
                    : ''}
                </span>
              </div>

              {!query ? (
                searchHistory.length > 0 && !showHistory ? (
                  <div className="search-empty">
                    <div className="search-empty__icon">⌕</div>
                    <strong>{t('search.startTyping')}</strong>
                    <p>{t('search.startTypingDesc')}</p>
                  </div>
                ) : null
              ) : results.length === 0 && !loading ? (
                <div className="search-empty">
                  <div className="search-empty__icon">⌕</div>
                  <strong>{t('search.noResults')}</strong>
                  <p>{t('search.noResultsDesc')}</p>
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
                               {t('search.typeNote')}
                            </span>
                            <strong>{item.title}</strong>
                          </div>
                          <span className="search-result__time">{item.updatedAt}</span>
                        </div>
                        <p className="search-result__snippet">{item.snippet}</p>
                        <div className="search-result__footer">
                          <span>{index === activeIndex ? t('search.openEnter') : t('search.openClick')}</span>
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
                        {t('search.prevPage')}
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
                        {t('search.nextPage')}
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
        <span className="search-trigger__text">{t('search.triggerText')}</span>
        <span className="search-shortcut">⌘K</span>
      </button>
      {modal}
    </>
  );
}
