import { useEffect, useState } from 'react';
import type { Notebook } from '@/types';

interface NewNotePayload {
  title: string;
  notebookId: string;
  tags: string[];
  content: string;
}

interface NewNoteModalProps {
  open: boolean;
  notebooks?: Notebook[];
  onClose: () => void;
  onCreate: (payload: NewNotePayload) => void;
}

const templates = [
  { id: 'blank', name: '空白笔记', content: '' },
  { id: 'meeting', name: '会议记录', content: '# 会议记录\n\n## 议题\n\n- \n\n## 结论\n\n- ' },
  { id: 'project', name: '项目文档', content: '# 项目文档\n\n## 背景\n\n## 目标\n\n## 计划\n' },
  { id: 'daily', name: '日常记录', content: `# ${new Date().toLocaleDateString('zh-CN')}\n\n## 今日记录\n\n- ` },
];

export function NewNoteModal({ open, notebooks = [], onClose, onCreate }: NewNoteModalProps) {
  const [title, setTitle] = useState('新笔记');
  const [notebookId, setNotebookId] = useState('default');
  const [templateId, setTemplateId] = useState('blank');
  const [tagText, setTagText] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('新笔记');
    setNotebookId(notebooks.find((item) => item.id !== 'all')?.id ?? 'default');
    setTemplateId('blank');
    setTagText('');
    setContent('');
  }, [notebooks, open]);

  if (!open) return null;

  const createNote = () => {
    const template = templates.find((item) => item.id === templateId);
    const tags = Array.from(new Set(tagText.split(/[，,]/).map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean)));
    onCreate({ title: title.trim() || '未命名笔记', notebookId, tags, content: content.trim() || template?.content || '' });
  };

  return (
    <div className="modal-backdrop new-note-backdrop" onClick={onClose}>
      <div className="modal new-note-modal" onClick={(event) => event.stopPropagation()}>
        <div className="new-note-title"><span>＋</span><h3>新建笔记</h3></div>
        <label className="new-note-field new-note-field--full"><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入标题" autoFocus /></label>
        <div className="new-note-grid">
          <label className="new-note-field"><span>笔记本</span><select value={notebookId} onChange={(event) => setNotebookId(event.target.value)}>{notebooks.filter((item) => item.id !== 'all').map((notebook) => (<option key={notebook.id} value={notebook.id}>{notebook.name}</option>))}</select></label>
          <label className="new-note-field"><span>模板</span><select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{templates.map((template) => (<option key={template.id} value={template.id}>{template.name}</option>))}</select></label>
        </div>
        <label className="new-note-field new-note-field--full"><span>标签（逗号分隔）</span><input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="如: Rust, 架构, 笔记" /></label>
        <label className="new-note-field new-note-field--full"><span>内容预览</span><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="可选的笔记内容...\n留空则使用模板内容" /></label>
        <div className="modal-actions new-note-actions"><button className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" onClick={createNote}>创建笔记</button></div>
      </div>
    </div>
  );
}
