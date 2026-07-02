import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/modals.css';
import { tauriInvoke as invoke } from '@/utils/invoke';

interface Milestone {
  id: string;
  note_id: string;
  name: string;
  description?: string;
  commit_id: string;
  version_number: number;
  created_at: number;
  tags: string[];
}

export function MilestoneModal({ 
  open, 
  noteId,
  onClose,
  onCheckout
}: { 
  open: boolean; 
  noteId: string;
  onClose: () => void;
  onCheckout?: (milestoneId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version_number: 1,
    tags: ''
  });

  const loadMilestones = async () => {
    setLoading(true);
    const data = await invoke<Milestone[]>('list_milestones', { note_id: noteId });
    if (data) {
      setMilestones(data.sort((a, b) => b.created_at - a.created_at));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!open || !noteId) return;
    loadMilestones();
  }, [open, noteId]);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    const result = await invoke<Milestone>('create_milestone', {
      note_id: noteId,
      name: formData.name,
      description: formData.description || null,
      version_number: formData.version_number,
    });

    if (result) {
      setFormData({ name: '', description: '', version_number: 1, tags: '' });
      setShowCreateForm(false);
      await loadMilestones();
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;

    const result = await invoke<Milestone>('update_milestone', {
      note_id: noteId,
      milestone_id: editingId,
      name: formData.name,
      description: formData.description || null,
      tags: formData.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t),
    });

    if (result) {
      setEditingId(null);
      setFormData({ name: '', description: '', version_number: 1, tags: '' });
      await loadMilestones();
    }
  };

  const handleDelete = async (milestoneId: string) => {
    if (!confirm(t('milestone.confirmDelete'))) return;

    const result = await invoke<boolean>('delete_milestone', {
      note_id: noteId,
      milestone_id: milestoneId,
    });

    if (result) {
      await loadMilestones();
      if (selectedMilestone?.id === milestoneId) {
        setSelectedMilestone(null);
      }
    }
  };

  const handleCheckout = async (milestoneId: string) => {
    if (onCheckout) {
      await onCheckout(milestoneId);
      onClose();
    }
  };

  const startEdit = (milestone: Milestone) => {
    setEditingId(milestone.id);
    setFormData({
      name: milestone.name,
      description: milestone.description || '',
      version_number: milestone.version_number,
      tags: milestone.tags.join(', '),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', version_number: 1, tags: '' });
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="milestone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('milestone.manage')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="modal-content-large">
            <div className="loading-state">{t('common.loading')}</div>
          </div>
        ) : (
          <>
            <div className="modal-content-large">
              <div className="milestone-list">
                {milestones.length > 0 ? (
                  milestones.map((milestone) => (
                    <div 
                      key={milestone.id}
                      className={`milestone-item ${selectedMilestone?.id === milestone.id ? 'selected' : ''}`}
                      onClick={() => setSelectedMilestone(milestone)}
                    >
                      <div className="milestone-header">
                        <h4>{milestone.name}</h4>
                        <span className="version-badge">{t('milestone.version', { number: milestone.version_number })}</span>
                      </div>
                      {milestone.description && (
                        <p className="milestone-description">{milestone.description}</p>
                      )}
                      {milestone.tags.length > 0 && (
                        <div className="milestone-tags">
                          {milestone.tags.map((tag) => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="milestone-meta">
                        {new Date(milestone.created_at).toLocaleString()}
                      </div>
                      <div className="milestone-actions">
                        <button 
                          className="action-btn checkout"
                          onClick={(e) => { e.stopPropagation(); void handleCheckout(milestone.id); }}
                          title={t('milestone.checkoutHint')}
                        >
                          ↩ {t('milestone.back')}
                        </button>
                        <button 
                          className="action-btn edit"
                          onClick={(e) => { e.stopPropagation(); startEdit(milestone); }}
                          title={t('milestone.edit')}
                        >
                          ✎
                        </button>
                        <button 
                          className="action-btn delete"
                          onClick={(e) => { e.stopPropagation(); void handleDelete(milestone.id); }}
                          title={t('milestone.delete')}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">{t('milestone.empty')}</div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="primary-btn"
                onClick={() => {
                  if (editingId) handleUpdate();
                  else {
                    setShowCreateForm(!showCreateForm);
                    if (!showCreateForm) cancelEdit();
                  }
                }}
              >
                {editingId ? t('milestone.saveEdit') : showCreateForm ? t('common.cancel') : t('milestone.createNew')}
              </button>
            </div>

            {(showCreateForm || editingId) && (
              <div className="milestone-form">
                <div className="form-group">
                  <label>{t('milestone.nameRequired')}</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('milestone.namePlaceholder')}
                    autoFocus
                  />
                </div>

                {!editingId && (
                  <div className="form-group">
                    <label>{t('milestone.versionNumber')}</label>
                    <input 
                      type="number"
                      value={formData.version_number}
                      onChange={(e) => setFormData({ ...formData, version_number: Number(e.target.value) })}
                      min={1}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>{t('milestone.description')}</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('milestone.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>{t('milestone.tagsLabel')}</label>
                  <input 
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder={t('milestone.tagsPlaceholder')}
                  />
                </div>

                <div className="form-actions">
                  <button 
                    className="ghost-btn"
                    onClick={() => {
                      cancelEdit();
                      if (!editingId) setShowCreateForm(false);
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    className="primary-btn"
                    onClick={editingId ? handleUpdate : handleCreate}
                    disabled={!formData.name.trim()}
                  >
                    {editingId ? t('milestone.save') : t('milestone.create')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
