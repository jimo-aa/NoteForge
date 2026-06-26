import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../../stores/context';
import { renderMarkdown } from '@/utils/markdown';
import { VersionControlModal } from '@/components/Modals/VersionControlModal';


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
    isPreviewVisible,
    setIsPreviewVisible,
    setIsPropertiesOpen,
    isPropertiesOpen,
    showToast,
    saveDraft,
    loadDraft,
    clearDraft,
    restoreVersion,
    checkoutBranch,
    createBranch,
    saveCursor,
    loadCursor,
    searchQuery,
  } = useStore();

  const note = useMemo(() => currentNote, [currentNote]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedSnapshotRef = useRef('');
  const restoreCursorRef = useRef<{ start: number; end: number } | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [editorWidth, setEditorWidth] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [jumpLine, setJumpLine] = useState<number | null>(null);
  const [versionControlOpen, setVersionControlOpen] = useState(false);
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiSuggestions, setWikiSuggestions] = useState<string[]>([]);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiActiveIndex, setWikiActiveIndex] = useState(0);

  useEffect(() => {
    if (!note) return;
    const saved = loadCursor(note.meta.id);
    if (saved) restoreCursorRef.current = saved;
    const draft = loadDraft(note.meta.id);
    if (draft && draft !== note.content) {
      updateNote(note.meta.id, { content: draft });
      showToast('info', '已恢复草稿');
    }
  }, [loadCursor, loadDraft, note, showToast, updateNote]);

  useEffect(() => {
    if (!note) return;
    if (lastSavedSnapshotRef.current === note.content) return;
    lastSavedSnapshotRef.current = note.content;
    saveDraft(note.meta.id, note.content);
  }, [note, saveDraft]);

  useEffect(() => {
    const onJump = (event: Event) => {
      const detail = (event as CustomEvent<{ noteId: string; line: number; column: number }>).detail;
      if (!detail || !note || detail.noteId !== note.meta.id) return;
      const textarea = textareaRef.current;
      if (!textarea) return;
      const targetLine = Math.max(1, detail.line);
      const targetIndex = note.content.split('\n').slice(0, targetLine - 1).reduce((acc, line) => acc + line.length + 1, 0);
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

  const wikiCandidates = useMemo(() => notes.map((item) => item.meta.title).filter(Boolean), [notes]);

  const persistCursor = () => {
    const textarea = textareaRef.current;
    if (!textarea || !note) return;
    const selection = { start: textarea.selectionStart, end: textarea.selectionEnd };
    restoreCursorRef.current = selection;
    saveCursor(note.meta.id, selection);
  };

  const updateContent = (content: string) => {
    if (!note) return;
    updateNote(note.meta.id, { content });
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      const textarea = textareaRef.current;
      const selection = textarea ? { start: textarea.selectionStart, end: textarea.selectionEnd } : restoreCursorRef.current;
      if (selection) restoreCursorRef.current = selection;
      saveDraft(note.meta.id, content);
      lastSavedSnapshotRef.current = content;
      if (textarea && selection) {
        textarea.setSelectionRange(selection.start, selection.end);
      }
    }, 300);
  };

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const cursor = restoreCursorRef.current;
    if (!textarea || !cursor) return;
    textarea.setSelectionRange(cursor.start, cursor.end);
  }, [note?.meta.id]);

  const openWikiSuggestions = () => {
    if (!note) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const before = note.content.slice(0, textarea.selectionStart);
    const match = before.match(/\[\[([^[\]]*)$/);
    if (!match) {
      setWikiOpen(false);
      return;
    }
    const query = match[1];
    const suggestions = wikiCandidates.filter((title) => title.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
    setWikiQuery(query);
    setWikiSuggestions(suggestions);
    setWikiActiveIndex(0);
    setWikiOpen(true);
  };

  const closeWikiSuggestions = () => setWikiOpen(false);

  const commitWikiLink = (title: string) => {
    if (!note) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const before = note.content.slice(0, textarea.selectionStart);
    const after = note.content.slice(textarea.selectionEnd);
    const replaced = before.replace(/\[\[([^[\]]*)$/, `[[${title}`);
    const next = `${replaced}]]${after}`;
    updateContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = replaced.length + title.length + 2;
      textarea.setSelectionRange(cursor, cursor);
    });
    closeWikiSuggestions();
  };

  const insertMarkdown = (before: string, after: string, sample: string) => {
    if (!note) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = note.content.slice(start, end) || sample;
    const next = `${note.content.slice(0, start)}${before}${selected}${after}${note.content.slice(end)}`;
    updateContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizing(true);
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (moveEvent: MouseEvent) => {
      const next = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setEditorWidth(Math.min(72, Math.max(32, next)));
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const exportedFile = () => {
    if (!note) return;
    const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.meta.title || 'note'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', '已下载 Markdown 文件');
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      insertTextAtCursor(`![pasted-image](${dataUrl})`);
      showToast('success', '已插入粘贴图片');
    };
    reader.readAsDataURL(file);
  };

  const insertTextAtCursor = (text: string) => {
    if (!note) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${note.content.slice(0, start)}${text}${note.content.slice(end)}`;
    updateContent(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + text.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (wikiOpen) {
      if (event.key === 'Escape') { event.preventDefault(); closeWikiSuggestions(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); setWikiActiveIndex((index) => Math.min(index + 1, Math.max(0, wikiSuggestions.length - 1))); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setWikiActiveIndex((index) => Math.max(0, index - 1)); return; }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (wikiSuggestions.length) {
          event.preventDefault();
          commitWikiLink(wikiSuggestions[wikiActiveIndex] || wikiSuggestions[0]);
          return;
        }
      }
    }
    if (note && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveDraft(note.meta.id, note.content);
      showToast('success', '已手动保存');
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLTextAreaElement>) => {
    const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith('image/'));
    if (!image) return;
    event.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      insertTextAtCursor(`![${image.name}](${dataUrl})`);
      showToast('success', '已插入拖拽图片');
    };
    reader.readAsDataURL(image);
  };

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

  return (
    <section className={isResizing ? 'editor-workspace is-resizing' : 'editor-workspace'}>
      <div className="editor-tabs">
        {currentTags.map((tag) => (
          <button key={tag} className="editor-tab" onClick={() => updateNote(meta.id, { tags: currentTags.filter((item) => item !== tag) })} title="点击移除标签">
            <span>{tag}</span><span>×</span>
          </button>
        ))}
        <button className="editor-tab add" onClick={() => setTagModalOpen(true)}>＋ 添加标签</button>
        <button className="editor-tab add" onClick={() => setVersionControlOpen(true)}>⏱ 版本控制</button>
      </div>
      <header className="document-header">
        <input className="document-title" value={meta.title} onChange={(event) => updateNote(meta.id, { title: event.target.value })} />
        <div className="document-actions">
          <button className={meta.isFavorite ? 'state-button active' : 'state-button'} onClick={() => toggleFavorite(meta.id)} title={meta.isFavorite ? '取消收藏' : '收藏'}><span>☆</span></button>
          <button className={meta.isPinned ? 'state-button active' : 'state-button'} onClick={() => togglePin(meta.id)} title={meta.isPinned ? '取消固定' : '固定'}><span>📌</span></button>
          <span className="document-divider" />
          <button className="plain-action" onClick={() => setIsPropertiesOpen(true)} title="属性">i</button>
          <button className="plain-action" onClick={() => { clearDraft(meta.id); showToast('success', '草稿已清除'); }} title="清除草稿">↺</button>
          <button className="plain-action" onClick={exportedFile} title="下载">⬇</button>
        </div>
      </header>
      <div className="markdown-toolbar">
        <div className="markdown-buttons">
          {MARKDOWN_ACTIONS.map((action) => (
            <button key={action.title} className="markdown-button" title={action.title} onClick={() => insertMarkdown(action.before, action.after, action.sample)}>
              {action.label}
            </button>
          ))}
        </div>
        <button className={isPreviewVisible ? 'preview-toggle active' : 'preview-toggle'} onClick={() => setIsPreviewVisible(!isPreviewVisible)}>👁 预览</button>
      </div>
      <div className={isPreviewVisible ? 'split-editor' : 'split-editor no-preview'}>
        <div className="markdown-editor-pane" style={{ flexBasis: isPreviewVisible ? `${editorWidth}%` : '100%' }}>
          <textarea
            ref={textareaRef}
            value={note.content ?? ''}
            onChange={(event) => {
              updateContent(event.target.value);
              if (wikiOpen) openWikiSuggestions();
            }}
            onKeyDown={handleEditorKeyDown}
            spellCheck={false}
            className={jumpLine ? 'editor-textarea jump-line' : 'editor-textarea'}
            onBlur={persistCursor}
            onSelect={() => {
              persistCursor();
              if (wikiOpen) openWikiSuggestions();
            }}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
          />
          {wikiOpen && (
            <div className="wiki-autocomplete">
              <div className="wiki-autocomplete-header">Wiki Link {wikiQuery ? `：${wikiQuery}` : ''}</div>
              {wikiSuggestions.length ? wikiSuggestions.map((title, index) => (
                <button key={title} className={index === wikiActiveIndex ? 'wiki-autocomplete-item active' : 'wiki-autocomplete-item'} onMouseDown={(event) => { event.preventDefault(); commitWikiLink(title); }}>
                  {title}
                </button>
              )) : <div className="wiki-autocomplete-empty">没有匹配结果</div>}
              <div className="wiki-autocomplete-empty">提示：输入 [[标题 触发补全，Esc 关闭</div>
            </div>
          )}
        </div>
        {isPreviewVisible && (
          <>
            <div className="editor-resizer" onMouseDown={startResize} role="separator" aria-orientation="vertical"><span /></div>
            <article className="markdown-preview-pane" style={{ flexBasis: `${100 - editorWidth}%` }} dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content ?? '', searchQuery) }} />
          </>
        )}
      </div>
      <footer className="document-statusbar">
        <span>字数 {meta.wordCount}</span>
        <span>行 {note.content.split('\n').length}</span>
        <span className="status-saved">● 已保存{jumpLine ? ` · 跳转到第 ${jumpLine} 行` : ''}</span>
        <span>最后编辑：{new Date(meta.updatedAt).toLocaleString('zh-CN')}</span>
      </footer>
      <VersionControlModal
        open={versionControlOpen}
        noteId={meta.id}
        onClose={() => setVersionControlOpen(false)}
        onCheckoutVersion={(commitId) => restoreVersion(meta.id, commitId)}
        onCheckoutBranch={(branch) => checkoutBranch(meta.id, branch)}
        onCreateBranch={(branch, fromCommit) => createBranch(meta.id, branch, fromCommit)}
        onRestore={() => { /* note will be updated via store */ }}
      />
      {isPropertiesOpen && (
        <aside className="note-properties-drawer">
          <div className="properties-header">
            <h3>笔记属性</h3>
            <button onClick={() => setIsPropertiesOpen(false)}>×</button>
          </div>
          <div className="properties-content">
            <div className="property-row"><span>标题</span><strong>{meta.title}</strong></div>
            <div className="property-row"><span>创建时间</span><strong>{new Date(meta.createdAt).toLocaleString('zh-CN')}</strong></div>
            <div className="property-row"><span>更新时间</span><strong>{new Date(meta.updatedAt).toLocaleString('zh-CN')}</strong></div>
            <div className="property-row"><span>字数</span><strong>{meta.wordCount}</strong></div>
            <div className="property-row"><span>标签</span><strong>{currentTags.length ? currentTags.join('、') : '无'}</strong></div>
            <div className="property-row"><span>收藏</span><strong>{meta.isFavorite ? '是' : '否'}</strong></div>
            <div className="property-row"><span>固定</span><strong>{meta.isPinned ? '是' : '否'}</strong></div>
          </div>
        </aside>
      )}
      {tagModalOpen && (
        <div className="tag-modal-backdrop" onClick={() => setTagModalOpen(false)}>
          <div className="tag-modal" onClick={(event) => event.stopPropagation()}>
            <div className="tag-modal-header"><h3>添加标签</h3><button onClick={() => setTagModalOpen(false)}>×</button></div>
            <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="输入新标签名称" autoFocus />
            <div className="tag-modal-actions">
              <button className="ghost-btn" onClick={() => setTagModalOpen(false)}>取消</button>
              <button className="primary-btn" onClick={() => {
                const cleanTag = tagDraft.trim().replace(/^#/, '');
                if (!cleanTag) return;
                if (currentTags.includes(cleanTag)) {
                  showToast('info', '标签已存在');
                  return;
                }
                updateNote(meta.id, { tags: [...currentTags, cleanTag] });
                setTagDraft('');
                setTagModalOpen(false);
              }}>添加</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
