import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Common/Icon';
import { useSearch } from '@/components/Search/useSearch';
import { SearchModal } from '@/components/Search/SearchModal';

export function SearchBox() {
  const { t } = useTranslation();
  const search = useSearch();
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // noteforge:open-search event — already handled in useSearch hook
  // This component only renders the trigger button and delegates to SearchModal

  return (
    <>
      <button
        className="search-trigger"
        type="button"
        onClick={search.openSearch}
      >
        <span className="icon">
          <Icon type="search" />
        </span>
        <span className="search-trigger__text">{t('search.triggerText')}</span>
        <span className="search-shortcut">⌘K</span>
      </button>
      <SearchModal search={search} />
    </>
  );
}
