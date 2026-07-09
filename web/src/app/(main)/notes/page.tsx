'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { notes as notesApi, notebooks as notebooksApi } from '@/lib/api-client';
import { useNotebookStore } from '@/stores/useNotebookStore';
import type { NoteResponseItem, Notebook } from '@/lib/types';

const PAGE_SIZE = 30;

export default function NotesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tags } = useNotebookStore();

  const [noteList, setNoteList] = useState<NoteResponseItem[]>([]);
  const [notebookList, setNotebookList] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read filters from URL query params
  const notebookFilter = searchParams.get('notebook') || 'all';
  const tagFilter = searchParams.get('tag') || null;
  const favoritesFilter = searchParams.get('favorites') === 'true';

  const loadNotes = useCallback(async (pageNum: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [noteRes, nbRes] = await Promise.all([
        notesApi.list(),
        notebooksApi.list(),
      ]);
      if (nbRes.data) setNotebookList(nbRes.data);
      if (noteRes.data) {
        let filtered = noteRes.data;
        // Notebook filter
        if (notebookFilter !== 'all') filtered = filtered.filter(n => n.notebookId === notebookFilter);
        // Tag filter
        if (tagFilter) filtered = filtered.filter(n => n.tags?.includes(tagFilter));
        // Favorites filter
        if (favoritesFilter) filtered = filtered.filter(n => n.isFavorite);

        // Sort by updatedAt desc
        filtered.sort((a, b) => b.updatedAt - a.updatedAt);

        if (append) {
          setNoteList(prev => [...prev, ...filtered]);
        } else {
          setNoteList(filtered);
        }
        setHasMore(filtered.length > (pageNum + 1) * PAGE_SIZE);
        setPage(pageNum);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [notebookFilter, tagFilter, favoritesFilter]);

  useEffect(() => {
    setNoteList([]);
    loadNotes(0, false);
  }, [loadNotes]);

  const handleCreateNotebook = async () => {
    const { createNotebook } = useNotebookStore.getState();
    const name = prompt(t('notebook.namePlaceholderCreate'));
    if (name?.trim()) await createNotebook(name.trim());
  };

  const noteCount = noteList.length;
  const currentNotebook = notebookFilter !== 'all' ? notebookList.find(nb => nb.id === notebookFilter) : null;

  return (
    <div>
      {/* Header */}
      <div className="note-list-header">
        <div>
          <h2>
            {favoritesFilter
              ? `⭐ ${t('sidebarExtra.filterFavorites')}`
              : currentNotebook
                ? `${currentNotebook.icon || '📓'} ${currentNotebook.name}`
                : tagFilter
                  ? `#${tagFilter}`
                  : t('sidebar.recentNotes')}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('noteList.resultCount', { count: noteCount })}
          </span>
        </div>
        <button className="primary-btn" style={{ width: 'auto', padding: '8px 20px' }}
          onClick={() => router.push('/notes/new')}>
          + {t('noteModal.createNote')}
        </button>
      </div>

      {/* Filter bar */}
      {notebookList.length > 0 && !favoritesFilter && !tagFilter && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`ghost-btn ${notebookFilter === 'all' ? 'active' : ''}`}
            onClick={() => router.push('/notes')}
            style={notebookFilter === 'all' ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
            {t('sidebarExtra.filterAll')}
          </button>
          <span style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />
          {notebookList.slice(0, 8).map(nb => (
            <button key={nb.id} className="ghost-btn"
              onClick={() => router.push(`/notes?notebook=${nb.id}`)}
              style={notebookFilter === nb.id ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
              {nb.icon || '📓'} {nb.name}
            </button>
          ))}
          <button className="ghost-btn" onClick={handleCreateNotebook} style={{ fontSize: 12 }}>
            + {t('manage.tabNotebooks')}
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="empty-state">
          <h3>{t('common.error')}</h3>
          <p>{error}</p>
          <button className="primary-btn" style={{ width: 'auto', marginTop: 12, padding: '8px 24px' }}
            onClick={() => loadNotes(0, false)}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && noteList.length === 0 && (
        <div className="empty-state">
          <p>{t('common.loading')}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && noteList.length === 0 && (
        <div className="empty-state">
          <h3>{t('noteList.emptyTitle')}</h3>
          <p>{t('noteList.emptyDesc')}</p>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>{t('noteList.emptyHint')}</p>
          <button className="primary-btn" style={{ width: 'auto', marginTop: 16, padding: '8px 24px' }}
            onClick={() => router.push('/notes/new')}>
            + {t('noteModal.createNote')}
          </button>
        </div>
      )}

      {/* Note grid */}
      {noteList.length > 0 && (
        <>
          <div className="note-grid">
            {noteList.map((note) => (
              <div key={note.id} className="note-card"
                onClick={() => router.push(`/notes/${note.id}`)}
                style={{ borderLeft: note.isPinned ? '3px solid var(--accent)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
                    {note.title || t('noteModal.unnamedNote')}
                  </h3>
                  <span style={{ fontSize: 11 }}>
                    {note.isPinned ? '📌' : note.isFavorite ? '⭐' : ''}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {note.contentPlain?.slice(0, 150) || note.content?.slice(0, 150) || ''}
                </p>
                <div className="note-card-meta">
                  <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  {note.tags?.length > 0 && <span>#{note.tags.slice(0, 3).join(' #')}</span>}
                  <span>{note.wordCount} {t('editor.words')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <button className="ghost-btn" onClick={() => loadNotes(page + 1, true)} disabled={loading}>
                {loading ? t('common.loading') : t('search.pagination', { current: page + 2, total: '...', count: 0 })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
