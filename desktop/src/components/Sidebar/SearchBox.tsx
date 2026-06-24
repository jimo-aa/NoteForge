import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/stores/context';

type SearchResultItem = {
  id: string;
  title: string;
  snippet: string;
  tag: string;
  updatedAt: string;
  type: 'note' | 'tag' | 'command';
  noteId?: string;
};

const MOCK_RESULTS: SearchResultItem[] = [
  { id: 'mock-tag-1', title: '固定笔记', snippet: '快速定位高频查看的内容，减少重复查找。', tag: '#功能', updatedAt: '今天', type: 'tag' },
  { id: 'mock-cmd-1', title: '创建新笔记', snippet: '直接生成一篇新的 Markdown 文档。', tag: '快捷操作', updatedAt: '快捷入口', type: 'command' },
];
export function SearchBox() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(store.searchQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<SearchResultItem[]>(() => {
    const base = store.notes.slice(0, 8).map((note) => ({
      id: note.meta.id,
      title: note.meta.title,
      snippet: note.content.replace(/[#*`>-]/g, '').slice(0, 70) || '暂无内容预览',
      tag: note.meta.tags[0] ? `#${note.meta.tags[0]}` : '无标签',
      updatedAt: '最近更新',
      type: 'note' as const,
      noteId: note.meta.id,
    }));
    const mockOnly = MOCK_RESULTS;
    const q = query.trim().toLowerCase();
    const merged = [...base, ...mockOnly];
    if (!q) return merged;
    return merged.filter((item) => [item.title, item.snippet, item.tag, item.type].some((text) => text.toLowerCase().includes(q)));
  }, [query, store.notes]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((prev) => Math.min(prev, Math.max(results.length - 1, 0)));
  }, [open, results.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);
  const openSearch = () => {
    setQuery(store.searchQuery);
    setActiveIndex(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };
  const applyQuery = (value: string) => setQuery(value);

  const handleSelect = (index: number) => {
    const item = results[index];
    if (!item) return;
    if (item.type === 'note' && item.noteId) {
      store.selectNote(item.noteId);
      const note = store.notes.find((n) => n.meta.id === item.noteId);
      if (note) {
        store.setSearchQuery(note.meta.title);
        store.setCurrentNoteId(note.meta.id);
      }
      close();
      return;
    }
    if (item.type === 'tag') {
      store.setSearchQuery(item.tag.replace(/^#/, ''));
      close();
      return;
    }
    close();
  };

  const modal = open ? createPortal(
    <div className="search-modal-backdrop" onMouseDown={close}>
      <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-modal__header">
          <span className="search-modal__icon">🔍</span>
          <input
            ref={inputRef}
            autoFocus
            className="search-modal__input"
            value={query}
            onChange={(e) => { applyQuery(e.target.value); setActiveIndex(0); }}
            placeholder="输入关键词搜索笔记、标签、命令..."
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0))); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((prev) => Math.max(prev - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); handleSelect(activeIndex); }
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
              <p>尝试更换关键词，或者搜索笔记标题、标签、命令名称。</p>
            </div>
          ) : (
            <div className="search-results">
              {results.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`search-result${index === activeIndex ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(index)}
                >
                  <div className="search-result__top">
                    <div className="search-result__title-row">
                      <span className={`search-result__type search-result__type--${item.type}`}>{item.type === 'note' ? '笔记' : item.type === 'tag' ? '标签' : '命令'}</span>
                      <strong>{item.title}</strong>
                    </div>
                    <span className="search-result__time">{item.updatedAt}</span>
                  </div>
                  <p>{item.snippet}</p>
                  <div className="search-result__footer">
                    <span>{item.tag}</span>
                    <span>{index === activeIndex ? '回车打开' : '点击打开'}</span>
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
        <span className="icon">🔍</span>
        <span className="search-trigger__text">搜索笔记...</span>
        <span className="search-shortcut">⌘K</span>
      </button>
      {modal}
    </>
  );
}
