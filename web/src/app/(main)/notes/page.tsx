'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { notes as notesApi, notebooks as notebooksApi, tags as tagsApi } from '@/lib/api-client';
import type { NoteResponseItem, Notebook } from '@/lib/types';

export default function NotesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [noteList, setNoteList] = useState<NoteResponseItem[]>([]);
  const [notebookList, setNotebookList] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    void Promise.all([
      notesApi.list().then(r => { if (r.data) setNoteList(r.data); }),
      notebooksApi.list().then(r => { if (r.data) setNotebookList(r.data); }),
    ]).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? noteList : noteList.filter(n => n.notebookId === filter);
  const currentNotebook = notebookList.find(nb => nb.id === filter);

  return (
    <div>
      <div className="note-list-header">
        <h2>{currentNotebook ? `${currentNotebook.icon} ${currentNotebook.name}` : t('sidebar.recentNotes')}</h2>
        <button className="primary-btn" style={{ width: 'auto', padding: '8px 20px' }} onClick={() => router.push('/notes/new')}>
          + {t('noteModal.createNote')}
        </button>
      </div>

      {notebookList.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className={`ghost-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}
            style={filter === 'all' ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
            {t('sidebarExtra.filterAll')}
          </button>
          {notebookList.map(nb => (
            <button key={nb.id} className="ghost-btn" onClick={() => setFilter(nb.id)}
              style={filter === nb.id ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}>
              {nb.icon} {nb.name}
            </button>
          ))}
        </div>
      )}

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
            <div key={note.id} className="note-card" onClick={() => router.push(`/notes/${note.id}`)}>
              <h3>{note.title || t('noteModal.unnamedNote')}</h3>
              <p>{note.contentPlain?.slice(0, 120) || note.content?.slice(0, 120) || ''}</p>
              <div className="note-card-meta">
                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                {note.tags?.length > 0 && <span>#{note.tags[0]}</span>}
                <span>{note.wordCount} {t('editor.words')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
