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
