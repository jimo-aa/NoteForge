'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { notes as notesApi } from '@/lib/api-client';

export default function NewNotePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const res = await notesApi.create({ title: title.trim(), content });
    setCreating(false);
    if (res.data) router.push(`/notes/${res.data.id}`);
  };

  return (
    <div className="editor-container">
      <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <button className="ghost-btn" onClick={() => router.push('/notes')}>← {t('common.back')}</button>
      </div>
      <div className="editor-header">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('noteModal.titlePlaceholder')}
          autoFocus
        />
        <button
          className="primary-btn"
          style={{ width: 'auto', padding: '8px 20px' }}
          onClick={handleCreate}
          disabled={creating || !title.trim()}
        >
          {creating ? t('noteModal.creating') : t('noteModal.createNote')}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('noteModal.contentPlaceholder')}
        style={{
          flex: 1, padding: 16, border: '1px solid var(--line)', borderRadius: 8,
          background: 'var(--panel)', color: 'var(--text)', fontSize: 15,
          resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.7,
        }}
      />
    </div>
  );
}
