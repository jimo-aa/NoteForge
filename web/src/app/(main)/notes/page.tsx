'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { notes as notesApi, notebooks as notebooksApi } from '@/lib/api-client';
import type { NoteResponseItem, Notebook } from '@/lib/types';

export default function NotesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [noteList, setNoteList] = useState<NoteResponseItem[]>([]);
  const [notebookList, setNotebookList] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    void Promise.all([
      notesApi.list(),
      notebooksApi.list(),
    ]).then(([noteRes, nbRes]) => {
      if (noteRes.data) setNoteList(noteRes.data);
      if (nbRes.data) setNotebookList(nbRes.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateNotebook = async () => {
    if (!newNbName.trim()) return;
    await notebooksApi.create({ name: newNbName.trim() });
    setNewNbName('');
    setShowNotebookModal(false);
    loadData();
  };

  const handleDeleteNotebook = async (id: string) => {
    if (!window.confirm(t('manage.confirmDeleteNotebookMsg'))) return;
    await notebooksApi.delete(id);
    loadData();
  };

  const filtered = noteList
    .filter(n => showFavorites ? n.isFavorite : true)
    .filter(n => filter === 'all' ? true : n.notebookId === filter);
  const currentNotebook = notebookList.find(nb => nb.id === filter);

  return (
    <div>
      <div className="note-list-header">
        <div>
          <h2>{currentNotebook ? `${currentNotebook.icon || '📓'} ${currentNotebook.name}` : (showFavorites ? '⭐ ' + t('sidebarExtra.filterFavorites') : t('sidebar.recentNotes'))}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} {t('sidebarExtra.notesCount', { count: filtered.length })}</span>
        </div>
        <button className="primary-btn" style={{ width: 'auto', padding: '8px 20px' }} onClick={() => router.push('/notes/new')}>
          + {t('noteModal.createNote')}
        </button>
      </div>

      {/* Filter bar */}
      {notebookList.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`ghost-btn ${filter === 'all' && !showFavorites ? 'active' : ''}`} onClick={() => { setFilter('all'); setShowFavorites(false); }}
            style={filter === 'all' && !showFavorites ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
            {t('sidebarExtra.filterAll')}
          </button>
          <button className={`ghost-btn ${showFavorites ? 'active' : ''}`} onClick={() => { setShowFavorites(!showFavorites); setFilter('all'); }}
            style={showFavorites ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
            ⭐ {t('sidebarExtra.filterFavorites')}
          </button>
          <span style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />
          {notebookList.map(nb => (
            <div key={nb.id} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <button className="ghost-btn" onClick={() => { setFilter(nb.id); setShowFavorites(false); }}
                style={filter === nb.id ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
                {nb.icon || '📓'} {nb.name} ({nb.noteCount})
              </button>
              {filter === nb.id && (
                <button onClick={() => handleDeleteNotebook(nb.id)}
                  style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
              )}
            </div>
          ))}
          <button className="ghost-btn" onClick={() => setShowNotebookModal(true)} style={{ fontSize: 12 }}>+ {t('manage.tabNotebooks')}</button>
        </div>
      )}

      {/* Notebook create modal */}
      {showNotebookModal && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <input value={newNbName} onChange={(e) => setNewNbName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNotebook(); }}
            placeholder={t('notebook.namePlaceholder')}
            autoFocus
            style={{ padding: '8px 12px', border: '1px solid var(--line-strong)', borderRadius: 8, background: 'var(--panel)', color: 'var(--text)', fontSize: 14, outline: 'none', flex: 1, maxWidth: 300 }}
          />
          <button className="primary-btn" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleCreateNotebook}>{t('common.create')}</button>
          <button className="ghost-btn" onClick={() => setShowNotebookModal(false)}>{t('common.cancel')}</button>
        </div>
      )}

      {/* Note list */}
      {loading ? (
        <div className="empty-state"><p>{t('common.loading')}</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{t('sidebar.noNotes')}</h3>
          <p>{t('note.selectNoteDesc')}</p>
        </div>
      ) : (
        <div className="note-grid">
          {filtered.map((note) => (
            <div key={note.id} className="note-card" onClick={() => router.push(`/notes/${note.id}`)}
              style={{ borderLeft: note.isPinned ? '3px solid var(--accent)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ flex: 1 }}>{note.title || t('noteModal.unnamedNote')}</h3>
                <span style={{ fontSize: 11 }}>{note.isPinned ? '📌' : note.isFavorite ? '⭐' : ''}</span>
              </div>
              <p>{note.contentPlain?.slice(0, 120) || note.content?.slice(0, 120) || ''}</p>
              <div className="note-card-meta">
                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                {note.tags?.length > 0 && <span>#{note.tags.slice(0, 2).join(' #')}</span>}
                <span>{note.wordCount} {t('editor.words')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
