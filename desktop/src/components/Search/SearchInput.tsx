import { useTranslation } from 'react-i18next';
import type { SearchDirective } from './useSearch';

interface SearchInputProps {
  query: string;
  setQuery: (q: string) => void;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  showHistory: boolean;
  searchHistory: string[];
  directives: { textOnly: string; directives: SearchDirective[] };
  onHistorySelect: (q: string) => void;
  onClearHistory: () => void;
  onRemoveFilter: (d: SearchDirective) => void;
  inputRef: React.RefObject<HTMLInputElement> | { current: HTMLInputElement | null };
  onClose: () => void;
  resultsLength: number;
  onSelect: (index: number) => void;
}

export function SearchInput({
  query,
  setQuery,
  activeIndex,
  setActiveIndex,
  showHistory,
  searchHistory,
  directives,
  onHistorySelect,
  onClearHistory,
  onRemoveFilter,
  inputRef,
  onClose,
  resultsLength,
  onSelect,
}: SearchInputProps) {
  const { t } = useTranslation();

  return (
    <div className="search-modal__header">
      <span className="search-modal__icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </span>
      <input
        ref={inputRef}
        autoFocus
        className="search-modal__input"
        value={query}
        onFocus={() => {
          if (!query) {
            // showHistory is managed by parent
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        placeholder={t('search.placeholder')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, Math.max(resultsLength - 1, 0)));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            onSelect(activeIndex);
          }
        }}
      />
      <button type="button" className="search-modal__close" onClick={onClose}>
        ×
      </button>

      {/* Filter chips */}
      {directives.directives.length > 0 && (
        <div className="search-filter-chips">
          {directives.directives.map((d) => (
            <span key={d.raw} className={`search-chip search-chip--${d.kind}`}>
              {d.kind === 'tag' && <>{t('search.filterTag', { value: d.value })}</>}
              {d.kind === 'notebook' && <>{t('search.filterNotebook', { value: d.value })}</>}
              {d.kind === 'pinned' && <>{t('search.filterPinned')}</>}
              {d.kind === 'favorite' && <>{t('search.filterFavorite')}</>}
              <button className="search-chip__remove" onClick={() => onRemoveFilter(d)}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Search history dropdown */}
      {!query && showHistory && searchHistory.length > 0 && (
        <div className="search-history-dropdown">
          <div className="search-history-header">
            <span>{t('search.recentSearches')}</span>
            <button className="search-history-clear" onClick={onClearHistory}>{t('search.clear')}</button>
          </div>
          {searchHistory.map((hq) => (
            <button
              key={hq}
              className="search-history-item"
              onClick={() => onHistorySelect(hq)}
            >
              <span className="search-history-icon">⌕</span>
              <span className="search-history-query">{hq}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
