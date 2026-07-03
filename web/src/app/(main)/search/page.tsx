'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { notes as notesApi } from '@/lib/api-client';
import type { NoteResponseItem } from '@/lib/types';

export default function SearchPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteResponseItem[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    const timer = setTimeout(async () => {
      const res = await notesApi.search(query);
      if (res.data) setResults(res.data);
      setSearched(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>{t('search.triggerText')}</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search.placeholder')}
        autoFocus
        style={{
          width: '100%', padding: '12px 16px', border: '1px solid var(--line-strong)', borderRadius: 8,
          background: 'var(--panel)', color: 'var(--text)', fontSize: 15, outline: 'none', marginBottom: 20,
        }}
      />
      {searched && results.length === 0 && (
        <div className="empty-state"><h3>{t('search.noResults')}</h3></div>
      )}
      <div className="note-grid">
        {results.map((note) => (
          <div key={note.id} className="note-card" onClick={() => router.push(`/notes/${note.id}`)}>
            <h3>{note.title}</h3>
            <p>{note.contentPlain?.slice(0, 200)}</p>
            <div className="note-card-meta">
              <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
