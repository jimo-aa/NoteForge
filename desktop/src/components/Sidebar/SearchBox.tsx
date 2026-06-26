import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/stores/context';
import { Icon } from '@/components/Common/Icon';

type SearchResultItem = {
  id: string;
  title: string;
  snippet: string;
  tag: string;
  updatedAt: string;
  type: 'note' | 'tag' | 'command';
  noteId?: string;
  line?: number;
  column?: number;
};

function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  return import('@tauri-apps/api/core').then(({ invoke }) => invoke<T>(cmd, args).catch(() => null)).catch(() => null);
}

export function SearchBox() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(store.searchQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => setOpen(false);
  const openSearch = () => {
    setQuery(store.searchQuery);
    setActiveIndex(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(async () => {
      const hits = await tauriInvoke<Array<{ id: string; title: string; snippet: string; updatedAt: number; line: number; column: number }>>('search_note_hits', { query });
      setResults((hits ?? []).map((hit) => ({
        id: hit.id,
        title: hit.title,
        snippet: hit.snippet || '暂无片段',
        tag: '笔记命中',
        updatedAt: new Date(hit.updatedAt).toLocaleString(),
        type: 'note',
        noteId: hit.id,
        line: hit.line,
        column: hit.column,
      })));
      setActiveIndex(0);
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleSelect = async (index: number) => {
    const item = results[index];
    if (!item?.noteId) return;
    store.selectNote(item.noteId);
    store.setCurrentNoteId(item.noteId);
    store.setSearchQuery(query);
    close();
    window.dispatchEvent(new CustomEvent('noteforge:jump-to-hit', { detail: { noteId: item.noteId, line: item.line ?? 1, column: item.column ?? 1 } }));
  };

  const modal = open ? createPortal(
    <div className="search-modal-backdrop" onMouseDown={close}>
      <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-modal__header">
          <span className="search-modal__icon"><Icon type="search" /></span>
          <input
            ref={inputRef}
            autoFocus
            className="search-modal__input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            placeholder="输入关键词搜索笔记..."
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0))); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((prev) => Math.max(prev - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); void handleSelect(activeIndex); }
            }}
          />
          <button type="button" className="search-modal__close" onClick={close}>×</button>
        </div>

        <div className="search-modal__body">
          <div className="search-modal__section-header">
            <span>搜索结果</span>
            <span>{results.length} 条</span>
          </div>

          {results.length === 0 ? (
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
                  className={`search-result${index === activeIndex ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void handleSelect(index)}
                >
                  <div className="search-result__top">
                    <div className="search-result__title-row">
                      <span className="search-result__type search-result__type--note">笔记</span>
                      <strong>{item.title}</strong>
                    </div>
                    <span className="search-result__time">{item.updatedAt}</span>
                  </div>
                  <p>{item.snippet}</p>
                  <div className="search-result__footer">
                    <span>{item.tag}</span>
                    <span>{index === activeIndex ? `回车跳转到第 ${item.line ?? 1} 行` : '点击跳转'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>, document.body) : null;

  return (
    <>
      <button className="search-trigger" type="button" onClick={openSearch}>
        <span className="icon"><Icon type="search" /></span>
        <span className="search-trigger__text">搜索笔记...</span>
        <span className="search-shortcut">⌘K</span>
      </button>
      {modal}
    </>
  );
}
