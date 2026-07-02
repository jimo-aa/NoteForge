import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/modals.css';
import { tauriInvoke as invoke } from '@/utils/invoke';

interface VersionSearchResult {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: number;
  version_count?: number;
}

export function VersionSearchModal({ 
  open, 
  noteId,
  onClose,
  onSelect
}: { 
  open: boolean; 
  noteId: string;
  onClose: () => void;
  onSelect?: (result: VersionSearchResult) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VersionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'versions' | 'global'>('versions');

  const performSearch = async () => {
    setLoading(true);

    if (searchMode === 'versions') {
      const data = await invoke<VersionSearchResult[]>('search_versions', {
        note_id: noteId,
        query,
      });
      if (data) setResults(data);
    } else {
      const data = await invoke<any[]>('search_notes_with_versions', {
        query,
      });
      if (data) setResults(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchMode]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="version-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('versionSearch.title')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="search-header">
          <div className="search-input-group">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('versionSearch.inputPlaceholder')}
              autoFocus
            />
            {query && (
              <button 
                className="clear-btn"
                onClick={() => setQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="search-mode-tabs">
            <button 
              className={`tab ${searchMode === 'versions' ? 'active' : ''}`}
              onClick={() => setSearchMode('versions')}
            >
              {t('versionSearch.tabVersions')}
            </button>
            <button 
              className={`tab ${searchMode === 'global' ? 'active' : ''}`}
              onClick={() => setSearchMode('global')}
            >
              {t('versionSearch.tabGlobal')}
            </button>
          </div>
        </div>

        <div className="modal-content-large">
          {loading ? (
            <div className="loading-state">{t('versionSearch.searching')}</div>
          ) : query.trim() ? (
            results.length > 0 ? (
              <div className="search-results">
                {results.map((result, idx) => (
                  <div 
                    key={idx}
                    className="search-result-item"
                    onClick={() => {
                      if (onSelect) onSelect(result);
                      onClose();
                    }}
                  >
                    <div className="result-header">
                      <h4>{result.title}</h4>
                      {result.version_count && (
                        <span className="version-count">{t('versionSearch.versionCount', { count: result.version_count })}</span>
                      )}
                    </div>
                    <p className="result-snippet">{result.snippet}</p>
                    <div className="result-meta">
                      <span className="score">{t('versionSearch.relevance', { score: (result.score * 100).toFixed(0) })}</span>
                      <span className="time">{new Date(result.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">{t('versionSearch.noResults')}</div>
            )
          ) : (
            <div className="placeholder-state">{t('versionSearch.startTyping')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
