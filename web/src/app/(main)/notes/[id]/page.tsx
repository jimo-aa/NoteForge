'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { notes as notesApi, notebooks as notebooksApi, ai as aiApi } from '@/lib/api-client';
import { RichTextEditor, type RichTextHandle } from '@/components/Editor/RichTextEditor';
import { AIToolbar } from '@/components/Editor/AIToolbar';
import type { NoteResponseItem, Notebook } from '@/lib/types';

export default function NoteEditorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [note, setNote] = useState<NoteResponseItem | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showProps, setShowProps] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [aiSelectedText, setAiSelectedText] = useState('');
  const [aiToolbarVisible, setAiToolbarVisible] = useState(false);
  const editorRef = useRef<RichTextHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note + notebooks
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void Promise.all([
      notesApi.get(id),
      notebooksApi.list(),
    ]).then(([noteRes, nbRes]) => {
      if (noteRes.data) { setNote(noteRes.data); setTitle(noteRes.data.title); }
      if (nbRes.data) setNotebooks(nbRes.data);
      setLoading(false);
    });
  }, [id]);

  const handleAiInsert = (content: string, mode: 'replace' | 'append' | 'insertBelow') => {
    if (!editorRef.current) return;
    if (mode === 'replace') {
      // Replace entire content for now (simplified)
      editorRef.current.setContent(content);
    } else {
      const current = editorRef.current.getContent();
      editorRef.current.setContent(current + '\n' + content);
    }
    setAiToolbarVisible(false);
  };

  const scheduleSave = (updates: Record<string, unknown>) => {
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(async () => {
      const res = await notesApi.update(note.id, updates);
      if (res.data) setNote(res.data);
      setSaving(false);
      setLastSaved(new Date());
    }, 800);
  };

  const handleContentChange = (content: string) => {
    scheduleSave({ content });
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    scheduleSave({ title: newTitle });
  };

  const handleTogglePin = () => {
    if (!note) return;
    const next = !note.isPinned;
    setNote({ ...note, isPinned: next });
    scheduleSave({ isPinned: next });
  };

  const handleToggleFavorite = () => {
    if (!note) return;
    const next = !note.isFavorite;
    setNote({ ...note, isFavorite: next });
    scheduleSave({ isFavorite: next });
  };

  const handleNotebookChange = (notebookId: string) => {
    if (!note) return;
    setNote({ ...note, notebookId });
    scheduleSave({ notebookId });
  };

  const handleAddTag = () => {
    if (!note || !tagInput.trim()) return;
    const newTags = [...(note.tags || []), tagInput.trim()];
    setNote({ ...note, tags: newTags });
    setTagInput('');
    scheduleSave({ tags: newTags });
  };

  const handleRemoveTag = (tag: string) => {
    if (!note) return;
    const newTags = (note.tags || []).filter((t) => t !== tag);
    setNote({ ...note, tags: newTags });
    scheduleSave({ tags: newTags });
  };

  const handleDelete = async () => {
    if (!note || deleting) return;
    setDeleting(true);
    await notesApi.delete(note.id);
    router.push('/notes');
  };

  // Auto-tag via AI on first load if note has no tags
  useEffect(() => {
    if (!note || note.tags?.length || !note.content) return;
    const timer = setTimeout(async () => {
      const res = await aiApi.tag(note.title, note.content);
      if (res.data?.tags?.length) {
        setNote((prev) => prev ? { ...prev, tags: res.data!.tags } : prev);
        void notesApi.update(note.id, { tags: res.data.tags });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="empty-state"><p>{t('common.loading')}</p></div>;
  if (!note) return <div className="empty-state"><h3>{t('note.noteNotFound')}</h3><Link href="/notes">{t('common.back')}</Link></div>;

  const meta = note;
  const currentNotebook = notebooks.find((nb) => nb.id === meta.notebookId);

  return (
    <div className="editor-container">
      {/* Toolbar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <Link href="/notes" style={{ color: 'var(--text-muted)' }}>← {t('common.back')}</Link>
        <span style={{ flex: 1 }} />
        {saving ? (
          <span style={{ color: 'var(--accent)' }}>{t('note.saving')}</span>
        ) : lastSaved ? (
          <span>{t('note.saved')} {lastSaved.toLocaleTimeString()}</span>
        ) : null}
      </div>

      {/* Title + actions */}
      <div className="editor-header">
        <input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder={t('noteModal.titlePlaceholder')} />
        <button className={`ghost-btn${meta.isPinned ? ' active' : ''}`} onClick={handleTogglePin}
          style={meta.isPinned ? { background: 'var(--accent)', color: '#fff' } : {}} title={t('note.pin')}>
          📌
        </button>
        <button className={`ghost-btn${meta.isFavorite ? ' active' : ''}`} onClick={handleToggleFavorite}
          style={meta.isFavorite ? { background: 'var(--accent)', color: '#fff' } : {}} title={t('note.favorite')}>
          ⭐
        </button>
        <button className="ghost-btn" onClick={() => setShowProps(!showProps)} title={t('note.properties')}>
          ℹ
        </button>
        <button className="ghost-btn" onClick={handleDelete} disabled={deleting} style={{ color: '#ff6b6b' }}>
          {deleting ? '...' : t('common.delete')}
        </button>
      </div>

      {/* Properties panel */}
      {showProps && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('noteModal.notebookLabel')}: </span>
            <select value={meta.notebookId || ''} onChange={(e) => handleNotebookChange(e.target.value)}
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 8px' }}>
              <option value="">{t('common.none')}</option>
              {notebooks.map((nb) => <option key={nb.id} value={nb.id}>{nb.icon} {nb.name}</option>)}
            </select>
          </div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.wordCount')}: </span>{meta.wordCount || 0}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.createdAt')}: </span>{new Date(meta.createdAt).toLocaleString()}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.updatedAt')}: </span>{new Date(meta.updatedAt).toLocaleString()}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.version')}: </span>v{meta.version}</div>
        </div>
      )}

      {/* Tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {(meta.tags || []).map((tag) => (
          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12, color: 'var(--text-soft)' }}>
            #{tag}
            <button onClick={() => handleRemoveTag(tag)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
            placeholder={t('tag.inputPlaceholder')}
            style={{ padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel)', color: 'var(--text)', fontSize: 12, width: 100, outline: 'none' }}
          />
          <button className="ghost-btn" onClick={handleAddTag} style={{ padding: '2px 8px', fontSize: 11 }}>+</button>
        </div>
      </div>

      {/* AI Toolbar */}
      <div style={{ position: 'relative' }}>
        <AIToolbar
          selectedText={aiSelectedText}
          noteContent={note.content}
          position={null}
          onInsert={handleAiInsert}
          visible={aiToolbarVisible}
          onClose={() => setAiToolbarVisible(false)}
        />
      </div>
      {/* Editor */}
      <RichTextEditor ref={editorRef} initialContent={note.content || ''} onChange={handleContentChange} placeholderText={t('noteModal.contentPlaceholder')} />
    </div>
  );
}
