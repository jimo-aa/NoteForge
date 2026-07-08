import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/stores/context';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import type { MetricsData } from '@/types';
import { NotebookModal, type NotebookModalState } from './NotebookModal';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { EncryptionModal } from './EncryptionModal';
import { getPluginRegistry } from '@/components/Editor/plugins/registry';
import type { EditorPlugin } from '@/components/Editor/plugins/types';
import {
  getShortcuts,
  updateShortcut,
  resetShortcut,
  resetAllShortcuts,
  eventToCombo,
  formatKeyCombo,
  isComboTaken,
  type ShortcutDef,
} from '@/services/shortcutService';

const ACCENT_PRESETS = [
  '#6a63ff', // purple (default)
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // violet
];

type Tab = 'notebooks' | 'tags' | 'security' | 'appearance' | 'shortcuts' | 'stats' | 'sync' | 'storage' | 'plugins';

export function ManageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { notebooks, tags, notes, deleteNotebook, renameNotebook, setActiveNotebook, updateNote, showToast } = useStore();
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const [tab, setTab] = useState<Tab>('appearance');
  const [notebookModal, setNotebookModal] = useState<NotebookModalState>({ open: false, mode: null, title: '', value: '' });
  const [renameTag, setRenameTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ kind: 'notebook' | 'tag'; id: string; name: string } | null>(null);
  const [encryptionOpen, setEncryptionOpen] = useState(false);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // ── Storage state ──
  const [storageRoots, setStorageRoots] = useState<string[]>([]);
  const [extraDirs, setExtraDirs] = useState<string[]>([]);

  useEffect(() => {
    if (!open || tab !== 'storage') return;
    void (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const roots = await invoke<string[]>('list_storage_roots');
        setStorageRoots(roots ?? []);
      } catch { /* tauri cmd not yet available */ }
    })();
  }, [open, tab]);

  const handleSelectPrimaryDir = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: t('manage.storageSelectDir') });
      if (selected) {
        const path = typeof selected === 'string' ? selected : selected[0];
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_primary_root', { path });
        setStorageRoots([path, ...storageRoots.slice(1)]);
        showToast('success', t('manage.storageRootChanged'));
      }
    } catch { /* */ }
  };

  const handleAddExtraDir = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: t('manage.storageSelectDir') });
      if (selected) {
        const path = typeof selected === 'string' ? selected : selected[0];
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('add_extra_root', { path });
        setExtraDirs([...extraDirs, path]);
        showToast('success', t('manage.storageDirAdded'));
      }
    } catch { /* */ }
  };

  const handleRemoveExtraDir = async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('remove_extra_root', { path });
      setExtraDirs(extraDirs.filter(d => d !== path));
      showToast('success', t('manage.storageDirRemoved'));
    } catch { /* */ }
  };

  // ── Plugin state ──
  const pluginManager = getPluginRegistry();
  const [plugins, setPlugins] = useState<Array<{ plugin: EditorPlugin; active: boolean }>>([]);

  useEffect(() => {
    if (!open || tab !== 'plugins') return;
    const list = pluginManager.list().map((id) => ({
      plugin: pluginManager.get(id)!,
      active: pluginManager.active.includes(id),
    }));
    setPlugins(list);
  }, [open, tab, pluginManager]);

  const handleTogglePlugin = async (id: string, currentlyActive: boolean) => {
    if (currentlyActive) {
      await pluginManager.deactivate(id);
    } else {
      await pluginManager.activate(id);
    }
    const list = pluginManager.list().map((pid) => ({
      plugin: pluginManager.get(pid)!,
      active: pluginManager.active.includes(pid),
    }));
    setPlugins(list);
  };

  const phaseLabel = (phase?: string): string => {
    switch (phase) {
      case 'core': return t('manage.pluginsCore');
      case 'builtin': return t('manage.pluginsBuiltin');
      case 'lazy': return t('manage.pluginsLazy');
      default: return phase ?? t('manage.pluginsThirdParty');
    }
  };

  // ── Sync state ──
  const getSyncServiceFn = () => {
    // Dynamic import to avoid circular dependency
    return import('@/services/syncService').then(m => m.getSyncService());
  };
  const [syncStatus, setSyncStatus] = useState<string>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotebookFilter, setSyncNotebookFilter] = useState('all');
  

  useEffect(() => {
    if (!open || tab !== 'sync') return;
    void getSyncServiceFn().then(svc => {
      setSyncStatus(svc.getCurrentStatus());
      setPendingCount(svc.getPendingCount());
    });
  }, [open, tab]);

  const handleSyncNow = () => {
    setIsSyncing(true);
    void getSyncServiceFn().then(svc => {
      svc.sync(lastSyncAt ?? 0).then(result => {
        setIsSyncing(false);
        if (result) {
          setLastSyncAt(result.serverVersion);
          setPendingCount(svc.getPendingCount());
          setSyncStatus('online');
          showToast('success', t('sync.syncComplete'));
        } else {
          setSyncStatus('error');
          showToast('error', t('sync.syncFailed'));
        }
      });
    });
  };

  const handleResolveLocal = () => {
    // Resolve conflicts by keeping local versions (clear pending queue)
    void getSyncServiceFn().then(_svc => {
      // Mark all as accepted by clearing queue
      import('@tauri-apps/api/core').then(({ invoke }) => {
        void invoke('clear_sync_queue');
      });
      setConflictCount(0);
      setPendingCount(0);
      showToast('success', t('sync.resolvedLocal'));
    });
  };

  const handleResolveRemote = () => {
    // Resolve conflicts by accepting remote versions (force pull)
    void getSyncServiceFn().then(_svc => {
      handleSyncNow();
      setConflictCount(0);
      showToast('success', t('sync.resolvedRemote'));
    });
  };

  useEffect(() => {
    if (!open || tab !== 'stats') return;
    let cancelled = false;
    const fetchMetrics = () => {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        if (cancelled) return;
        invoke<MetricsData>('get_metrics')
          .then(setMetrics)
          .catch(() => setMetrics(null))
          .finally(() => { if (!cancelled) setMetricsLoading(false); });
      });
    };
    setMetricsLoading(true);
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [open, tab]);

  // ── Shortcut editing state ──
  const [shortcuts, setShortcuts] = useState<ShortcutDef[]>(() => getShortcuts());
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [captureKey, setCaptureKey] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (capturingId === null) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore bare modifiers
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      if (e.key === 'Escape') { setCapturingId(null); setCaptureKey(null); return; }
      e.preventDefault();
      e.stopPropagation();
      const combo = eventToCombo(e);
      const conflict = isComboTaken(combo, capturingId);
      updateShortcut(capturingId, combo);
      setCaptureKey(formatKeyCombo(combo));
      setShortcuts(getShortcuts());
      setCapturingId(null);
      if (conflict) {
        setCaptureKey(t('manage.shortcutsResetConflict', { combo: formatKeyCombo(combo), label: conflict.label }));
      } else {
        setCaptureKey(t('manage.shortcutsBound', { combo: formatKeyCombo(combo) }));
      }
      setTimeout(() => setCaptureKey(null), 2000);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturingId, t]);

  const handleStartCapture = (id: string) => {
    setCapturingId(id);
    setCaptureKey(t('manage.shortcutsPressKey'));
  };

  const handleResetAll = () => {
    resetAllShortcuts();
    setShortcuts(getShortcuts());
  };

  const handleResetOne = (id: string) => {
    resetShortcut(id);
    setShortcuts(getShortcuts());
  };

  const shortcutCategories: Array<{ id: ShortcutDef['category']; label: string }> = [
    { id: 'navigation', label: t('manage.shortcutsCategoryNavigation') },
    { id: 'notes', label: t('manage.shortcutsCategoryNotes') },
    { id: 'editor', label: t('manage.shortcutsCategoryEditor') },
    { id: 'view', label: t('manage.shortcutsCategoryView') },
    { id: 'search', label: t('manage.shortcutsCategorySearch') },
  ];

  if (!open) return null;

  const filteredNotebooks = notebooks.filter((n) => n.id !== 'all');

  const handleDeleteNotebook = async (id: string, name: string) => {
    setConfirmDel({ kind: 'notebook', id, name });
  };

  const handleRenameNotebook = (id: string, name: string) => {
    setNotebookModal({ open: true, mode: 'rename', title: t('manage.renameNotebookTitle'), value: name, notebookId: id });
  };

  const handleDeleteTag = (tag: string) => {
    setConfirmDel({ kind: 'tag', id: tag, name: tag });
  };

  const executeDelete = async () => {
    if (!confirmDel) return;
    if (confirmDel.kind === 'notebook') {
      await deleteNotebook(confirmDel.id);
    } else {
      notes.forEach((n) => {
        if (n.meta.tags.includes(confirmDel.id)) {
          updateNote(n.meta.id, { tags: n.meta.tags.filter((t) => t !== confirmDel.id) });
        }
      });
      showToast('success', t('manage.confirmDeleteTagMsg', { name: confirmDel.id }));
    }
    setConfirmDel(null);
  };

  const handleRenameTag = (oldTag: string) => {
    const newTag = renameValue.trim();
    if (!newTag || newTag === oldTag) {
      setRenameTag(null);
      return;
    }
    notes.forEach((n) => {
      if (n.meta.tags.includes(oldTag)) {
        updateNote(n.meta.id, { tags: n.meta.tags.map((t) => (t === oldTag ? newTag : t)) });
      }
    });
    setRenameTag(null);
    setRenameValue('');
    showToast('success', t('manage.rename', { name: newTag }));
  };

  const tagCount = (tag: string) => notes.filter((n) => n.meta.tags.includes(tag)).length;

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manage-modal-header">
          <h3>{t('manage.title')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="manage-modal-tabs">
          <button className={tab === 'notebooks' ? 'tab active' : 'tab'} onClick={() => setTab('notebooks')}>{t('manage.tabNotebooks')}</button>
          <button className={tab === 'tags' ? 'tab active' : 'tab'} onClick={() => setTab('tags')}>{t('manage.tabTags')}</button>
          <button className={tab === 'security' ? 'tab active' : 'tab'} onClick={() => setTab('security')}>{t('manage.tabSecurity')}</button>
          <button className={tab === 'appearance' ? 'tab active' : 'tab'} onClick={() => setTab('appearance')}>{t('manage.tabAppearance')}</button>
          <button className={tab === 'shortcuts' ? 'tab active' : 'tab'} onClick={() => setTab('shortcuts')}>{t('manage.tabShortcuts')}</button>
          <button className={tab === 'stats' ? 'tab active' : 'tab'} onClick={() => setTab('stats')}>{t('manage.tabStats')}</button>
          <button className={tab === 'sync' ? 'tab active' : 'tab'} onClick={() => setTab('sync')}>{t('manage.tabSync')}</button>
          <button className={tab === 'storage' ? 'tab active' : 'tab'} onClick={() => setTab('storage')}>{t('manage.tabStorage')}</button>
          <button className={tab === 'plugins' ? 'tab active' : 'tab'} onClick={() => setTab('plugins')}>{t('manage.tabPlugins')}</button>
        </div>
        <div className="manage-modal-body">
          {tab === 'notebooks' && (
            <div className="manage-list">
              {filteredNotebooks.length === 0 && <div className="manage-empty">{t('manage.noNotebooks')}</div>}
              {filteredNotebooks.map((nb) => (
                <div key={nb.id} className="manage-item">
                  <span className="manage-item-icon">{nb.icon || '📓'}</span>
                  <span className="manage-item-name">{nb.name}</span>
                  <span className="manage-item-count">{t('manage.tagCount', { count: nb.noteCount })}</span>
                  <div className="manage-item-actions">
                    <button className="manage-btn" onClick={() => handleRenameNotebook(nb.id, nb.name)} title={t('manage.rename')}>✏️</button>
                    <button className="manage-btn" onClick={() => { setActiveNotebook(nb.id); onClose(); }} title={t('manage.viewNotes')}>📄</button>
                    <button className="manage-btn manage-btn-danger" onClick={() => void handleDeleteNotebook(nb.id, nb.name)} title={t('common.delete')}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'tags' && (
            <div className="manage-list">
              {tags.length === 0 && <div className="manage-empty">{t('manage.noTags')}</div>}
              {tags.map((tag) => (
                <div key={tag} className="manage-item">
                  {renameTag === tag ? (
                    <>
                      <input
                        className="manage-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameTag(tag); if (e.key === 'Escape') setRenameTag(null); }}
                        autoFocus
                      />
                      <button className="manage-btn" onClick={() => handleRenameTag(tag)}>✓</button>
                      <button className="manage-btn" onClick={() => setRenameTag(null)}>✕</button>
                    </>
                  ) : (
                    <>
                      <span className="manage-item-icon">#</span>
                      <span className="manage-item-name">#{tag}</span>
                      <span className="manage-item-count">{t('manage.tagCount', { count: tagCount(tag) })}</span>
                      <div className="manage-item-actions">
                        <button className="manage-btn" onClick={() => { setRenameTag(tag); setRenameValue(tag); }} title={t('manage.rename')}>✏️</button>
                        <button className="manage-btn manage-btn-danger" onClick={() => handleDeleteTag(tag)} title={t('common.delete')}>🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {tab === 'security' && (
            <div className="manage-list">
              <div className="manage-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="manage-item-icon">🔐</span>
                  <span className="manage-item-name">{t('manage.securityTitle')}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {t('manage.securityDesc')}
                </p>
                <button
                  className="primary-btn"
                  onClick={() => setEncryptionOpen(true)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {t('manage.securityManage')}
                </button>
              </div>
            </div>
          )}
          {tab === 'appearance' && (
            <div className="manage-list appearance-settings">
              {/* Theme Mode */}
              <div className="appearance-section">
                <h4 className="appearance-section-title">{t('manage.appearanceTheme')}</h4>
                <div className="theme-mode-options">
                  {([
                    { id: 'light' as ThemeMode, icon: '☀️', label: t('manage.appearanceLight') },
                    { id: 'dark' as ThemeMode, icon: '🌙', label: t('manage.appearanceDark') },
                    { id: 'system' as ThemeMode, icon: '💻', label: t('manage.appearanceSystem') },
                  ]).map((opt) => (
                    <button
                      key={opt.id}
                      className={`theme-mode-card${theme === opt.id ? ' active' : ''}`}
                      onClick={() => setTheme(opt.id)}
                    >
                      <span className="theme-mode-icon">{opt.icon}</span>
                      <span className="theme-mode-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="appearance-section">
                <h4 className="appearance-section-title">{t('manage.appearanceAccent')}</h4>
                <div className="accent-color-picker">
                  {ACCENT_PRESETS.map((color) => (
                    <button
                      key={color}
                      className={`accent-color-swatch${accentColor === color ? ' active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setAccentColor(color)}
                      title={color}
                    />
                  ))}
                </div>
                <div className="accent-custom-row">
                  <label className="accent-custom-label">{t('manage.appearanceCustom')}</label>
                  <input
                    type="color"
                    className="accent-custom-input"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                  <span className="accent-hex-value">{accentColor}</span>
                </div>
              </div>
            </div>
          )}
          {tab === 'stats' && (
            <div className="manage-list stats-dashboard">
              <h4 className="stats-title">{t('manage.statsTitle')}</h4>
              {metricsLoading ? (
                <div className="manage-empty">{t('common.loading')}</div>
              ) : metrics ? (
                <div className="stats-grid">
                  <div className="stats-card">
                    <span className="stats-value">{metrics.launchCount}</span>
                    <span className="stats-label">{t('manage.statsLaunchCount')}</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-value">{metrics.totalNotesCreated}</span>
                    <span className="stats-label">{t('manage.statsNotesCreated')}</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-value">{formatDuration(metrics.totalEditSeconds)}</span>
                    <span className="stats-label">{t('manage.statsEditTime')}</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-value">{metrics.totalSearches}</span>
                    <span className="stats-label">{t('manage.statsSearches')}</span>
                  </div>
                  <div className="stats-card stats-card-wide">
                    <span className="stats-label">{t('manage.statsFirstLaunch')}</span>
                    <span className="stats-value-small">{metrics.firstLaunchAt ? new Date(metrics.firstLaunchAt * 1000).toLocaleString() : t('manage.statsNever')}</span>
                  </div>
                  <div className="stats-card stats-card-wide">
                    <span className="stats-label">{t('manage.statsLastLaunch')}</span>
                    <span className="stats-value-small">{metrics.lastLaunchAt ? new Date(metrics.lastLaunchAt * 1000).toLocaleString() : t('manage.statsNever')}</span>
                  </div>
                </div>
              ) : (
                <div className="manage-empty">{t('manage.statsNever')}</div>
              )}
            </div>
          )}
          {tab === 'sync' && (
            <div className="manage-list">
              <h4>{t('sync.title')}</h4>
              <div className="sync-state-section">
                <div className="sync-state-item">
                  <span className="sync-state-label">{t('sync.lastSync')}</span>
                  <span className="sync-state-value">
                    {syncStatus === 'online' || syncStatus === 'idle'
                      ? t('sync.lastSync', { time: lastSyncAt ? new Date(lastSyncAt).toLocaleString() : t('common.none') })
                      : t('sync.notSynced')}
                  </span>
                </div>
                <div className="sync-state-item">
                  <span className="sync-state-label">{t('sync.pending')}</span>
                  <span className="sync-state-value sync-state-value--pending">
                    {pendingCount > 0 ? t('sync.pendingChanges', { count: pendingCount }) : t('sync.nonePending')}
                  </span>
                </div>
                <div className="sync-state-item">
                  <span className="sync-state-label">{t('sync.conflicts')}</span>
                  <span className="sync-state-value sync-state-value--conflict">
                    {conflictCount > 0
                      ? t('sync.conflicts', { count: conflictCount })
                      : t('sync.noConflicts')}
                  </span>
                </div>
              </div>
              {pendingCount > 0 && (
                <div className="sync-conflict-actions">
                  <button className="primary-btn" onClick={handleSyncNow} disabled={isSyncing}>
                    {isSyncing ? t('sync.syncing') : t('sync.startSync')}
                  </button>
                </div>
              )}
              {conflictCount > 0 && (
                <div className="sync-conflict-actions">
                  <p className="sync-conflict-desc">{t('sync.conflictDesc')}</p>
                  <button className="primary-btn" onClick={handleResolveLocal}>
                    {t('sync.resolveLocal')}
                  </button>
                  <button className="ghost-btn" onClick={handleResolveRemote}>
                    {t('sync.resolveRemote')}
                  </button>
                </div>
              )}

              <div className="sync-notebook-filter">
                <label>{t('sync.selectiveSyncLabel')}</label>
                <select
                  value={syncNotebookFilter}
                  onChange={(e) => setSyncNotebookFilter(e.target.value)}
                  className="sync-notebook-select"
                >
                  <option value="all">{t('sync.syncAllNotebooks')}</option>
                  {notebooks.filter((nb) => nb.id !== 'all').map((nb) => (
                    <option key={nb.id} value={nb.id}>{nb.icon} {nb.name}</option>
                  ))}
                </select>
              </div>

              <div className="sync-connection-status">
                <span className={`sync-connect-dot ${syncStatus === 'online' || syncStatus === 'idle' ? 'connected' : 'disconnected'}`} />
                <span>{t('sync.connectionStatus', { status: syncStatus })}</span>
              </div>
            </div>
          )}
          {tab === 'storage' && (
            <div className="manage-list">
              <h4>{t('manage.storageTitle')}</h4>
              <div className="storage-section">
                <div className="storage-group">
                  <label className="storage-label">{t('manage.storagePrimary')}</label>
                  <p className="storage-desc">{t('manage.storagePrimaryDesc')}</p>
                  <div className="storage-path-row">
                    <span className="storage-path">{storageRoots[0] || t('common.none')}</span>
                    <button className="manage-btn" onClick={handleSelectPrimaryDir} title={t('manage.storageSelectDir')}>
                      📁
                    </button>
                  </div>
                </div>

                <div className="storage-group" style={{ marginTop: 20 }}>
                  <label className="storage-label">{t('manage.storageExtra')}</label>
                  <p className="storage-desc">{t('manage.storageExtraDesc')}</p>
                  {extraDirs.length === 0 && <div className="manage-empty">{t('manage.storageNoExtra')}</div>}
                  {extraDirs.map((dir) => (
                    <div key={dir} className="storage-path-row">
                      <span className="storage-path">{dir}</span>
                      <button className="manage-btn manage-btn-danger" onClick={() => void handleRemoveExtraDir(dir)} title={t('manage.storageRemoveDir')}>
                        🗑️
                      </button>
                    </div>
                  ))}
                  <button className="primary-btn" style={{ marginTop: 10 }} onClick={() => void handleAddExtraDir()}>
                    {t('manage.storageAddDir')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {tab === 'plugins' && (
            <div className="manage-list">
              <h4>{t('manage.pluginsTitle')}</h4>
              <p className="storage-desc" style={{ padding: '0 20px', marginBottom: 8 }}>{t('manage.pluginsDesc')}</p>
              {plugins.length === 0 && <div className="manage-empty">{t('manage.pluginsNoPlugins')}</div>}
              {plugins.map(({ plugin, active }) => (
                <div key={plugin.id} className="manage-item plugin-item">
                  <div className="plugin-info">
                    <span className="plugin-name">{plugin.name}</span>
                    <span className="plugin-meta">
                      <span className={`plugin-badge plugin-badge--${plugin.meta?.phase ?? 'third-party'}`}>{phaseLabel(plugin.meta?.phase)}</span>
                      {' · '}v{plugin.version}
                      {plugin.description && <> · <span className="plugin-desc">{plugin.description}</span></>}
                    </span>
                  </div>
                  <div className="manage-item-actions">
                    <span className={`plugin-status ${active ? 'active' : 'inactive'}`}>
                      {active ? t('manage.pluginsStatusActive') : t('manage.pluginsStatusInactive')}
                    </span>
                    <button
                      className={`manage-btn ${active ? 'manage-btn-warn' : 'manage-btn-ok'}`}
                      onClick={() => void handleTogglePlugin(plugin.id, active)}
                    >
                      {active ? t('manage.pluginsDisable') : t('manage.pluginsEnable')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'shortcuts' && (
            <div className="manage-list shortcuts-settings" ref={captureRef}>
              <div className="shortcuts-header">
                <span className="shortcuts-header-title">{t('manage.shortcutsTitle')}</span>
                <button className="shortcuts-reset-btn" onClick={handleResetAll}>{t('manage.shortcutsResetAll')}</button>
              </div>
              {shortcutCategories.map((cat) => {
                const catShortcuts = shortcuts.filter((s) => s.category === cat.id);
                if (catShortcuts.length === 0) return null;
                return (
                  <div key={cat.id} className="shortcuts-category">
                    <h4 className="shortcuts-category-title">{cat.label}</h4>
                    {catShortcuts.map((s) => {
                      const isCapturing = capturingId === s.id;
                      const displayCombo = isCapturing
                        ? (captureKey || t('manage.shortcutsPressKey'))
                        : formatKeyCombo(s.keys);
                      const isEdited = JSON.stringify(s.keys) !== JSON.stringify(s.defaultKeys);
                      return (
                        <div key={s.id} className={`shortcuts-row${isCapturing ? ' capturing' : ''}`}>
                          <div className="shortcuts-row-info">
                            <span className="shortcuts-row-label">{s.label}</span>
                            <span className="shortcuts-row-desc">{s.description}</span>
                          </div>
                          <div className="shortcuts-row-actions">
                            <button
                              className={`shortcuts-key-btn${isEdited ? ' edited' : ''}`}
                              onClick={() => handleStartCapture(s.id)}
                              disabled={capturingId !== null}
                              title={t('manage.shortcutsClickToEdit')}
                            >
                              <kbd>{displayCombo}</kbd>
                            </button>
                            {isEdited && capturingId !== s.id && (
                              <button
                                className="shortcuts-reset-one-btn"
                                onClick={() => handleResetOne(s.id)}
                                title={t('manage.shortcutsResetDefault')}
                              >
                                ↺
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className="shortcuts-footer">
                <p>{t('manage.shortcutsFooter')}</p>
              </div>
            </div>
          )}
        </div>
        <EncryptionModal open={encryptionOpen} onClose={() => setEncryptionOpen(false)} />
        <NotebookModal state={notebookModal} onClose={() => setNotebookModal({ open: false, mode: null, title: '', value: '' })} onConfirm={async (name, _icon, _color) => {
          if (notebookModal.mode === 'rename' && notebookModal.notebookId) {
            await renameNotebook(notebookModal.notebookId, name);
            setNotebookModal({ open: false, mode: null, title: '', value: '' });
          }
        }} />
        <ConfirmDialog
          open={confirmDel !== null}
          title={confirmDel?.kind === 'notebook' ? t('manage.confirmDeleteNotebookTitle') : t('manage.confirmDeleteTagTitle')}
          message={confirmDel?.kind === 'notebook' ? t('manage.confirmDeleteNotebookMsg', { name: confirmDel?.name ?? '' }) : t('manage.confirmDeleteTagMsg', { name: confirmDel?.name ?? '' })}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={() => void executeDelete()}
          onCancel={() => setConfirmDel(null)}
        />
      </div>
    </div>
  );
}
