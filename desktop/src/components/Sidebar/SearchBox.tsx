import { useEffect, useRef } from 'react';
import { useStore } from '@/stores/context';

export function SearchBox() {
  const store = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (window as any).__focusSearch = () => inputRef.current?.focus();
    return () => { delete (window as any).__focusSearch; };
  }, []);

  return (
    <div className="search-box">
      <span className="icon">🔍</span>
      <input
        ref={inputRef}
        type="text"
        placeholder="搜索笔记..."
        value={store.searchQuery}
        onChange={e => store.setSearchQuery(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && (e.target as HTMLInputElement).blur()}
      />
      <span className="search-shortcut">⌘K</span>
    </div>
  );
}
