import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteStore } from '@/stores/useNoteStore';
import { tauriInvoke } from '@/utils/invoke';
import { searchCache } from '@/utils/searchCache';
import * as aiService from '@/services/aiService';

// ── Types ──

export type SearchResult = {
  note_id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: number;
  total_hits: number;
  snippetHighlights?: { text: string; highlights: { start: number; end: number }[] };
};

export type SearchPage = {
  results: SearchResult[];
  total_hits: number;
};

export type SearchResultItem = {
  id: string;
  title: string;
  snippet: string;
  score: number;
  updatedAt: string;
  noteId?: string;
  tags?: string[];
  notebookName?: string;
  highlightSpans?: { start: number; end: number }[];
};

export interface SearchDirective {
  kind: 'tag' | 'notebook' | 'pinned' | 'favorite';
  raw: string;
  value: string;
}

export interface UseSearchReturn {
  open: boolean;
  query: string;
  setQuery: (q: string) => void;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  results: SearchResultItem[];
  loading: boolean;
  highlightedId: string | null;
  currentPage: number;
  totalResults: number;
  fuzzyFallback: boolean;
  showHistory: boolean;
  searchHistory: string[];
  searchMode: 'fulltext' | 'semantic' | 'hybrid';
  directives: { textOnly: string; directives: SearchDirective[] };
  textQuery: string;
  totalPages: number;
  currentPageNum: number;
  pageSize: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setSearchMode: (mode: 'fulltext' | 'semantic' | 'hybrid') => void;
  close: () => void;
  openSearch: () => void;
  loadPage: (pageNum: number) => Promise<void>;
  handleSelect: (index: number) => Promise<void>;
  handleHistorySelect: (q: string) => void;
  clearHistory: () => void;
  removeFilterChip: (d: SearchDirective) => void;
}

// ── Constants ──

const HISTORY_KEY = 'noteforge:search:history';
const MAX_HISTORY = 10;
const PAGE_SIZE = 5;

// ── Helpers ──

function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

function pushHistory(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const prev = loadHistory().filter((q) => q !== trimmed);
  saveHistory([trimmed, ...prev]);
}

/**
 * Parse search directives from query; returns { textOnly, directives }.
 *
 * Supported syntax:
 *   tag:xxx          — filter by tag
 *   notebook:xxx     — filter by notebook name
 *   is:pinned        — show only pinned notes
 *   is:favorite/fav  — show only favorited notes
 *   title:xxx        — search only in title field
 *   "quoted phrase"  — exact phrase match (preserved as-is, not tokenized)
 *   -tag:xxx         — exclude tag
 */
export function parseDirectives(raw: string): { textOnly: string; directives: SearchDirective[] } {
  const dirs: SearchDirective[] = [];
  const parts: string[] = [];

  // Handle quoted phrases: extract them first and rejoin later
  let remaining = raw;
  const quotedPhrases: string[] = [];
  const quoteRegex = /"([^"]+)"/g;
  let quoteMatch: RegExpExecArray | null;
  while ((quoteMatch = quoteRegex.exec(raw)) !== null) {
    if (quoteMatch[1]) quotedPhrases.push(quoteMatch[1]);
  }
  // Remove quoted parts from the raw text for token parsing
  remaining = raw.replace(/"([^"]+)"/g, '').trim();

  // Parse tokens from the unquoted remainder
  for (const token of remaining.split(/\s+/)) {
    if (!token) continue;

    // Exclude directive: -tag:xxx -notebook:xxx
    const excludeMatch = token.match(/^-(tag|notebook):(\S+)$/i);
    if (excludeMatch?.[1] && excludeMatch[2]) {
      const kind = excludeMatch[1].toLowerCase() as 'tag' | 'notebook';
      dirs.push({ kind, raw: token, value: `-${excludeMatch[2]}` });
      continue;
    }

    const tagMatch = token.match(/^tag:(\S+)$/i);
    if (tagMatch?.[1]) {
      dirs.push({ kind: 'tag', raw: token, value: tagMatch[1] });
      continue;
    }
    const nbMatch = token.match(/^notebook:(\S+)$/i);
    if (nbMatch?.[1]) {
      dirs.push({ kind: 'notebook', raw: token, value: nbMatch[1] });
      continue;
    }
    const titleMatch = token.match(/^title:(\S+)$/i);
    if (titleMatch?.[1]) {
      // title: prefix alters query but doesn't create a UI chip
      // It works by prepending a field-specific search term
      parts.push(`title:${titleMatch[1]}`);
      continue;
    }
    const isMatch = token.match(/^is:(\S+)$/i);
    if (isMatch?.[1]) {
      const val = isMatch[1].toLowerCase();
      if (val === 'pinned') {
        dirs.push({ kind: 'pinned', raw: token, value: 'pinned' });
        continue;
      }
      if (val === 'favorite' || val === 'fav') {
        dirs.push({ kind: 'favorite', raw: token, value: 'favorite' });
        continue;
      }
    }
    parts.push(token);
  }

  // Append quoted phrases as exact-match tokens
  for (const phrase of quotedPhrases) {
    parts.push(`"${phrase}"`);
  }

  return { textOnly: parts.join(' ').trim(), directives: dirs };
}

// ── Hook ──

export function useSearch(): UseSearchReturn {
  const store = useNoteStore();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [fuzzyFallback, setFuzzyFallback] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadHistory());
  const [searchMode, setSearchMode] = useState<'fulltext' | 'semantic' | 'hybrid'>('fulltext');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchVersionRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const pageSize = PAGE_SIZE;

  const directives = useMemo(() => parseDirectives(query), [query]);
  const textQuery = directives.textOnly;

  const totalPages = totalResults > 0 ? Math.ceil(totalResults / pageSize) : 0;
  const currentPageNum = currentPage + 1;

  // ── Actions ──

  const close = useCallback(() => {
    setOpen(false);
    setShowHistory(false);
  }, []);

  const openSearch = useCallback(() => {
    setQuery('');
    setActiveIndex(0);
    setResults([]);
    setTotalResults(0);
    setFuzzyFallback(false);
    setShowHistory(true);
    setSearchHistory(loadHistory());
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const removeDirective = useCallback((kind: SearchDirective['kind']) => {
    switch (kind) {
      case 'tag': break;
      case 'notebook': store.setActiveNotebook('all'); break;
      case 'pinned': store.setCurrentFilter('all'); break;
      case 'favorite': store.setCurrentFilter('all'); break;
    }
  }, [store]);

  const loadPage = useCallback(async (pageNum: number) => {
    const useQuery = textQuery || query;
    if (!useQuery) return;

    try {
      setLoading(true);
      if (searchMode !== 'fulltext') {
        // Semantic or hybrid pagination via ai-service
        const semResult = await aiService.semanticSearch(useQuery, searchMode, pageSize, pageNum * pageSize);
        if (semResult && semResult.results.length > 0) {
          setResults(
            semResult.results.map((hit) => ({
              id: hit.noteId,
              title: hit.title,
              snippet: hit.snippet || t('search.noPreview'),
              score: hit.score,
              updatedAt: '',
              noteId: hit.noteId,
            }))
          );
          setTotalResults(semResult.total);
          setCurrentPage(pageNum);
          setActiveIndex(0);
        }
      } else {
        // Full-text pagination via Tauri
        const page = await tauriInvoke<SearchPage>('search_notes_advanced', {
          query: useQuery,
          limit: pageSize,
          offset: pageNum * pageSize,
        });

        if (page && page.results.length > 0) {
          setResults(
            page.results.map((hit: SearchResult) => ({
              id: hit.note_id,
              title: hit.title,
              snippet: hit.snippet || t('search.noPreview'),
              score: hit.score,
              updatedAt: new Date(hit.updated_at).toLocaleString(),
              noteId: hit.note_id,
            }))
          );
          setTotalResults(page.total_hits);
          setCurrentPage(pageNum);
          setActiveIndex(0);

          // Prefetch next page in background
          const nextPage = pageNum + 1;
          if (nextPage * pageSize < page.total_hits) {
            const cacheKey = 'adv';
            if (!searchCache.has(cacheKey, useQuery, nextPage)) {
              tauriInvoke<SearchPage>('search_notes_advanced', {
                query: useQuery,
                limit: pageSize,
                offset: nextPage * pageSize,
              }).then((nextPageData) => {
                if (nextPageData) {
                  searchCache.prefetch(cacheKey, useQuery, nextPage, nextPageData);
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Page load error:', error);
    } finally {
      setLoading(false);
    }
  }, [textQuery, query, pageSize, searchMode, t]);

  const handleSelect = useCallback(async (index: number) => {
    const item = results[index];
    if (!item?.noteId) return;

    pushHistory(textQuery || query);
    setSearchHistory(loadHistory());

    setHighlightedId(item.noteId);
    store.selectNote(item.noteId);
    close();

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedId(null);
    }, 2000);
  }, [results, textQuery, query, store, close]);

  const handleHistorySelect = useCallback((q: string) => {
    setQuery(q);
    setShowHistory(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }, []);

  const clearHistory = useCallback(() => {
    saveHistory([]);
    setSearchHistory([]);
  }, []);

  const removeFilterChip = useCallback((d: SearchDirective) => {
    const parts = query.split(/\s+/).filter((t) => t !== d.raw);
    setQuery(parts.join(' ').trim());
    removeDirective(d.kind);
  }, [query, removeDirective]);

  // ── Effects ──

  // Main search effect
  useEffect(() => {
    if (!open || !query) {
      if (results.length > 0 || currentPage !== 0 || totalResults !== 0 || fuzzyFallback) {
        setResults([]);
        setCurrentPage(0);
        setTotalResults(0);
        setFuzzyFallback(false);
      }
      return;
    }

    // Apply directives to store as side-effect
    if (directives.directives.length > 0) {
      const applyDirectives = (dirs: SearchDirective[]) => {
        for (const d of dirs) {
          switch (d.kind) {
            case 'tag': {
              if (store.tags.includes(d.value)) {
                store.setActiveTags((prev: string[]) =>
                  prev.includes(d.value) ? prev : [...prev, d.value],
                );
              }
              break;
            }
            case 'notebook': {
              const found = store.notebooks.find(
                (nb: { name: string }) => nb.name.toLowerCase() === d.value.toLowerCase(),
              );
              if (found) store.setActiveNotebook(found.id);
              break;
            }
            case 'pinned':
              store.setCurrentFilter('pinned');
              break;
            case 'favorite':
              store.setCurrentFilter('favorites');
              break;
          }
        }
      };
      applyDirectives(directives.directives);
    }

    // If no text query after stripping directives, skip backend search
    if (!textQuery) {
      setResults([]);
      setTotalResults(0);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      const currentVersion = ++searchVersionRef.current;
      setLoading(true);
      setFuzzyFallback(false);
      const t0 = performance.now();

      const mapAdvanced = (hit: SearchResult) => ({
        id: hit.note_id,
        title: hit.title,
        snippet: hit.snippet || t('search.noPreview'),
        score: hit.score,
        updatedAt: new Date(hit.updated_at).toLocaleString(),
        noteId: hit.note_id,
        highlightSpans: hit.snippetHighlights?.highlights,
      });

      const mapSemantic = (hit: { noteId: string; title: string; snippet: string; score: number }) => ({
        id: hit.noteId,
        title: hit.title,
        snippet: hit.snippet || t('search.noPreview'),
        score: hit.score,
        updatedAt: '',
        noteId: hit.noteId,
      });

      try {
        if (searchMode !== 'fulltext') {
          const semResult = await aiService.semanticSearch(textQuery, searchMode, pageSize, 0);
          if (semResult && semResult.results.length > 0) {
            setTotalResults(semResult.total);
            setResults(
              semResult.results.map((hit) => ({
                id: hit.noteId,
                title: hit.title,
                snippet: hit.snippet || t('search.noPreview'),
                score: hit.score,
                updatedAt: '',
                noteId: hit.noteId,
              }))
            );
            setCurrentPage(0);
            setFuzzyFallback(false);
          } else {
            setResults([]);
            setTotalResults(0);
          }
        } else {
          // Parallel full-text + fuzzy search (T9-B2)
          const [advResult, fuzzyResult] = await Promise.allSettled([
            tauriInvoke<SearchPage>('search_notes_advanced', { query: textQuery, limit: pageSize, offset: 0 }),
            tauriInvoke<SearchResult[]>('search_notes_fuzzy', { query: textQuery }),
          ]);

          if (currentVersion !== searchVersionRef.current) return; // stale response

          const advOk = advResult.status === 'fulfilled' && advResult.value && advResult.value.results.length > 0;
          const fuzzyOk = fuzzyResult.status === 'fulfilled' && fuzzyResult.value && fuzzyResult.value.length > 0;

          if (advOk) {
            const page = (advResult as PromiseFulfilledResult<SearchPage>).value;
            searchCache.set('adv', textQuery, 0, page);
            setTotalResults(page.total_hits);
            setResults(page.results.map(mapAdvanced));
            setCurrentPage(0);
            setFuzzyFallback(false);
          } else if (fuzzyOk) {
            const fuzzyResults = (fuzzyResult as PromiseFulfilledResult<SearchResult[]>).value;
            setTotalResults(fuzzyResults.length);
            setResults(fuzzyResults.slice(0, pageSize).map(mapAdvanced));
            setFuzzyFallback(true);
          } else {
            setResults([]);
            setTotalResults(0);
          }
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setTotalResults(0);
      } finally {
        const elapsed = performance.now() - t0;
        if (elapsed > 100) {
          console.debug(`[Perf] search "${textQuery}" took ${elapsed.toFixed(0)}ms`);
        }
        setLoading(false);
        setActiveIndex(0);
      }
    }, 50); // Reduced from 200ms to 50ms for faster first-result appearance

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, textQuery, searchMode, directives.directives]);

  // noteforge:open-search event
  useEffect(() => {
    const handler = () => openSearch();
    window.addEventListener('noteforge:open-search', handler);
    return () => window.removeEventListener('noteforge:open-search', handler);
  }, [openSearch]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, close]);

  // Cleanup highlight timeout
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  return {
    open,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    results,
    loading,
    highlightedId,
    currentPage,
    totalResults,
    fuzzyFallback,
    showHistory,
    searchHistory,
    searchMode,
    directives,
    textQuery,
    totalPages,
    currentPageNum,
    pageSize,
    inputRef,
    setSearchMode,
    close,
    openSearch,
    loadPage,
    handleSelect,
    handleHistorySelect,
    clearHistory,
    removeFilterChip,
  };
}
