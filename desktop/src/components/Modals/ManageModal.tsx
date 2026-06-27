import { useState, useCallback } from 'react';
import { useStore } from '@/stores/context';
import { NotebookModal, type NotebookModalState } from './NotebookModal';
import { ConfirmDialog } from '@/components/Common/ConfirmDialog';

type Tab = 'notebooks' | 'tags';

export function ManageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notebooks, tags, notes, deleteNotebook, renameNotebook, setActiveNotebook, updateNote, showToast } = useStore();
  const [tab, setTab] = useState<Tab>('notebooks');
  const [notebookModal, setNotebookModal] = useState<NotebookModalState>({ open: false, mode: null, title: '', value: '' });
  const [renameTag, setRenameTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ kind: 'notebook' | 'tag'; id: string; name: string } | null>(null);

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
        </div>
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
