'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { notes as notesApi } from '@/lib/api-client';
import { RichTextEditor, type RichTextHandle } from '@/components/Editor/RichTextEditor';
import type { NoteResponseItem } from '@/lib/types';
import Link from 'next/link';

export default function NoteEditorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [note, setNote] = useState<NoteResponseItem | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<RichTextHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void notesApi.get(id).then(r => {
      if (r.data) {
        setNote(r.data);
        setTitle(r.data.title);
      }
      setLoading(false);
    });
  }, [id]);

  const handleContentChange = (content: string) => {
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaving(true);
      void notesApi.update(note.id, { content }).then(() => setSaving(false));
    }, 1500);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaving(true);
      void notesApi.update(note.id, { title: newTitle }).then(() => setSaving(false));
    }, 1500);
  };

  const handleDelete = async () => {
    if (!note || !window.confirm(t('note.deleteConfirm'))) return;
    await notesApi.delete(note.id);
    router.push('/notes');
  };

  if (loading) return <div className="empty-state"><p>{t('common.loading')}</p></div>;
  if (!note) return <div className="empty-state"><h3>{t('note.noteNotFound')}</h3><Link href="/notes">{t('common.back')}</Link></div>;

  return (
    <div className="editor-container">
      <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <Link href="/notes" style={{ color: 'var(--text-muted)' }}>← {t('common.back')}</Link>
        {saving && <span style={{ marginLeft: 12 }}>{t('note.saving')}</span>}
      </div>
      <div className="editor-header">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t('noteModal.titlePlaceholder')}
        />
        <button className="ghost-btn" onClick={handleDelete} style={{ color: '#ff6b6b' }}>
          {t('common.delete')}
        </button>
      </div>
      <RichTextEditor
        ref={editorRef}
        initialContent={note.content || ''}
        onChange={handleContentChange}
        placeholderText={t('noteModal.contentPlaceholder')}
      />
    </div>
  );
}
