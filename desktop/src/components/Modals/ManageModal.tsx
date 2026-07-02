import { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '@/stores/context';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { NotebookModal, type NotebookModalState } from './NotebookModal';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { EncryptionModal } from './EncryptionModal';
import {
  getShortcuts,
  updateShortcut,
  resetShortcut,
  resetAllShortcuts,
  eventToCombo,
  formatKeyCombo,
  isComboTaken,
  type ShortcutDef,
  type KeyCombo,
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

type Tab = 'notebooks' | 'tags' | 'security' | 'appearance' | 'shortcuts';

export function ManageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notebooks, tags, notes, deleteNotebook, renameNotebook, setActiveNotebook, updateNote, showToast } = useStore();
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const [tab, setTab] = useState<Tab>('appearance');
  const [notebookModal, setNotebookModal] = useState<NotebookModalState>({ open: false, mode: null, title: '', value: '' });
  const [renameTag, setRenameTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ kind: 'notebook' | 'tag'; id: string; name: string } | null>(null);
  const [encryptionOpen, setEncryptionOpen] = useState(false);

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
        // The conflict will be auto-resolved (the other shortcut now uses default)
        // Show a brief visual hint via the captureKey message
        setCaptureKey(`已绑定 ${formatKeyCombo(combo)}` + (conflict ? `（${conflict.label} 已重置为默认）` : ''));
      }
      setTimeout(() => setCaptureKey(null), 2000);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturingId]);

  const handleStartCapture = (id: string) => {
    setCapturingId(id);
    setCaptureKey('按下快捷键...');
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
    { id: 'navigation', label: '导航' },
    { id: 'notes', label: '笔记操作' },
    { id: 'editor', label: '编辑器' },
    { id: 'view', label: '视图' },
    { id: 'search', label: '搜索' },
  ];

  if (!open) return null;

  const filteredNotebooks = notebooks.filter((n) => n.id !== 'all');

  const handleDeleteNotebook = async (id: string, name: string) => {
    setConfirmDel({ kind: 'notebook', id, name });
  };

  const handleRenameNotebook = (id: string, name: string) => {
    setNotebookModal({ open: true, mode: 'rename', title: '重命名笔记本', value: name, notebookId: id });
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
      showToast('success', `已移除标签「${confirmDel.id}」`);
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
    showToast('success', `已重命名标签为「${newTag}」`);
  };

  const tagCount = (tag: string) => notes.filter((n) => n.meta.tags.includes(tag)).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal manage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manage-modal-header">
          <h3>管理</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="manage-modal-tabs">
          <button className={tab === 'notebooks' ? 'tab active' : 'tab'} onClick={() => setTab('notebooks')}>笔记本</button>
          <button className={tab === 'tags' ? 'tab active' : 'tab'} onClick={() => setTab('tags')}>标签</button>
          <button className={tab === 'security' ? 'tab active' : 'tab'} onClick={() => setTab('security')}>安全</button>
          <button className={tab === 'appearance' ? 'tab active' : 'tab'} onClick={() => setTab('appearance')}>外观</button>
          <button className={tab === 'shortcuts' ? 'tab active' : 'tab'} onClick={() => setTab('shortcuts')}>快捷键</button>
        </div>
        <div className="manage-modal-body">
          {tab === 'notebooks' && (
            <div className="manage-list">
              {filteredNotebooks.length === 0 && <div className="manage-empty">暂无笔记本</div>}
              {filteredNotebooks.map((nb) => (
                <div key={nb.id} className="manage-item">
                  <span className="manage-item-icon">{nb.icon || '📓'}</span>
                  <span className="manage-item-name">{nb.name}</span>
                  <span className="manage-item-count">{nb.noteCount} 条</span>
                  <div className="manage-item-actions">
                    <button className="manage-btn" onClick={() => handleRenameNotebook(nb.id, nb.name)} title="重命名">✏️</button>
                    <button className="manage-btn" onClick={() => { setActiveNotebook(nb.id); onClose(); }} title="查看笔记">📄</button>
                    <button className="manage-btn manage-btn-danger" onClick={() => void handleDeleteNotebook(nb.id, nb.name)} title="删除">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'tags' && (
            <div className="manage-list">
              {tags.length === 0 && <div className="manage-empty">暂无标签</div>}
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
                      <span className="manage-item-count">{tagCount(tag)} 条</span>
                      <div className="manage-item-actions">
                        <button className="manage-btn" onClick={() => { setRenameTag(tag); setRenameValue(tag); }} title="重命名">✏️</button>
                        <button className="manage-btn manage-btn-danger" onClick={() => handleDeleteTag(tag)} title="删除">🗑️</button>
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
                  <span className="manage-item-name">端到端加密</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  使用 AES-256-GCM + Argon2 对笔记内容进行本地加密。设置密码后，每次启动应用需输入密码解锁。
                </p>
                <button
                  className="primary-btn"
                  onClick={() => setEncryptionOpen(true)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  管理加密设置
                </button>
              </div>
            </div>
          )}
          {tab === 'appearance' && (
            <div className="manage-list appearance-settings">
              {/* Theme Mode */}
              <div className="appearance-section">
                <h4 className="appearance-section-title">主题模式</h4>
                <div className="theme-mode-options">
                  {([
                    { id: 'light' as ThemeMode, icon: '☀️', label: '浅色' },
                    { id: 'dark' as ThemeMode, icon: '🌙', label: '深色' },
                    { id: 'system' as ThemeMode, icon: '💻', label: '跟随系统' },
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

              {/* Accent Color */}
              <div className="appearance-section">
                <h4 className="appearance-section-title">强调色</h4>
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
                  <label className="accent-custom-label">自定义颜色</label>
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
          {tab === 'shortcuts' && (
            <div className="manage-list shortcuts-settings" ref={captureRef}>
              <div className="shortcuts-header">
                <span className="shortcuts-header-title">自定义快捷键</span>
                <button className="shortcuts-reset-btn" onClick={handleResetAll}>重置全部</button>
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
                        ? (captureKey || '按下快捷键...')
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
                              title="点击修改快捷键"
                            >
                              <kbd>{displayCombo}</kbd>
                            </button>
                            {isEdited && capturingId !== s.id && (
                              <button
                                className="shortcuts-reset-one-btn"
                                onClick={() => handleResetOne(s.id)}
                                title="重置为默认"
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
                <p>点击快捷键进行修改，按下 Esc 取消修改。</p>
              </div>
            </div>
          )}
        </div>
        <EncryptionModal open={encryptionOpen} onClose={() => setEncryptionOpen(false)} />
        <NotebookModal state={notebookModal} onClose={() => setNotebookModal({ open: false, mode: null, title: '', value: '' })} onConfirm={async (name, icon, color) => {
          if (notebookModal.mode === 'rename' && notebookModal.notebookId) {
            await renameNotebook(notebookModal.notebookId, name);
            setNotebookModal({ open: false, mode: null, title: '', value: '' });
          }
        }} />
        <ConfirmDialog
          open={confirmDel !== null}
          title={confirmDel?.kind === 'notebook' ? '删除笔记本' : '删除标签'}
          message={confirmDel?.kind === 'notebook' ? `确认删除笔记本「${confirmDel?.name}」？（笔记不会被删除）` : `确认从所有笔记中移除标签「${confirmDel?.name}」？`}
          confirmLabel="删除"
          danger
          onConfirm={() => void executeDelete()}
          onCancel={() => setConfirmDel(null)}
        />
      </div>
    </div>
  );
}
