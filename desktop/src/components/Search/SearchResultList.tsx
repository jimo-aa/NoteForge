import { useMemo } from 'react';
import { useNoteStore } from '@/stores/useNoteStore';
import type { SearchResultItem } from './useSearch';

interface SearchResultListProps {
  results: SearchResultItem[];
  loading: boolean;
  totalResults: number;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  highlightedId: string | null;
  fuzzyFallback: boolean;
  searchMode: string;
  onSelect: (index: number) => void;
  onLoadPage: (page: number) => Promise<void>;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

/** Render snippet text with optional highlight spans wrapped in <mark>. */
function HighlightedSnippet({ text, highlights }: { text: string; highlights?: { start: number; end: number }[] }) {
  if (!highlights || highlights.length === 0) {
    return <>{text}</>;
  }

  // Sort highlights by start position
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const h of sorted) {
    if (h.start > cursor) {
      parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, h.start)}</span>);
    }
    parts.push(<mark key={`m-${h.start}`}>{text.slice(h.start, h.end)}</mark>);
    cursor = h.end;
  }
  if (cursor < text.length) {
    parts.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}

export function SearchResultList({
  results,
  loading,
  totalResults,
  activeIndex,
  setActiveIndex,
  highlightedId,
  fuzzyFallback,
  onSelect,
  onLoadPage,
  pageSize,
  currentPage,
  totalPages,
  t,
}: SearchResultListProps) {
  const store = useNoteStore();
  const notebookMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const nb of store.notebooks) {
      map.set(nb.id, nb.name);
    }
    return map;
  }, [store.notebooks]);

  const currentPageNum = currentPage + 1;

  if (loading && results.length === 0) {
    return (
      <div className="search-empty">
        <div className="search-empty__icon">⌕</div>
        <strong>{t('search.searching')}</strong>
      </div>
    );
  }

  if (!loading && results.length === 0) {
    return (
      <div className="search-empty">
        <div className="search-empty__icon">⌕</div>
        <strong>{t('search.noResults')}</strong>
        <p>{t('search.noResultsDesc')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="search-modal__section-header">
        <span>
          {t('search.searchResults')} {loading && <span className="loading">{t('search.searching')}</span>}
          {fuzzyFallback && !loading && (
            <span className="loading" style={{ color: 'var(--warning)' }}>
              {' '}{t('search.fuzzyActive')}
            </span>
          )}
        </span>
        <span>
          {totalResults > 0
            ? t('search.pagination', { current: currentPageNum, total: totalPages, count: totalResults })
            : ''}
        </span>
      </div>

      <div className="search-results">
        {results.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`search-result${index === activeIndex ? ' active' : ''}${highlightedId === item.noteId ? ' highlighted' : ''}`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => onSelect(index)}
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
            <p className="search-result__snippet">
              <HighlightedSnippet text={item.snippet} highlights={item.highlightSpans} />
            </p>
            <div className="search-result__footer">
              {item.notebookName && (
                <span className="search-result__notebook">{item.notebookName}</span>
              )}
              {item.tags && item.tags.length > 0 && (
                <span className="search-result__tags">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="search-result__tag">#{tag}</span>
                  ))}
                  {item.tags.length > 3 && <span className="search-result__tag-more">+{item.tags.length - 3}</span>}
                </span>
              )}
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
            onClick={() => onLoadPage(currentPage - 1)}
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
            onClick={() => onLoadPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1 || loading}
          >
            {t('search.nextPage')}
          </button>
        </div>
      )}
    </>
  );
}
