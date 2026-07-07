// NoteForge — AI Service unit tests (SSE stream parsing, error handling)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage token
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => {
    if (key === 'noteforge:api:gateway-url') return null;
    if (key === 'noteforge:auth:access-token') return JSON.stringify('test-token');
    return null;
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

describe('aiService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('suggestTags returns empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'));
    const { suggestTags } = await import('../aiService');
    const result = await suggestTags('title', 'content');
    expect(result).toEqual([]);
  });

  it('suggestTags returns empty array on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const { suggestTags } = await import('../aiService');
    const result = await suggestTags('title', 'content');
    expect(result).toEqual([]);
  });

  it('suggestTags parses tags from response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ code: 0, data: { tags: ['rust', 'testing'] } }),
    });
    const { suggestTags } = await import('../aiService');
    const result = await suggestTags('My Note', 'some content');
    expect(result).toEqual(['rust', 'testing']);
  });

  it('semanticSearch returns null on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'));
    const { semanticSearch } = await import('../aiService');
    const result = await semanticSearch('test');
    expect(result).toBeNull();
  });

  it('semanticSearch returns parsed results on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        code: 0,
        data: { results: [{ noteId: 'n1', title: 'Test', snippet: '...', score: 0.95 }], total: 1 },
      }),
    });
    const { semanticSearch } = await import('../aiService');
    const result = await semanticSearch('test');
    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(1);
    expect(result!.results[0]!.title).toBe('Test');
  });

  it('continueText handles HTTP error gracefully', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const { continueText } = await import('../aiService');
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await continueText('test', undefined, { onDelta, onDone, onError });

    expect(onError).toHaveBeenCalled();
    expect(onDelta).not.toHaveBeenCalled();
  });
});
