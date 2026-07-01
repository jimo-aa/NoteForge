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
  onCreate: (payload: NewNotePayload) => void | Promise<void>;
}

const TEMPLATES = [
  {
    id: 'blank',
    name: '空白笔记',
    icon: '📄',
    content: '',
  },
  {
    id: 'meeting',
    name: '会议记录',
    icon: '🗓️',
    content: `# 会议记录

**日期**: ${new Date().toLocaleDateString('zh-CN')}  
**主持人**: 
**参与人**: 

## 议题

- [ ] 

## 讨论要点

### 议题一
- 

### 议题二
- 

## 行动项

| 项目 | 责任人 | 截止日期 |
|------|--------|---------|
|  |  |  |

## 下次会议

- **时间**: 
- **地点**: 

---
`,
  },
  {
    id: 'project',
    name: '项目文档',
    icon: '📋',
    content: `# 项目文档

## 项目概述

### 背景
- 

### 目标
- 

### 范围
- 

## 需求分析

### 功能需求
1. 
2. 
3. 

### 非功能需求
1. 
2. 

## 技术方案

### 架构设计
\`\`\`
flowchart LR
    A[前端] --> B[API]
    B --> C[后端]
    C --> D[数据库]
\`\`\`

### 关键技术
- 

## 实施计划

| 阶段 | 任务 | 时间 | 状态 |
|------|------|------|------|
| 第一阶段 |  |  |  |
| 第二阶段 |  |  |  |

## 风险管理

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
|  |  |  |  |

---
`,
  },
  {
    id: 'daily',
    name: '日常记录',
    icon: '📅',
    content: `# ${new Date().toLocaleDateString('zh-CN')}

## 今日要事

- [ ] 
- [ ] 
- [ ] 

## 工作进度

### 完成事项
- 
- 

### 进行中
- 
- 

### 需要支持

## 学习笔记

### 今日学到
- 

### 资源

## 反思总结

### 做得好的地方
- 

### 需要改进
- 

### 明天计划
- 

---
`,
  },
  {
    id: 'brainstorm',
    name: '头脑风暴',
    icon: '💡',
    content: `# 头脑风暴

**主题**: 
**日期**: ${new Date().toLocaleDateString('zh-CN')}

## 想法库

### 想法 1
- 

### 想法 2
- 

### 想法 3
- 

## 相关资料

- 

## 行动项

- [ ] 

---
`,
  },
  {
    id: 'review',
    name: '书籍评论',
    icon: '📚',
    content: `# 书籍评论

**书名**: 
**作者**: 
**出版社**: 
**评分**: ⭐⭐⭐⭐⭐

## 基本信息

- **出版日期**: 
- **页数**: 
- **ISBN**: 

## 简述

## 关键内容

### 第一部分
- 

### 第二部分
- 

## 启发与收获

1. 
2. 
3. 

## 推荐指数

- 推荐人群: 
- 阅读难度: 
- 实用价值: 

---
`,
  },
];

export function NewNoteModal({ open, notebooks = [], onClose, onCreate }: NewNoteModalProps) {
  const [title, setTitle] = useState('新笔记');
  const [notebookId, setNotebookId] = useState('default');
  const [templateId, setTemplateId] = useState('blank');
  const [tagText, setTagText] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('新笔记');
    setNotebookId(notebooks.find((item) => item.id !== 'all')?.id ?? 'default');
    setTemplateId('blank');
    setTagText('');
    const template = TEMPLATES.find((t) => t.id === 'blank');
    setContent(template?.content ?? '');
  }, [open]);
   

  useEffect(() => {
    const selectedTemplate = TEMPLATES.find((t) => t.id === templateId);
    setContent(selectedTemplate?.content ?? '');
  }, [templateId]);

  if (!open) return null;

  const createNote = async () => {
    if (!title.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const tags = Array.from(
        new Set(
          tagText
            .split(/[，,]/)
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean)
        )
      );

      const finalNotebookId =
        notebookId && notebookId !== 'all'
          ? notebookId
          : notebooks.find((item) => item.id !== 'all')?.id || 'default';

      await onCreate({
        title: title.trim() || '未命名笔记',
        notebookId: finalNotebookId,
        tags,
        content: content.trim(),
      });
    } catch (error) {
      console.error('创建笔记失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      createNote();
    }
  };

  const selectedTemplate = TEMPLATES.find((t) => t.id === templateId);

  return (
    <div className="modal-backdrop new-note-backdrop" onClick={onClose}>
      <div className="modal new-note-modal" onClick={(event) => event.stopPropagation()}>
        <div className="new-note-title">
          <span>＋</span>
          <h3>新建笔记</h3>
          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <label className="new-note-field new-note-field--full">
          <span>标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="输入笔记标题"
            autoFocus
            disabled={isLoading}
            onKeyDown={handleKeyDown}
          />
        </label>

        <div className="new-note-grid">
          <label className="new-note-field">
            <span>笔记本</span>
            <select
              value={notebookId}
              onChange={(event) => setNotebookId(event.target.value)}
              disabled={isLoading}
            >
              {notebooks
                .filter((item) => item.id !== 'all')
                .map((notebook) => (
                  <option key={notebook.id} value={notebook.id}>
                    {notebook.icon} {notebook.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="new-note-field">
            <span>模板</span>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              disabled={isLoading}
            >
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.icon} {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="new-note-field new-note-field--full">
          <span>标签（逗号分隔）</span>
          <input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="如: Rust, 架构, 笔记"
            disabled={isLoading}
          />
        </label>

        <label className="new-note-field new-note-field--full">
          <span>
            内容预览
            {selectedTemplate && selectedTemplate.id !== 'blank' && (
              <small className="template-info">（使用 {selectedTemplate.name} 模板）</small>
            )}
          </span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="可选的笔记内容..."
            rows={8}
            disabled={isLoading}
          />
        </label>

        <div className="modal-actions new-note-actions">
          <button className="ghost-btn" onClick={onClose} disabled={isLoading}>
            取消
          </button>
          <button
            className="primary-btn"
            onClick={createNote}
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? '创建中...' : '创建笔记'}
          </button>
        </div>
      </div>
    </div>
  );
}
