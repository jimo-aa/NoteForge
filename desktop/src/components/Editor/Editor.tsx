import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { useStore } from '../../stores/context';
import { renderMarkdown, formatTable, TABLE_CELL_KEYS } from '@/utils/markdown';
import { VersionControlModal } from '@/components/Modals/VersionControlModal';
import { Icon } from '@/components/Common/Icon';
import { AttachmentPanel } from '@/components/Editor/AttachmentPanel';
import { CodeMirrorEditor, type CodeMirrorHandle } from './CodeMirrorEditor';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';


const MARKDOWN_ACTIONS = [
  { label: 'B', title: '粗体', before: '**', after: '**' },
  { label: 'I', title: '斜体', before: '*', after: '*' },
  { label: 'S', title: '删除线', before: '~~', after: '~~' },
  { label: '`', title: '行内代码', before: '`', after: '`' },
  { label: 'H', title: '标题', before: '## ', after: '' },
  { label: '•', title: '无序列表', before: '- ', after: '' },
  { label: '1.', title: '有序列表', before: '1. ', after: '' },
  { label: '□', title: '任务', before: '- [ ] ', after: '' },
  { label: '“', title: '引用', before: '> ', after: '' },
  { label: '</>', title: '代码块', before: '```\n', after: '\n```' },
  { label: '🔗', title: '链接', before: '[', after: '](https://)' },
  { label: '▦', title: '表格', before: '\n| 列1 | 列2 | 列3 |\n|---|---|---|\n| | | |\n', after: '' },
  { label: '—', title: '分割线', before: '\n---\n', after: '' },
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
    selectNote,
    searchQuery,
  } = useStore();

  const note = currentNote;
  const cmRef = useRef<CodeMirrorHandle>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedSnapshotRef = useRef('');
  const restoreCursorRef = useRef<{ start: number; end: number } | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [editorWidth, setEditorWidth] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [jumpLine, setJumpLine] = useState<number | null>(null);
  const [versionControlOpen, setVersionControlOpen] = useState(false);
  const [attachmentPanelOpen, setAttachmentPanelOpen] = useState(false);
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

  useLayoutEffect(() => {
    if (!note || !restoreCursorRef.current) return;
    const { start, end } = restoreCursorRef.current;
    cmRef.current?.focus();
    cmRef.current?.setSelection(start, end);
  }, [note?.meta.id]);

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
      const targetLine = Math.max(1, detail.line);
      const lines = note.content.split('\n');
      const targetIndex = lines.slice(0, targetLine - 1).reduce((acc, line) => acc + line.length + 1, 0);
      setJumpLine(targetLine);
      setIsPreviewVisible(true);
      cmRef.current?.focus();
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

  const renderedHtml = useMemo(() => note ? renderMarkdown(note.content ?? '', searchQuery) : '', [note?.content, searchQuery]);

  // ── Syntax highlight for preview ──
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!renderedHtml || !previewRef.current) return;
    const codes = previewRef.current.querySelectorAll<HTMLElement>('pre code[class*="language-"]');
    codes.forEach((el) => {
      hljs.highlightElement(el);
    });
  }, [renderedHtml]);

  // ── Wiki Link 导航 ──
  const [backlinks, setBacklinks] = useState<Array<{sourceId: string; sourceTitle: string}>>([]);
  const [backlinksLoading, setBacklinksLoading] = useState(false);
  const [hoveredWikiLink, setHoveredWikiLink] = useState<{title: string; x: number; y: number} | null>(null);
  const [hoverPreviewContent, setHoverPreviewContent] = useState<string | null>(null);

  // 加载反向链接
  useEffect(() => {
    if (!note) { setBacklinks([]); return; }
    setBacklinksLoading(true);
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<Array<{sourceId: string; sourceTitle: string}>>('get_backlinks_with_titles', { noteId: note.meta.id })
        .then((result) => { setBacklinks(result ?? []); })
        .catch(() => { setBacklinks([]); })
        .finally(() => setBacklinksLoading(false));
    });
  }, [note?.meta.id]);

  const updateContent = (content: string) => {
    if (!note) return;
    updateNote(note.meta.id, { content });
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      if (cmRef.current) {
        const sel = cmRef.current.getSelection();
        restoreCursorRef.current = { start: sel.from, end: sel.to };
      }
      saveDraft(note.meta.id, content);
      lastSavedSnapshotRef.current = content;
    }, 300);
  };

  // 处理预览区点击：Wiki Link 导航 + 任务列表切换 + 代码复制
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;

    // —— Wiki Link 导航 ——
    const wikiBtn = target.closest('.wiki-link') as HTMLElement | null;
    if (wikiBtn && wikiBtn.textContent) {
      e.preventDefault();
      const title = wikiBtn.textContent.trim();
      const found = notes.find((n) => n.meta.title.toLowerCase() === title.toLowerCase());
      if (found) {
        selectNote(found.meta.id);
        showToast('info', `已跳转到「${found.meta.title}」`);
      } else {
        showToast('error', `未找到笔记「${title}」`);
      }
      return;
    }

    // —— 任务列表复选框切换 ——
    const taskCheckbox = target.closest('.task-checkbox') as HTMLElement | null;
    if (taskCheckbox) {
      e.preventDefault();
      const isChecked = taskCheckbox.getAttribute('data-checked') === 'true';
      // Toggle the checkbox by updating the note content
      if (!note || !cmRef.current) return;
      const content = cmRef.current.getContent();
      const lines = content.split('\n');
      // Simple approach: find any task line near where the click happened
      const previewPane = target.closest('.markdown-preview-pane');
      if (!previewPane) return;
      // Walk through rendered HTML to find which task line was clicked
      const allItems = previewPane.querySelectorAll('.task-list li');
      allItems.forEach((li, idx) => {
        if (li.contains(taskCheckbox)) {
          // Find the corresponding line in the source
          let taskCount = -1;
          for (let i = 0; i < lines.length; i++) {
            const taskMatch = lines[i]?.match(/^(- \[[ xX]\] )/);
            if (taskMatch) {
              taskCount++;
              if (taskCount === idx) {
                const toggled = isChecked ? lines[i]!.replace('- [x] ', '- [ ] ').replace('- [X] ', '- [ ] ') : lines[i]!.replace('- [ ] ', '- [x] ');
                if (toggled !== lines[i]) {
                  lines[i] = toggled;
                  updateContent(lines.join('\n'));
                  cmRef.current?.setContent(lines.join('\n'));
                  showToast('success', isChecked ? '已标记未完成' : '已标记完成');
                }
                return;
              }
            }
          }
        }
      });
      return;
    }

    // —— 代码复制 ——
    const copyBtn = target.closest('.code-copy-btn') as HTMLElement | null;
    if (copyBtn) {
      e.preventDefault();
      const code = copyBtn.getAttribute('data-code') || '';
      void navigator.clipboard.writeText(code).then(() => {
        showToast('success', '代码已复制');
      }).catch(() => {
        showToast('error', '复制失败');
      });
      return;
    }
  }, [notes, selectNote, showToast, note, updateContent]);

  // 处理 Wiki Link 悬停预览
  const handlePreviewMouseOver = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const wikiBtn = target.closest('.wiki-link') as HTMLElement | null;
    if (!wikiBtn || !wikiBtn.textContent) {
      setHoveredWikiLink(null);
      setHoverPreviewContent(null);
      return;
    }
    const title = wikiBtn.textContent.trim();
    const found = notes.find((n) => n.meta.title.toLowerCase() === title.toLowerCase());
    if (found) {
      const preview = found.content.length > 200 ? found.content.slice(0, 200) + '...' : found.content;
      setHoverPreviewContent(preview);
      setHoveredWikiLink({ title, x: e.clientX, y: e.clientY });
    } else {
      setHoveredWikiLink({ title, x: e.clientX, y: e.clientY });
      setHoverPreviewContent(null);
    }
  }, [notes]);

  const persistCursor = () => {
    if (!note || !cmRef.current) return;
    const sel = cmRef.current.getSelection();
    restoreCursorRef.current = { start: sel.from, end: sel.to };
    saveCursor(note.meta.id, { start: sel.from, end: sel.to });
  };

  const openWikiSuggestions = () => {
    if (!note || !cmRef.current) return;
    const before = cmRef.current.getContentBeforeCursor();
    const match = before.match(/\[\[([^[\]]*)$/);
    if (!match) {
      setWikiOpen(false);
      return;
    }
    const query = match[1]!;
    const suggestions = wikiCandidates.filter((title) => title.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
    setWikiQuery(query);
    setWikiSuggestions(suggestions);
    setWikiActiveIndex(0);
    setWikiOpen(true);
  };

  const closeWikiSuggestions = () => setWikiOpen(false);

  const commitWikiLink = (title: string) => {
    if (!note || !cmRef.current) return;
    const before = cmRef.current.getContentBeforeCursor();
    const content = cmRef.current.getContent();
    const sel = cmRef.current.getSelection();
    const after = content.slice(sel.to);
    const replaced = before.replace(/\[\[([^[\]]*)$/, `[[${title}`);
    const next = `${replaced}]]${after}`;
    updateContent(next);
    cmRef.current.setContent(next);
    cmRef.current.focus();
    closeWikiSuggestions();
  };

  const insertMarkdown = (before: string, after: string) => {
    if (!note || !cmRef.current) return;
    const sel = cmRef.current.getSelection();
    const content = cmRef.current.getContent();
    const selected = content.slice(sel.from, sel.to) || 'text';
    const next = `${content.slice(0, sel.from)}${before}${selected}${after}${content.slice(sel.to)}`;
    updateContent(next);
    cmRef.current.setContent(next);
    cmRef.current.focus();
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

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      cmRef.current?.insertTextAtCursor(`![${file.name}](${dataUrl})`);
      showToast('success', '已插入图片');
    };
    reader.readAsDataURL(file);
  };
  const handleImagePaste = (file: File) => insertImage(file);
  const handleImageDrop = (file: File) => insertImage(file);

  const handleFormatTable = () => {
    if (!note || !cmRef.current) return;
    const content = cmRef.current.getContent();
    const sel = cmRef.current.getSelection();
    // Find the table around cursor: scan backward for start of table, forward for end
    const lines = content.split('\n');
    const cursorLine = content.slice(0, sel.from).split('\n').length - 1;
    let tableStart = -1;
    let tableEnd = -1;
    for (let i = cursorLine; i >= 0; i--) {
      if (lines[i]?.trim().startsWith('|')) { tableStart = i; break; }
    }
    if (tableStart === -1) {
      // Try selected text
      const selected = content.slice(sel.from, sel.to);
      if (selected && selected.includes('|')) {
        const formatted = formatTable(selected);
        if (formatted !== selected) {
          const next = content.slice(0, sel.from) + formatted + content.slice(sel.to);
          updateContent(next);
          cmRef.current.setContent(next);
          showToast('success', '表格已格式化');
        }
        return;
      }
      showToast('info', '请将光标放在表格行上');
      return;
    }
    for (let i = tableStart; i < lines.length; i++) {
      if (lines[i]?.trim().startsWith('|')) { tableEnd = i; } else { break; }
    }
    const tableText = lines.slice(tableStart, tableEnd + 1).join('\n');
    const formatted = formatTable(tableText);
    if (formatted !== tableText) {
      const before = lines.slice(0, tableStart).join('\n');
      const after = lines.slice(tableEnd + 1).join('\n');
      const next = before + (before ? '\n' : '') + formatted + (after ? '\n' : '') + after;
      updateContent(next);
      cmRef.current.setContent(next);
      showToast('success', '表格已格式化');
    } else {
      showToast('info', '表格已经对齐');
    }
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent) => {
    if (wikiOpen) {
      if (event.key === 'Escape') { event.preventDefault(); closeWikiSuggestions(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); setWikiActiveIndex((index) => Math.min(index + 1, Math.max(0, wikiSuggestions.length - 1))); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setWikiActiveIndex((index) => Math.max(0, index - 1)); return; }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (wikiSuggestions.length) {
          event.preventDefault();
          commitWikiLink(wikiSuggestions[wikiActiveIndex] ?? wikiSuggestions[0]!);
          return;
        }
      }
    }
  };

  if (!note) {
    return (
      <section className="editor-workspace">
        <div className="empty-state">
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
          <button className={meta.isFavorite ? 'state-button active' : 'state-button'} onClick={() => toggleFavorite(meta.id)} title={meta.isFavorite ? '取消收藏' : '收藏'}><Icon type="shoucang" /></button>
          <button className={meta.isPinned ? 'state-button active' : 'state-button'} onClick={() => togglePin(meta.id)} title={meta.isPinned ? '取消固定' : '固定'}><Icon type="gudin" /></button>
          <span className="document-divider" />
          <button className="plain-action" onClick={() => setIsPropertiesOpen(true)} title="属性">i</button>
          <button className="plain-action" onClick={() => { clearDraft(meta.id); showToast('success', '草稿已清除'); }} title="清除草稿">↺</button>
          <button className="plain-action" onClick={exportedFile} title="下载">⬇</button>
          <button className={attachmentPanelOpen ? 'state-button active' : 'plain-action'} onClick={() => setAttachmentPanelOpen((v) => !v)} title="附件">📎</button>
        </div>
      </header>
      <div className="markdown-toolbar">
        <div className="markdown-buttons">
          {MARKDOWN_ACTIONS.map((action) => (
            <button key={action.title} className="markdown-button" title={action.title} onClick={() => insertMarkdown(action.before, action.after)}>
              {action.label}
            </button>
          ))}
          <button className="markdown-button" title="格式化表格（对齐列宽）" onClick={handleFormatTable}>
            ⊞ 表格
          </button>
        </div>
        <button className={isPreviewVisible ? 'preview-toggle active' : 'preview-toggle'} onClick={() => setIsPreviewVisible(!isPreviewVisible)}>👁 预览</button>
      </div>
      <div className={isPreviewVisible ? 'split-editor' : 'split-editor no-preview'}>
        <div className="markdown-editor-pane" style={{ flexBasis: isPreviewVisible ? `${editorWidth}%` : '100%' }}>
          <CodeMirrorEditor
            ref={cmRef}
            initialContent={note.content ?? ''}
            onChange={(next) => {
              updateContent(next);
              if (wikiOpen) openWikiSuggestions();
            }}
            onSelectionChange={() => {
              persistCursor();
              if (wikiOpen) openWikiSuggestions();
            }}
            onImagePaste={handleImagePaste}
            onImageDrop={handleImageDrop}
          />
          {wikiOpen && (
            <div className="wiki-autocomplete" onKeyDown={handleEditorKeyDown}>
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
            <article
              ref={previewRef}
              className="markdown-preview-pane"
              style={{ flexBasis: `${100 - editorWidth}%` }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              onClick={handlePreviewClick}
              onMouseOver={handlePreviewMouseOver}
              onMouseOut={() => { setHoveredWikiLink(null); setHoverPreviewContent(null); }}
            />
            {/* Wiki Link 悬停预览 */}
            {hoveredWikiLink && (
              <div
                className="wiki-link-preview"
                style={{ left: hoveredWikiLink.x - 300, top: hoveredWikiLink.y + 16 }}
              >
                <div className="wiki-link-preview-title">{hoveredWikiLink.title}</div>
                {hoverPreviewContent ? (
                  <div className="wiki-link-preview-content">{hoverPreviewContent}</div>
                ) : (
                  <div className="wiki-link-preview-empty">未找到笔记</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {attachmentPanelOpen && (
        <div className="editor-attachment-section">
          <AttachmentPanel noteId={meta.id} />
        </div>
      )}
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
          <div className="drawer-header">
            <h3>笔记属性</h3>
            <button onClick={() => setIsPropertiesOpen(false)}>×</button>
          </div>
          <section>
            <div className="property-row"><span>标题</span><strong>{meta.title}</strong></div>
            <div className="property-row"><span>创建时间</span><strong>{new Date(meta.createdAt).toLocaleString('zh-CN')}</strong></div>
            <div className="property-row"><span>更新时间</span><strong>{new Date(meta.updatedAt).toLocaleString('zh-CN')}</strong></div>
            <div className="property-row"><span>字数</span><strong>{meta.wordCount}</strong></div>
            <div className="property-row"><span>标签</span><strong>{currentTags.length ? currentTags.join('、') : '无'}</strong></div>
            <div className="property-row"><span>收藏</span><strong>{meta.isFavorite ? '是' : '否'}</strong></div>
            <div className="property-row"><span>固定</span><strong>{meta.isPinned ? '是' : '否'}</strong></div>
          </section>
          {/* 反向链接面板 */}
          <div className="backlinks-section">
            <h4>反向链接 ({backlinks.length})</h4>
            {backlinksLoading ? (
              <div className="backlinks-loading">加载中...</div>
            ) : backlinks.length === 0 ? (
              <div className="backlinks-empty">没有笔记引用此笔记</div>
            ) : (
              <ul className="backlinks-list">
                {backlinks.map((bl) => (
                  <li key={bl.sourceId} className="backlinks-item">
                    <button
                      className="backlinks-link"
                      onClick={() => { selectNote(bl.sourceId); setIsPropertiesOpen(false); }}
                    >
                      {bl.sourceTitle}
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
