'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { notes as notesApi, notebooks as notebooksApi, ai as aiApi } from '@/lib/api-client';
import { RichTextEditor, type RichTextHandle } from '@/components/Editor/RichTextEditor';
import { AIToolbar } from '@/components/Editor/AIToolbar';
import type { NoteResponseItem, Notebook } from '@/lib/types';

type SaveState = 'saved' | 'saving' | 'unsaved';

export default function NoteEditorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [note, setNote] = useState<NoteResponseItem | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showProps, setShowProps] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSelectedText, setAiSelectedText] = useState('');
  const [aiToolbarVisible, setAiToolbarVisible] = useState(false);

  // Editor search state
  const [editorSearchQuery, setEditorSearchQuery] = useState('');
  const [showEditorSearch, setShowEditorSearch] = useState(false);

  const editorRef = useRef<RichTextHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const editorSearchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef(note?.content || '');

  // Keep contentRef in sync
  useEffect(() => { contentRef.current = note?.content || ''; }, [note?.content]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S — manual save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (note && saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          doSave({ content: editorRef.current?.getContent() || note.content });
        }
      }
      // Ctrl+F / Cmd+F — editor search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowEditorSearch(true);
        setTimeout(() => editorSearchRef.current?.focus(), 50);
      }
      // Ctrl+Shift+P / Cmd+Shift+P — show properties
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowProps(p => !p);
      }
      // Escape — close editor search
      if (e.key === 'Escape' && showEditorSearch) {
        setShowEditorSearch(false);
        setEditorSearchQuery('');
      }
      // Ctrl+Shift+L / Cmd+Shift+L — toggle dark mode (delegated to theme system)
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [note, showEditorSearch]);

  // Load note + notebooks
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    void Promise.all([
      notesApi.get(id),
      notebooksApi.list(),
    ]).then(([noteRes, nbRes]) => {
      if (noteRes.data) {
        setNote(noteRes.data);
        setTitle(noteRes.data.title);
        setLastSaved(new Date(noteRes.data.updatedAt));
      } else {
        setError(t('note.noteNotFound'));
      }
      if (nbRes.data) setNotebooks(nbRes.data);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load note');
      setLoading(false);
    });
  }, [id, t]);

  const doSave = useCallback(async (updates: Record<string, unknown>) => {
    if (!note) return;
    setSaveState('saving');
    try {
      const res = await notesApi.update(note.id, updates);
      if (res.data) setNote(res.data);
      setSaveState('saved');
      setLastSaved(new Date());
    } catch {
      setSaveState('unsaved');
    }
  }, [note]);

  const scheduleSave = useCallback((updates: Record<string, unknown>) => {
    if (!note) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState('unsaved');
    saveTimerRef.current = setTimeout(() => doSave(updates), 800);
  }, [note, doSave]);

  const handleContentChange = useCallback((content: string) => {
    scheduleSave({ content });
  }, [scheduleSave]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    scheduleSave({ title: newTitle });
  }, [scheduleSave]);

  const handleTogglePin = () => {
    if (!note) return;
    const next = !note.isPinned;
    setNote({ ...note, isPinned: next });
    doSave({ isPinned: next });
  };

  const handleToggleFavorite = () => {
    if (!note) return;
    const next = !note.isFavorite;
    setNote({ ...note, isFavorite: next });
    doSave({ isFavorite: next });
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
    doSave({ tags: newTags });
  };

  const handleRemoveTag = (tag: string) => {
    if (!note) return;
    const newTags = (note.tags || []).filter((t) => t !== tag);
    setNote({ ...note, tags: newTags });
    doSave({ tags: newTags });
  };

  const handleDelete = async () => {
    if (!note || deleting) return;
    if (!window.confirm(t('common.delete') + '?')) return;
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

  // Selection listener for AI toolbar — detects text selection in the editor area
  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      // Only trigger if selection is inside the editor container
      const target = e.target instanceof Node ? e.target : null;
      if (target && !(target as Element)?.closest?.('.rich-editor-body, .rich-editor-wysiwyg')) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        setAiSelectedText(sel.toString().trim());
        setAiToolbarVisible(true);
      }
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, []);

  // Hide AI toolbar when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target instanceof Node ? e.target : null;
      if (target && !(target as Element)?.closest?.('.ai-toolbar, .rich-editor-body')) {
        // Don't hide immediately — let the user interact
      }
    };
    return () => {};
  }, []);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  if (loading) return <div className="empty-state"><p>{t('common.loading')}</p></div>;
  if (error || !note) return (
    <div className="empty-state">
      <h3>{error || t('note.noteNotFound')}</h3>
      <Link href="/notes" style={{ color: 'var(--accent)', marginTop: 12, display: 'inline-block' }}>{t('common.back')}</Link>
    </div>
  );

  const currentNotebook = notebooks.find((nb) => nb.id === note.notebookId);

  return (
    <div className="editor-container">
      {/* Top bar: back + save status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        <Link href="/notes" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← {t('common.back')}</Link>
        <span style={{ flex: 1 }} />
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          color: saveState === 'saved' ? 'var(--good)' : saveState === 'saving' ? 'var(--accent)' : '#ff6b6b',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {saveState === 'saved'
            ? (lastSaved ? `${t('editor.saveStatus_saved')} ${lastSaved.toLocaleTimeString()}` : t('editor.saveStatus_saved'))
            : saveState === 'saving' ? t('editor.saveStatus_saving') : t('editor.saveStatus_unsaved')}
        </span>
        {/* Editor search toggle */}
        <button className="ghost-btn" onClick={() => setShowEditorSearch(p => !p)}
          style={{ padding: '4px 8px', fontSize: 11 }}
          title={t('search.triggerText')}>
          🔍
        </button>
      </div>

      {/* Editor search bar */}
      {showEditorSearch && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input ref={editorSearchRef} value={editorSearchQuery}
            onChange={e => setEditorSearchQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            style={{ flex: 1, padding: '6px 12px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--panel)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
          />
          <button className="ghost-btn" onClick={() => setEditorSearchQuery('')} style={{ padding: '4px 8px', fontSize: 11 }}>{t('common.clear')}</button>
          <button className="ghost-btn" onClick={() => setShowEditorSearch(false)} style={{ padding: '4px 8px', fontSize: 11 }}>✕</button>
        </div>
      )}

      {/* Title + actions */}
      <div className="editor-header">
        <input ref={titleRef} value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t('noteModal.titlePlaceholder')}
        />
        <button className={`ghost-btn${note.isPinned ? ' active' : ''}`}
          onClick={handleTogglePin}
          style={note.isPinned ? { background: 'var(--accent)', color: '#fff' } : {}}
          title={t('note.pin')}>
          📌
        </button>
        <button className={`ghost-btn${note.isFavorite ? ' active' : ''}`}
          onClick={handleToggleFavorite}
          style={note.isFavorite ? { background: 'var(--accent)', color: '#fff' } : {}}
          title={t('note.favorite')}>
          ⭐
        </button>
        <button className="ghost-btn" onClick={() => setShowProps(!showProps)}
          title={t('note.properties')}>
          ℹ
        </button>
        <button className="ghost-btn" onClick={handleDelete} disabled={deleting} style={{ color: '#ff6b6b' }}>
          {deleting ? '...' : t('common.delete')}
        </button>
      </div>

      {/* Properties panel */}
      {showProps && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8,
          padding: 16, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t('noteModal.notebookLabel')}: </span>
            <select value={note.notebookId || ''} onChange={(e) => handleNotebookChange(e.target.value)}
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 8px' }}>
              <option value="">{t('common.none')}</option>
              {notebooks.map((nb) => <option key={nb.id} value={nb.id}>{nb.icon} {nb.name}</option>)}
            </select>
          </div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.wordCount')}: </span>{note.wordCount || 0}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.createdAt')}: </span>{new Date(note.createdAt).toLocaleString()}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.updatedAt')}: </span>{new Date(note.updatedAt).toLocaleString()}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>{t('note.version')}: </span>v{note.version}</div>
        </div>
      )}

      {/* Tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {(note.tags || []).map((tag) => (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', background: 'var(--panel-2)', border: '1px solid var(--line)',
            borderRadius: 12, fontSize: 12, color: 'var(--text-soft)'
          }}>
            #{tag}
            <button onClick={() => handleRemoveTag(tag)}
              style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>
              ×
            </button>
          </span>
        ))}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
            placeholder={t('tag.inputPlaceholder')}
            style={{
              padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4,
              background: 'var(--panel)', color: 'var(--text)', fontSize: 12, width: 100, outline: 'none'
            }}
          />
          <button className="ghost-btn" onClick={handleAddTag} style={{ padding: '2px 8px', fontSize: 11 }}>+</button>
        </div>
      </div>

      {/* AI Toolbar + Editor */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <RichTextEditor
          ref={editorRef}
          initialContent={note.content || ''}
          onChange={handleContentChange}
          placeholderText={t('noteModal.contentPlaceholder')}
          editorSearchQuery={showEditorSearch ? editorSearchQuery : undefined}
        />
      </div>

      {/* Editor status bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--line)', marginTop: 8
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>{note.wordCount || 0} {t('editor.words')}</span>
          <span>{note.content?.split('\n').length || 0} {t('editor.lines')}</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {currentNotebook && <span>{currentNotebook.icon || '📓'} {currentNotebook.name}</span>}
          <span>{new Date(note.updatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
