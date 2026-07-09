import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { SearchInput } from './SearchInput';
import { SearchResultList } from './SearchResultList';
import type { UseSearchReturn } from './useSearch';

interface SearchModalProps {
  search: UseSearchReturn;
}

export function SearchModal({ search }: SearchModalProps) {
  const { t } = useTranslation();

  if (!search.open) return null;

  return createPortal(
    <div className="search-modal-backdrop" onMouseDown={search.close}>
      <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <SearchInput
          query={search.query}
          setQuery={search.setQuery}
          activeIndex={search.activeIndex}
          setActiveIndex={search.setActiveIndex}
          showHistory={search.showHistory}
          searchHistory={search.searchHistory}
          directives={search.directives}
          onHistorySelect={search.handleHistorySelect}
          onClearHistory={search.clearHistory}
          onRemoveFilter={search.removeFilterChip}
          inputRef={search.inputRef}
          onClose={search.close}
          resultsLength={search.results.length}
          onSelect={search.handleSelect}
        />

        {/* Mode toggle */}
        <div className="search-mode-toggle">
          <button
            className={`search-mode-btn${search.searchMode === 'fulltext' ? ' active' : ''}`}
            onClick={() => search.setSearchMode('fulltext')}
          >
            {t('search.modeFulltext')}
          </button>
          <button
            className={`search-mode-btn${search.searchMode === 'semantic' ? ' active' : ''}`}
            onClick={() => search.setSearchMode('semantic')}
          >
            {t('search.modeSemantic')}
          </button>
          <button
            className={`search-mode-btn${search.searchMode === 'hybrid' ? ' active' : ''}`}
            onClick={() => search.setSearchMode('hybrid')}
          >
            {t('search.modeHybrid')}
          </button>
        </div>

        <div className="search-modal__body">
          {!search.query && search.showHistory && search.searchHistory.length > 0 ? null : (
            <SearchResultList
              results={search.results}
              loading={search.loading}
              totalResults={search.totalResults}
              activeIndex={search.activeIndex}
              setActiveIndex={search.setActiveIndex}
              highlightedId={search.highlightedId}
              fuzzyFallback={search.fuzzyFallback}
              searchMode={search.searchMode}
              onSelect={search.handleSelect}
              onLoadPage={search.loadPage}
              pageSize={search.pageSize}
              currentPage={search.currentPage}
              totalPages={search.totalPages}
              t={t}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
