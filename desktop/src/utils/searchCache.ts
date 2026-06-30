/**
 * NoteForge — 搜索结果缓存
 * 带 TTL 的 LRU 搜索缓存，减少重复 Tauri 调用
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  query: string;
}

const CACHE_TTL_MS = 30_000; // 30秒缓存
const MAX_ENTRIES = 50;

class SearchCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  private makeKey(prefix: string, query: string, page: number): string {
    return `${prefix}:${query.toLowerCase().trim()}:${page}`;
  }

  get<T>(prefix: string, query: string, page: number): T | null {
    const key = this.makeKey(prefix, query, page);
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(prefix: string, query: string, page: number, data: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= MAX_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTs) {
          oldestTs = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const key = this.makeKey(prefix, query, page);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      query: query.trim(),
    });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

export const searchCache = new SearchCache();
