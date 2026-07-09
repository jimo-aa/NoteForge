'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotebookStore } from '@/stores/useNotebookStore';

/* ─── SyncIndicator ─── */
function SyncIndicator() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'online' | 'offline' | 'syncing'>('online');

  useEffect(() => {
    const onLine = () => setStatus('online');
    const offLine = () => setStatus('offline');
    window.addEventListener('online', onLine);
    window.addEventListener('offline', offLine);
    setStatus(navigator.onLine ? 'online' : 'offline');
    return () => { window.removeEventListener('online', onLine); window.removeEventListener('offline', offLine); };
  }, []);

  const color = status === 'online' ? 'var(--good)' : status === 'syncing' ? 'var(--accent)' : '#ff6b6b';
  const label = status === 'online' ? t('sync.online') : status === 'syncing' ? t('sync.syncing') : t('sync.offline');

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }} title={label}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

/* ─── Sidebar Notebook Section ─── */
function NotebookSection({ activeFilter, onFilterChange }: {
  activeFilter: string;
  onFilterChange: (notebookId: string | null) => void;
}) {
  const { t } = useTranslation();
  const { notebooks, loadNotebooks } = useNotebookStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [nbName, setNbName] = useState('');

  useEffect(() => { loadNotebooks(); }, [loadNotebooks]);

  const handleCreate = useCallback(async () => {
    if (!nbName.trim()) return;
    const { createNotebook } = useNotebookStore.getState();
    const nb = await createNotebook(nbName.trim());
    if (nb) { setNbName(''); setShowCreate(false); onFilterChange(nb.id); }
  }, [nbName, onFilterChange]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}>
          {collapsed ? '▶' : '▼'}
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('sidebar.notebooks')}</span>
        <button onClick={() => setShowCreate(!showCreate)} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }} title={t('notebook.create')}>+</button>
      </div>
      {!collapsed && (
        <div style={{ marginLeft: 8 }}>
          <button className={`sidebar-item ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => onFilterChange('all')}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', border: 'none', borderRadius: 4, background: activeFilter === 'all' ? 'var(--accent)' : 'transparent', color: 'var(--text-soft)', fontSize: 12, cursor: 'pointer' }}>
            📓 {t('notebook.allNotes')}
          </button>
          {notebooks.map(nb => (
            <button key={nb.id} className={`sidebar-item ${activeFilter === nb.id ? 'active' : ''}`} onClick={() => onFilterChange(nb.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', border: 'none', borderRadius: 4, background: activeFilter === nb.id ? 'var(--accent)' : 'transparent', color: 'var(--text-soft)', fontSize: 12, cursor: 'pointer' }}>
              {nb.icon || '📓'} {nb.name} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({nb.noteCount})</span>
            </button>
          ))}
          {showCreate && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input value={nbName} onChange={e => setNbName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                placeholder={t('notebook.namePlaceholderCreate')}
                autoFocus
                style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel)', color: 'var(--text)', fontSize: 11, outline: 'none' }}
              />
              <button onClick={handleCreate} style={{ border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>OK</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sidebar Tags Section ─── */
function TagsSection({ activeTag, onTagChange }: {
  activeTag: string;
  onTagChange: (tag: string | null) => void;
}) {
  const { t } = useTranslation();
  const { tags, loadTags } = useNotebookStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { loadTags(); }, [loadTags]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}>
          {collapsed ? '▶' : '▼'}
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('sidebar.tags')}</span>
      </div>
      {!collapsed && (
        <div style={{ marginLeft: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px' }}>{t('sidebar.noTags')}</span>}
          {tags.map(tag => (
            <button key={tag.id} onClick={() => onTagChange(activeTag === tag.name ? null : tag.name)}
              style={{ padding: '2px 8px', border: '1px solid var(--line)', borderRadius: 12, background: activeTag === tag.name ? 'var(--accent)' : 'var(--panel-2)', color: activeTag === tag.name ? '#fff' : 'var(--text-soft)', fontSize: 11, cursor: 'pointer' }}>
              #{tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Layout ─── */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();
  const { refresh } = useNotebookStore();
  const [filterNotebook, setFilterNotebook] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated, refresh]);

  const handleFilterNotebook = (notebookId: string | null) => {
    setFilterNotebook(notebookId || 'all');
    setFilterTag(null);
    setShowFavorites(false);
  };

  const handleFilterTag = (tag: string | null) => {
    setFilterTag(tag);
    setFilterNotebook('all');
    setShowFavorites(false);
  };

  if (!isAuthenticated) return null;

  // Build filter params for the notes page
  const filterParams = new URLSearchParams();
  if (filterNotebook !== 'all') filterParams.set('notebook', filterNotebook);
  if (filterTag) filterParams.set('tag', filterTag);
  if (showFavorites) filterParams.set('favorites', 'true');
  const filterQuery = filterParams.toString();

  const notesUrl = filterQuery ? `/notes?${filterQuery}` : '/notes';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <Link href="/notes" style={{ textDecoration: 'none' }}>
            <h1>⚒ NoteForge</h1>
          </Link>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
          <Link href="/notes/new" style={{ flex: 1 }}>
            <button className="primary-btn" style={{ padding: '6px 12px', fontSize: 12, width: '100%' }}>
              + {t('sidebar.newNote')}
            </button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href={notesUrl}>
            <button className={pathname.startsWith('/notes') && !pathname.includes('/notes/new') && !pathname.includes('/notes/') ? 'active' : ''}
              style={{ width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-soft)', fontSize: 13, cursor: 'pointer' }}>
              📝 {t('sidebar.recentNotes')}
            </button>
          </Link>
          <Link href="/notes/new">
            <button className={pathname === '/notes/new' ? 'active' : ''}
              style={{ width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-soft)', fontSize: 13, cursor: 'pointer' }}>
              ✏️ {t('noteModal.newNote')}
            </button>
          </Link>
          <button onClick={() => { setShowFavorites(!showFavorites); setFilterNotebook('all'); setFilterTag(null); }}
            style={{ width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', borderRadius: 6, background: showFavorites ? 'var(--accent)' : 'transparent', color: showFavorites ? '#fff' : 'var(--text-soft)', fontSize: 13, cursor: 'pointer' }}>
            ⭐ {t('sidebar.favorites')}
          </button>
          <Link href="/search">
            <button className={pathname.startsWith('/search') ? 'active' : ''}
              style={{ width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-soft)', fontSize: 13, cursor: 'pointer' }}>
              🔍 {t('search.triggerText')}
            </button>
          </Link>
          <Link href="/settings">
            <button className={pathname.startsWith('/settings') ? 'active' : ''}
              style={{ width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-soft)', fontSize: 13, cursor: 'pointer' }}>
              ⚙ {t('manage.title')}
            </button>
          </Link>
        </nav>

        {/* Separator */}
        <div style={{ height: 1, background: 'var(--line)', margin: '8px 12px' }} />

        {/* Notebook list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NotebookSection activeFilter={filterNotebook} onFilterChange={handleFilterNotebook} />
          <TagsSection activeTag={filterTag || ''} onTagChange={handleFilterTag} />
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.username || 'User'}</span>
            <SyncIndicator />
          </div>
          <button className="ghost-btn" onClick={logout}
            style={{ padding: '4px 8px', fontSize: 11, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            {t('sidebar.logout')}
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <div className="main-content">
          {/* Pass filter params as query string for child pages */}
          {children}
        </div>
      </main>
    </div>
  );
}
