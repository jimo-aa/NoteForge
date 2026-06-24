import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../../stores/context';
import { renderMarkdown } from '@/utils/markdown';

const MARKDOWN_ACTIONS = [
  { label: 'B', title: '粗体', before: '**', after: '**', sample: '粗体' },
  { label: 'I', title: '斜体', before: '*', after: '*', sample: '斜体' },
  { label: 'S', title: '删除线', before: '~~', after: '~~', sample: '删除线' },
  { label: '`', title: '行内代码', before: '`', after: '`', sample: 'code' },
  { label: 'H', title: '标题', before: '## ', after: '', sample: '标题' },
  { label: '•', title: '无序列表', before: '- ', after: '', sample: '列表项' },
  { label: '1.', title: '有序列表', before: '1. ', after: '', sample: '列表项' },
  { label: '□', title: '任务', before: '- [ ] ', after: '', sample: '待办事项' },
  { label: '“', title: '引用', before: '> ', after: '', sample: '引用内容' },
  { label: '</>', title: '代码块', before: '```\n', after: '\n```', sample: '代码' },
  { label: '🔗', title: '链接', before: '[', after: '](https://)', sample: '链接文本' },
  { label: '▦', title: '表格', before: '\n| 层级 | 技术 | 说明 |\n|---|---|---|\n| 桌面端 | Tauri + React | 高性能原生 |\n', after: '', sample: '' },
  { label: '—', title: '分割线', before: '\n---\n', after: '', sample: '' },
];

export function Editor() {
  const {
    notes,
    currentNote,
    updateNote,
    toggleFavorite,
    togglePin,
    deleteNote,
    isPreviewVisible,
    setIsPreviewVisible,
    setIsPropertiesOpen,
    isPropertiesOpen,
    showToast,
  } = useStore();
  const note = useMemo(() => currentNote, [currentNote]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [editorWidth, setEditorWidth] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [jumpLine, setJumpLine] = useState<number | null>(null);

  useEffect(() => {
    const onJump = (event: Event) => {
      const detail = (event as CustomEvent<{ noteId: string; line: number; column: number }>).detail;
      if (!detail || !note || detail.noteId !== note.meta.id) return;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const targetLine = Math.max(1, detail.line);
      const targetIndex = note.content
        .split('\n')
        .slice(0, targetLine - 1)
        .reduce((acc, line) => acc + line.length + 1, 0);

      setJumpLine(targetLine);
      setIsPreviewVisible(true);
      textarea.focus();
      textarea.setSelectionRange(targetIndex, Math.min(targetIndex + 1, note.content.length));

      const styles = window.getComputedStyle(textarea);
      const lineHeight = Number.parseFloat(styles.lineHeight || '24') || 24;
      const paddingTop = Number.parseFloat(styles.paddingTop || '0') || 0;
      const visibleLines = Math.max(1, Math.floor(textarea.clientHeight / lineHeight));
      const desiredLine = Math.max(1, targetLine - Math.floor(visibleLines / 3));
      textarea.scrollTop = Math.max(0, (desiredLine - 1) * lineHeight - paddingTop);

      window.setTimeout(() => setJumpLine((current) => (current === targetLine ? null : current)), 1800);
    };

    window.addEventListener('noteforge:jump-to-hit', onJump as EventListener);
    return () => window.removeEventListener('noteforge:jump-to-hit', onJump as EventListener);
  }, [note, setIsPreviewVisible]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((item) => item.meta.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet);
  }, [notes]);

  if (!note) {
    return (
      <section className="editor-workspace">
        <div className="empty-state">
          <div className="icon">📝</div>
          <h2>请选择左侧笔记开始编辑</h2>
          <p>这里会呈现标签、Markdown 编辑、实时预览与属性信息。</p>
        </div>
      </section>
    );
  }

  const meta = note.meta;
  const currentTags = meta.tags ?? [];
  const availableTags = allTags.filter((tag) => !currentTags.includes(tag));
  const updateContent = (content: string) => updateNote(meta.id, { content });
  const updateTags = (tags: string[]) => updateNote(meta.id, { tags });
  const removeTag = (tag: string) => updateTags(currentTags.filter((item) => item !== tag));
  const addTag = (tag: string) => { const cleanTag = tag.trim().replace(/^#/, ''); if (!cleanTag) return; if (currentTags.includes(cleanTag)) { showToast('info', '标签已存在'); return; } updateTags([...currentTags, cleanTag]); setTagDraft(''); setTagModalOpen(false); };
  const insertMarkdown = (before: string, after: string, sample: string) => { const textarea = textareaRef.current; if (!textarea) return; const start = textarea.selectionStart; const end = textarea.selectionEnd; const selected = note.content.slice(start, end) || sample; const next = `${note.content.slice(0, start)}${before}${selected}${after}${note.content.slice(end)}`; updateContent(next); window.requestAnimationFrame(() => { textarea.focus(); const cursor = start + before.length + selected.length; textarea.setSelectionRange(cursor, cursor); }); };
  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => { event.preventDefault(); setIsResizing(true); const container = event.currentTarget.parentElement; if (!container) return; const rect = container.getBoundingClientRect(); const onMove = (moveEvent: MouseEvent) => { const next = ((moveEvent.clientX - rect.left) / rect.width) * 100; setEditorWidth(Math.min(72, Math.max(32, next))); }; const onUp = () => { setIsResizing(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); };
  const exportedFile = () => { const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${meta.title || 'note'}.md`; link.click(); URL.revokeObjectURL(url); showToast('success', '已下载 Markdown 文件'); };

  return (
    <section className={isResizing ? 'editor-workspace is-resizing' : 'editor-workspace'}>
      <div className="editor-tabs">
        {currentTags.map((tag) => (<button key={tag} className="editor-tab" onClick={() => removeTag(tag)} title="点击移除标签"><span>{tag}</span><span>×</span></button>))}
        <button className="editor-tab add" onClick={() => setTagModalOpen(true)}>＋ 添加标签</button>
      </div>
      <header className="document-header">
        <input className="document-title" value={meta.title} onChange={(event) => updateNote(meta.id, { title: event.target.value })} />
        <div className="document-actions">
          <button className={meta.isFavorite ? 'state-button active' : 'state-button'} onClick={() => toggleFavorite(meta.id)} title={meta.isFavorite ? '取消收藏' : '收藏'}><span>☆</span></button>
          <button className={meta.isPinned ? 'state-button active' : 'state-button'} onClick={() => togglePin(meta.id)} title={meta.isPinned ? '取消固定' : '固定'}><span>📌</span></button>
          <span className="document-divider" />
          <button className="plain-action" onClick={() => setIsPropertiesOpen(true)} title="属性">i</button>
          <button className="plain-action" onClick={exportedFile} title="下载">⬇</button>
        </div>
      </header>
      <div className="markdown-toolbar">
        <div className="markdown-buttons">{MARKDOWN_ACTIONS.map((action) => (<button key={action.title} className="markdown-button" title={action.title} onClick={() => insertMarkdown(action.before, action.after, action.sample)}>{action.label}</button>))}</div>
        <button className={isPreviewVisible ? 'preview-toggle active' : 'preview-toggle'} onClick={() => setIsPreviewVisible(!isPreviewVisible)}>👁 预览</button>
      </div>
      <div className={isPreviewVisible ? 'split-editor' : 'split-editor no-preview'}>
        <div className="markdown-editor-pane" style={{ flexBasis: isPreviewVisible ? `${editorWidth}%` : '100%' }}>
          <textarea
            ref={textareaRef}
            value={note.content ?? ''}
            onChange={(event) => updateContent(event.target.value)}
            spellCheck={false}
            className={jumpLine ? 'editor-textarea jump-line' : 'editor-textarea'}
          />
        </div>
        {isPreviewVisible && (<><div className="editor-resizer" onMouseDown={startResize} role="separator" aria-orientation="vertical"><span /></div><article className="markdown-preview-pane" style={{ flexBasis: `${100 - editorWidth}%` }} dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content ?? '') }} /></>)}
      </div>
      <footer className="document-statusbar">
        <span>字数 {meta.wordCount}</span>
        <span>行 {note.content.split('\n').length}</span>
        <span className="status-saved">● 已保存{jumpLine ? ` · 跳转到第 ${jumpLine} 行` : ''}</span>
        <span>最后编辑：{new Date(meta.updatedAt).toLocaleString('zh-CN')}</span>
      </footer>
      {isPropertiesOpen && (<aside className="note-properties-drawer">{/* unchanged */}</aside>)}
      {tagModalOpen && (<div className="tag-modal-backdrop" onClick={() => setTagModalOpen(false)}><div className="tag-modal" onClick={(event) => event.stopPropagation()}><div className="tag-modal-header"><h3>添加标签</h3><button onClick={() => setTagModalOpen(false)}>×</button></div><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="输入新标签名称" autoFocus /><div className="tag-modal-actions"><button className="ghost-btn" onClick={() => setTagModalOpen(false)}>取消</button><button className="primary-btn" onClick={() => addTag(tagDraft)}>添加</button></div></div></div>)}
    </section>
  );
}
