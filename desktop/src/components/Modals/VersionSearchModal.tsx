import { useState, useEffect } from 'react';
import '../../../styles/modals.css';

interface VersionSearchResult {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: number;
  version_count?: number;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`invoke ${cmd} failed:`, error);
    return null;
  }
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VersionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'versions' | 'global'>('versions');

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

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="version-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>搜索版本</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="search-header">
          <div className="search-input-group">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索版本标题、摘要或笔记内容..."
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
              本笔记版本
            </button>
            <button 
              className={`tab ${searchMode === 'global' ? 'active' : ''}`}
              onClick={() => setSearchMode('global')}
            >
              全局搜索
            </button>
          </div>
        </div>

        <div className="modal-content-large">
          {loading ? (
            <div className="loading-state">搜索中...</div>
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
                        <span className="version-count">{result.version_count} 个版本</span>
                      )}
                    </div>
                    <p className="result-snippet">{result.snippet}</p>
                    <div className="result-meta">
                      <span className="score">相关度: {(result.score * 100).toFixed(0)}%</span>
                      <span className="time">{new Date(result.updated_at).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">未找到匹配结果</div>
            )
          ) : (
            <div className="placeholder-state">输入关键词开始搜索</div>
          )}
        </div>
      </div>
    </div>
  );
}
