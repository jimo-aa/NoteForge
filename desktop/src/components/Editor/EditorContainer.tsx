// NoteForge — Editor Container
// Top-level coordinator for the editor module.
// Operates in source+preview dual-pane mode (双栏编辑模式).
// Integrates: EditorToolbar, EditorTabs, DocumentHeader, StatusBar,
// SourceEditor, AIToolbar, AttachmentPanel.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/stores/context';
import { renderMarkdown, formatTable } from '@/utils/markdown';
import { SourceEditor } from './source/SourceEditor';
import { WysiwygEditor } from './wysiwyg/WysiwygEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorTabs } from './EditorTabs';
import { DocumentHeader } from './DocumentHeader';
import { StatusBar } from './StatusBar';
import { AIToolbar } from './AIToolbar';
import { AttachmentPanel } from './AttachmentPanel';
import type { EditorMode, EditorHandle, BacklinkEntry } from './types/editor';
import { getPluginRegistry } from './plugins/registry';
import type { ToolbarItemDef } from './plugins/types';
import { renderMathBlocks } from '@/utils/mathRenderer';
import mermaid from 'mermaid';

const MODE_STORAGE_KEY = 'noteforge:editor:mode';

export function EditorContainer() {
  const { t } = useTranslation();
  const {
    notes,
    currentNote,
    externalFile,
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
    saveCursor,
    loadCursor,
    selectNote,
    closeExternalFile,
    searchQuery,
    setSearchQuery,
    saveStatus,
    lastSavedAt,
  } = useStore();

  // If an external file is open, use that instead of the current note
  const isExternalFile = externalFile !== null;
  const note = isExternalFile
    ? { meta: { id: externalFile.path, title: externalFile.title, tags: [] as string[], isPinned: false, isFavorite: false, wordCount: 0, version: 1, createdAt: 0, updatedAt: 0, notebookId: null }, content: externalFile.content, contentPlain: '' }
    : currentNote;

  // Stabilize note ID reference for effects that must not loop on every render.
  const noteIdRef = useRef(note?.meta?.id);
  noteIdRef.current = note?.meta?.id;
  const editorRef = useRef<EditorHandle>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef('');
  const restoreCursorRef = useRef<{ start: number; end: number } | null>(null);

  // ── Editor mode (WYSIWYG or Source), persisted in localStorage ──
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'wysiwyg' || stored === 'source') return stored;
    } catch { /* ignore */ }
    return 'wysiwyg'; // default to WYSIWYG
  });
  const toggleEditorMode = useCallback(() => {
    setEditorMode((prev) => {
      const next: EditorMode = prev === 'wysiwyg' ? 'source' : 'wysiwyg';
      try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Local state ──
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [editorWidth, setEditorWidth] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [jumpLine, setJumpLine] = useState<number | null>(null);
  const [attachmentPanelOpen, setAttachmentPanelOpen] = useState(false);
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiSuggestions, setWikiSuggestions] = useState<string[]>([]);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiActiveIndex, setWikiActiveIndex] = useState(0);

  // ── AI Toolbar state ──
  const [aiSelectedText, setAiSelectedText] = useState('');
  const [aiToolbarPos, setAiToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [aiToolbarVisible, setAiToolbarVisible] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // ── Backlinks state ──
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);
  const [backlinksLoading, setBacklinksLoading] = useState(false);
  const [hoveredWikiLink, setHoveredWikiLink] = useState<{ title: string; x: number; y: number } | null>(null);
  const [hoverPreviewContent, setHoverPreviewContent] = useState<string | null>(null);

  // ── Wiki candidates ──
  const wikiCandidates = useMemo(() => notes.map((item) => item.meta.title).filter(Boolean), [notes]);

  // ── Plugin registry ──
  const pluginRegistry = useMemo(() => getPluginRegistry(), []);

  // ── Plugin toolbar items (merged into toolbar) ──
  const pluginToolbarItems = useRef<Array<{ id: string; label: string; icon?: string; action: () => void }>>([]);
  useEffect(() => {
    const items = pluginRegistry.getAllToolbarItems();
    pluginToolbarItems.current = items.map((item: ToolbarItemDef) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      action: item.action,
    }));
  }, [pluginRegistry]);

  // ── Local preview content (drives preview independently of store) ──
  const [localPreviewContent, setLocalPreviewContent] = useState(note?.content ?? '');
  useEffect(() => {
    if (note) setLocalPreviewContent(note.content);
  }, [note?.meta.id]);

  // ── Render Markdown for preview (with plugin hooks) — only used in source mode ──
  const renderedHtml = useMemo(() => {
    if (editorMode !== 'source') return '';
    let content = localPreviewContent;

    // Run onBeforeOutput hooks (content transformation)
    const beforeOutputResults = pluginRegistry.runHookSync('onBeforeOutput', content);
    for (const result of beforeOutputResults) {
      if (typeof result === 'string') content = result;
    }

    let html = renderMarkdown(content, searchQuery);

    // Run onMarkdownToHtml hooks (HTML transformation)
    const mdToHtmlResults = pluginRegistry.runHookSync('onMarkdownToHtml', html);
    for (const result of mdToHtmlResults) {
      if (typeof result === 'string') html = result;
    }

    return html;
  }, [editorMode, localPreviewContent, searchQuery, pluginRegistry]);

  // ── Syntax highlight for preview (source mode only) ──
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editorMode !== 'source' || !renderedHtml || !previewRef.current) return;
    let cancelled = false;
    void import('highlight.js/lib/core').then(async (hljsCore) => {
      const { default: markdown } = await import('highlight.js/lib/languages/markdown');
      const { default: javascript } = await import('highlight.js/lib/languages/javascript');
      const { default: typescript } = await import('highlight.js/lib/languages/typescript');
      const { default: python } = await import('highlight.js/lib/languages/python');
      const { default: rust } = await import('highlight.js/lib/languages/rust');
      const { default: css } = await import('highlight.js/lib/languages/css');
      const { default: json } = await import('highlight.js/lib/languages/json');
      const { default: bash } = await import('highlight.js/lib/languages/bash');
      const { default: xml } = await import('highlight.js/lib/languages/xml');
      await import('highlight.js/styles/github.css');

      hljsCore.default.registerLanguage('markdown', markdown);
      hljsCore.default.registerLanguage('javascript', javascript);
      hljsCore.default.registerLanguage('typescript', typescript);
      hljsCore.default.registerLanguage('python', python);
      hljsCore.default.registerLanguage('rust', rust);
      hljsCore.default.registerLanguage('css', css);
      hljsCore.default.registerLanguage('json', json);
      hljsCore.default.registerLanguage('bash', bash);
      hljsCore.default.registerLanguage('xml', xml);

      if (cancelled || !previewRef.current) return;
      const codes = previewRef.current.querySelectorAll<HTMLElement>('pre code[class*="language-"]');
      codes.forEach((el) => { hljsCore.default.highlightElement(el); });
    });
    return () => { cancelled = true; };
  }, [editorMode, renderedHtml]);

  // ── Mermaid diagram + KaTeX math rendering (source mode only) ──
  const mermaidReadyRef = useRef(false);
  useEffect(() => {
    if (editorMode !== 'source' || !renderedHtml || !previewRef.current) return;
    const el = previewRef.current;

    // Init mermaid once
    if (!mermaidReadyRef.current) {
      try {
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
        mermaidReadyRef.current = true;
      } catch (e) {
        console.error('[Mermaid] init failed:', e);
      }
    }

    // Render mermaid and math blocks
    const timer = setTimeout(async () => {
      const mermaidBlocks = el.querySelectorAll<HTMLElement>('.mermaid-block');
      for (const block of mermaidBlocks) {
        const pre = block.querySelector('pre.mermaid-src');
        if (!pre) continue;
        const rawCode = pre.textContent || '';
        if (!rawCode) continue;
        const code = rawCode.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
        const id = 'mermaid-' + Date.now();
        try {
          const result = await mermaid.render(id, code);
          const svg = result.svg ?? result;
          if (svg && typeof svg === 'string') {
            block.innerHTML = svg;
            block.classList.remove('mermaid-block');
            block.classList.add('mermaid-rendered');
          }
        } catch (e) {
          console.error('[Mermaid] render error:', e);
        }
      }

      // Render math blocks
      const mathBlocks = el.querySelectorAll('.math-block[data-latex]');
      if (mathBlocks.length > 0) renderMathBlocks(el);
    }, 100);

    return () => clearTimeout(timer);
  }, [editorMode, renderedHtml]);

  // ── Load backlinks ──
  useEffect(() => {
    if (!note) { setBacklinks([]); return; }
    setBacklinksLoading(true);
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<BacklinkEntry[]>('get_backlinks_with_titles', { noteId: note.meta.id })
        .then((result) => { setBacklinks(result ?? []); })
        .catch(() => { setBacklinks([]); })
        .finally(() => setBacklinksLoading(false));
    });
    // Only depend on note ID — not the full note object (which changes on every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.meta.id]);

  // ── Edit actions ──
  const updateContent = useCallback((content: string) => {
    setLocalPreviewContent(content);
    if (!note) return;
    updateNote(note.meta.id, { content });
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      if (editorRef.current) {
        const sel = editorRef.current.getSelection();
        restoreCursorRef.current = { start: sel.from, end: sel.to };
      }
      saveDraft(note.meta.id, content);
      lastSavedSnapshotRef.current = content;
    }, 300);
  }, [note, updateNote, saveDraft]);

  // ── Cursor restoration (source mode only) ──
  useLayoutEffect(() => {
    if (editorMode !== 'source' || !note) return;
    const saved = loadCursor(note.meta.id);
    if (saved) {
      editorRef.current?.focus();
      editorRef.current?.setSelection(saved.start, saved.end);
    }
    // Only depend on note ID — not the full note object (changes on every render causing loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode, loadCursor, note?.meta.id]);

  // ── Draft restoration ──
  useEffect(() => {
    if (!note) return;
    const draft = loadDraft(note.meta.id);
    if (draft && draft !== note.content) {
      updateNote(note.meta.id, { content: draft });
      showToast('info', t('note.draftRestored'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDraft, note?.meta.id, showToast, updateNote, t]);

  // ── Draft persistence ──
  useEffect(() => {
    if (!note) return;
    if (lastSavedSnapshotRef.current === note.content) return;
    lastSavedSnapshotRef.current = note.content;
    saveDraft(note.meta.id, note.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.meta.id, saveDraft]);

  // ── Jump to line listener (source mode) ──
  useEffect(() => {
    const onJump = (event: Event) => {
      const detail = (event as CustomEvent<{ noteId: string; line: number }>).detail;
      if (!detail || !note || detail.noteId !== note.meta.id) return;
      const targetLine = Math.max(1, detail.line);
      setJumpLine(targetLine);
      setIsPreviewVisible(true);
      editorRef.current?.focus();
      setTimeout(() => setJumpLine((current) => (current === targetLine ? null : current)), 1800);
    };
    window.addEventListener('noteforge:jump-to-hit', onJump as EventListener);
    return () => window.removeEventListener('noteforge:jump-to-hit', onJump as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.meta.id, setIsPreviewVisible]);

  // ── AI Toolbar handlers ──
  const handleEditorSelectionChange = useCallback((from: number, to: number, selectedText?: string) => {
    if (!note) return;
    let text = selectedText;
    if (!text && editorRef.current) {
      try { text = note.content.slice(from, to); } catch { text = ''; }
    }
    if (text && text.length > 0 && text.length <= 5000) {
      setAiSelectedText(text);
      const domSel = window.getSelection();
      if (domSel && domSel.rangeCount > 0) {
        const r = domSel.getRangeAt(0).getBoundingClientRect();
        if (r && r.top > 0) {
          setAiToolbarPos({ top: r.top - 44, left: r.left });
        } else {
          setAiToolbarPos({ top: 60, left: 10 });
        }
      } else {
        setAiToolbarPos({ top: 60, left: 10 });
      }
      setAiToolbarVisible(text.length > 0 && text.length <= 2000);
    } else {
      const domSel = window.getSelection();
      if (domSel && !domSel.isCollapsed) {
        const domText = domSel.toString();
        if (domText.length > 0 && domText.length <= 2000) {
          setAiSelectedText(domText);
          try {
            const r = domSel.getRangeAt(0).getBoundingClientRect();
            if (r && r.top > 0) {
              setAiToolbarPos({ top: r.top - 44, left: r.left });
            }
          } catch { /* ignore */ }
          return;
        }
      }
      setAiToolbarVisible(false);
    }
  }, [note]);

  const handleAiInsert = useCallback((content: string, mode: 'replace' | 'append' | 'insertBelow') => {
    if (!editorRef.current) return;
    const sel = editorRef.current.getSelection();
    const currentContent = editorRef.current.getContent();
    switch (mode) {
      case 'replace':
        editorRef.current.insertText(content);
        break;
      case 'append':
        editorRef.current.insertTextAtCursor('\n' + content);
        break;
      case 'insertBelow': {
        const before = currentContent.slice(0, sel.to);
        const after = currentContent.slice(sel.to);
        const nextContent = before + '\n\n' + content + '\n' + after;
        editorRef.current.setContent(nextContent);
        break;
      }
    }
    editorRef.current.focus();
    setAiToolbarVisible(false);
    showToast('success', t('note.aiContentInserted'));
  }, [showToast, t]);

  // ── Preview click handler (source mode only) ──
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (editorMode !== 'source') return;
    const target = e.target as HTMLElement;

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

    const taskCheckbox = target.closest('.task-checkbox') as HTMLElement | null;
    if (taskCheckbox) {
      e.preventDefault();
      const isChecked = taskCheckbox.getAttribute('data-checked') === 'true';
      if (!note || !editorRef.current) return;
      const content = editorRef.current.getContent();
      const lines = content.split('\n');
      const previewPane = target.closest('.markdown-preview-pane');
      if (!previewPane) return;
      const allItems = previewPane.querySelectorAll('.task-list-item');
      allItems.forEach((li, idx) => {
        if (li.contains(taskCheckbox)) {
          let taskCount = -1;
          for (let i = 0; i < lines.length; i++) {
            const taskMatch = lines[i]?.match(/^(- \[[ xX]\] )/);
            if (taskMatch) {
              taskCount++;
              if (taskCount === idx) {
                const toggled = isChecked
                  ? lines[i]!.replace('- [x] ', '- [ ] ').replace('- [X] ', '- [ ] ')
                  : lines[i]!.replace('- [ ] ', '- [x] ');
                if (toggled !== lines[i]) {
                  lines[i] = toggled;
                  updateContent(lines.join('\n'));
                  editorRef.current?.setContent(lines.join('\n'));
                  showToast('success', isChecked ? t('note.taskIncompleted') : t('note.taskCompleted'));
                }
                return;
              }
            }
          }
        }
      });
      return;
    }

    const copyBtn = target.closest('.code-copy-btn') as HTMLElement | null;
    if (copyBtn) {
      e.preventDefault();
      const code = copyBtn.getAttribute('data-code') || '';
      void navigator.clipboard.writeText(code).then(() => {
        showToast('success', t('note.codeCopied'));
      }).catch(() => {
        showToast('error', t('note.copyFailed'));
      });
      return;
    }
  }, [editorMode, notes, selectNote, showToast, note, updateContent, t]);

  // ── Wiki Link hover preview (source mode only) ──
  const handlePreviewMouseOver = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (editorMode !== 'source') return;
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
  }, [editorMode, notes]);

  // ── Cursor persistence (source mode only) ──
  const persistCursor = useCallback(() => {
    if (editorMode !== 'source' || !note || !editorRef.current) return;
    const sel = editorRef.current.getSelection();
    restoreCursorRef.current = { start: sel.from, end: sel.to };
    saveCursor(note.meta.id, { start: sel.from, end: sel.to });
  }, [editorMode, note, saveCursor]);

  // ── Wiki suggestions (source mode only) ──
  const openWikiSuggestions = useCallback(() => {
    if (editorMode !== 'source' || !note || !editorRef.current) return;
    const before = editorRef.current.getContentBeforeCursor();
    const match = before.match(/\[\[([^[\]]*)$/);
    if (!match) { setWikiOpen(false); return; }
    const query = match[1]!;
    const suggestions = wikiCandidates.filter((title) => title.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
    setWikiQuery(query);
    setWikiSuggestions(suggestions);
    setWikiActiveIndex(0);
    setWikiOpen(true);
  }, [editorMode, note, wikiCandidates]);

  const closeWikiSuggestions = useCallback(() => setWikiOpen(false), []);

  const commitWikiLink = useCallback((title: string) => {
    if (editorMode !== 'source' || !note || !editorRef.current) return;
    const before = editorRef.current.getContentBeforeCursor();
    const content = editorRef.current.getContent();
    const sel = editorRef.current.getSelection();
    const after = content.slice(sel.to);
    const replaced = before.replace(/\[\[([^[\]]*)$/, `[[${title}`);
    const next = `${replaced}]]${after}`;
    updateContent(next);
    editorRef.current.setContent(next);
    editorRef.current.focus();
    closeWikiSuggestions();
  }, [editorMode, note, updateContent, closeWikiSuggestions]);

  // ── Toolbar actions (source mode only; WYSIWYG uses native TipTap commands) ──
  const insertMarkdown = useCallback((before: string, after: string) => {
    if (editorMode !== 'source' || !note || !editorRef.current) return;
    const sel = editorRef.current.getSelection();
    const content = editorRef.current.getContent();
    const selected = content.slice(sel.from, sel.to) || 'text';
    const next = `${content.slice(0, sel.from)}${before}${selected}${after}${content.slice(sel.to)}`;
    updateContent(next);
    editorRef.current.setContent(next);
    editorRef.current.focus();
  }, [editorMode, note, updateContent]);

  const handleFormatTable = useCallback(() => {
    if (editorMode !== 'source' || !note || !editorRef.current) return;
    const content = editorRef.current.getContent();
    const sel = editorRef.current.getSelection();
    const lines = content.split('\n');
    const cursorLine = content.slice(0, sel.from).split('\n').length - 1;
    let tableStart = -1;
    let tableEnd = -1;
    for (let i = cursorLine; i >= 0; i--) {
      if (lines[i]?.trim().startsWith('|')) { tableStart = i; break; }
    }
    if (tableStart === -1) {
      const selected = content.slice(sel.from, sel.to);
      if (selected && selected.includes('|')) {
        const formatted = formatTable(selected);
        if (formatted !== selected) {
          const next = content.slice(0, sel.from) + formatted + content.slice(sel.to);
          updateContent(next);
          editorRef.current.setContent(next);
          showToast('success', t('note.tableFormatted'));
        }
        return;
      }
      showToast('info', t('note.tableCursorHint'));
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
      editorRef.current.setContent(next);
      showToast('success', t('note.tableFormatted'));
    } else {
      showToast('info', t('note.tableAligned'));
    }
  }, [editorMode, note, updateContent, showToast, t]);

  // ── Export ──
  const exportedFile = useCallback(() => {
    if (!note) return;
    const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.meta.title || 'note'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', t('note.markdownDownloaded'));
  }, [note, showToast, t]);

  // ── Image insert ──
  const insertImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      editorRef.current?.insertTextAtCursor(`![${file.name}](${dataUrl})`);
      showToast('success', t('note.imageInserted'));
    };
    reader.readAsDataURL(file);
  }, [showToast, t]);

  const handleImagePaste = useCallback((file: File) => insertImage(file), [insertImage]);
  const handleImageDrop = useCallback((file: File) => insertImage(file), [insertImage]);

  // ── Resizer (source mode only) ──
  const startResize = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (editorMode !== 'source') return;
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
  }, [editorMode]);

  // ── Keyboard handler ──
  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (wikiOpen) {
      if (event.key === 'Escape') { event.preventDefault(); closeWikiSuggestions(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); setWikiActiveIndex((i) => Math.min(i + 1, Math.max(0, wikiSuggestions.length - 1))); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setWikiActiveIndex((i) => Math.max(0, i - 1)); return; }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (wikiSuggestions.length) {
          event.preventDefault();
          commitWikiLink(wikiSuggestions[wikiActiveIndex] ?? wikiSuggestions[0]!);
          return;
        }
      }
    }
  }, [wikiOpen, wikiSuggestions, wikiActiveIndex, closeWikiSuggestions, commitWikiLink]);

  // ── Empty state ──
  if (!note) {
    return (
      <section className="editor-workspace">
        <div className="empty-state">
          <h2>{t('note.selectNoteHint')}</h2>
          <p>{t('note.selectNoteDesc')}</p>
        </div>
      </section>
    );
  }

  const meta = note.meta;
  const currentTags = meta.tags ?? [];

  // ── Render ──
  return (
    <section className={isResizing ? 'editor-workspace is-resizing' : 'editor-workspace'}>
      {/* Tabs */}
      <EditorTabs
        tags={currentTags}
        onRemoveTag={(tag) => updateNote(meta.id, { tags: currentTags.filter((item) => item !== tag) })}
        onAddTag={() => setTagModalOpen(true)}
        onOpenVersionHistory={() => window.dispatchEvent(new CustomEvent('noteforge:open-version-history'))}
      />

      {/* External file banner */}
      {isExternalFile && externalFile && (
        <div className="external-file-banner">
          <span className="external-file-banner__icon">📄</span>
          <span className="external-file-banner__label">{t('editor.externalFileLabel')}</span>
          <span className="external-file-banner__path" title={externalFile.path}>{externalFile.path}</span>
          <button className="external-file-banner__close" onClick={closeExternalFile} title={t('common.close')}>
            ✕
          </button>
        </div>
      )}

      {/* Document header */}
      {!isExternalFile && (
        <DocumentHeader
          title={meta.title}
          isFavorite={meta.isFavorite ?? false}
          isPinned={meta.isPinned ?? false}
          onTitleChange={(title) => updateNote(meta.id, { title })}
          onToggleFavorite={() => toggleFavorite(meta.id)}
          onTogglePin={() => togglePin(meta.id)}
          onOpenProperties={() => setIsPropertiesOpen(true)}
          onClearDraft={() => { clearDraft(meta.id); showToast('success', t('note.draftCleared')); }}
          onExport={exportedFile}
          onToggleAttachment={() => setAttachmentPanelOpen((v) => !v)}
          isAttachmentOpen={attachmentPanelOpen}
        />
      )}

      {/* Toolbar */}
      <EditorToolbar
        editorMode={editorMode}
        onToggleMode={toggleEditorMode}
        onInsertMarkdown={insertMarkdown}
        onFormatTable={handleFormatTable}
        onTogglePreview={() => setIsPreviewVisible(!isPreviewVisible)}
        isPreviewVisible={isPreviewVisible}
        pluginItems={pluginToolbarItems.current}
      />

      {/* ── WYSIWYG Mode: single-pane, no preview (editor IS the rendered view) ── */}
      {editorMode === 'wysiwyg' && (
        <div className="split-editor" style={{ flex: 1, minHeight: 0 }}>
          <div className="wysiwyg-editor-pane" ref={editorContainerRef} style={{ width: '100%', height: '100%' }}>
            <WysiwygEditor
              ref={editorRef}
              noteKey={note?.meta.id ?? ''}
              initialContent={note.content ?? ''}
              searchQuery={searchQuery}
              pluginManager={pluginRegistry}
              onChange={(next) => {
                updateContent(next);
              }}
              onSelectionChange={(from, to, selectedText) => {
                handleEditorSelectionChange(from, to, selectedText);
              }}
            />
          </div>

          {/* WYSIWYG mode: AI toolbar overlays the editor */}
          <AIToolbar
            selectedText={aiSelectedText}
            noteContent={note.content}
            position={aiToolbarPos}
            onInsert={handleAiInsert}
            visible={aiToolbarVisible}
            onClose={() => setAiToolbarVisible(false)}
          />
        </div>
      )}

      {/* ── Source Mode: Dual-pane (editor + preview) ── */}
      {editorMode === 'source' && (
        <div className={isPreviewVisible ? 'split-editor' : 'split-editor no-preview'}>
          <div className="markdown-editor-pane" style={{ flexBasis: isPreviewVisible ? `${editorWidth}%` : '100%' }}>
            {/* Search bar */}
            {searchQuery && (
              <div className="editor-search-bar">
                <span className="editor-search-label">🔍 {searchQuery}</span>
                <button className="editor-search-close" title={t('note.clearSearch')} onClick={() => setSearchQuery('')}>✕</button>
              </div>
            )}

            <div ref={editorContainerRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <SourceEditor
                ref={editorRef}
                initialContent={note.content ?? ''}
                searchQuery={searchQuery}
                onChange={(next) => {
                  updateContent(next);
                  if (wikiOpen) openWikiSuggestions();
                }}
                onSelectionChange={(from, to) => {
                  persistCursor();
                  if (wikiOpen) openWikiSuggestions();
                  handleEditorSelectionChange(from, to);
                }}
                onImagePaste={handleImagePaste}
                onImageDrop={handleImageDrop}
                onWikiLinkClick={(title) => {
                  const found = notes.find((n) => n.meta.title.toLowerCase() === title.toLowerCase());
                  if (found) {
                    selectNote(found.meta.id);
                    showToast('info', t('note.jumpedToNote', { title: found.meta.title }));
                  } else {
                    showToast('error', t('note.noteNotFound', { title }));
                  }
                }}
              />

              <AIToolbar
                selectedText={aiSelectedText}
                noteContent={note.content}
                position={aiToolbarPos}
                onInsert={handleAiInsert}
                visible={aiToolbarVisible}
                onClose={() => setAiToolbarVisible(false)}
              />
            </div>

            {/* Wiki autocomplete */}
            {wikiOpen && (
              <div className="wiki-autocomplete" onKeyDown={handleEditorKeyDown}>
                <div className="wiki-autocomplete-header">Wiki Link {wikiQuery ? `：${wikiQuery}` : ''}</div>
                {wikiSuggestions.length ? wikiSuggestions.map((title, index) => (
                  <button
                    key={title}
                    className={index === wikiActiveIndex ? 'wiki-autocomplete-item active' : 'wiki-autocomplete-item'}
                    onMouseDown={(event) => { event.preventDefault(); commitWikiLink(title); }}
                  >
                    {title}
                  </button>
                )) : <div className="wiki-autocomplete-empty">{t('note.noWikiMatch')}</div>}
                <div className="wiki-autocomplete-empty">{t('note.wikiHint')}</div>
              </div>
            )}
          </div>

          {/* Preview panel (source mode only) */}
          {isPreviewVisible && (
            <>
              <div className="editor-resizer" onMouseDown={startResize} role="separator" aria-orientation="vertical"><span /></div>
              <article
                ref={(el) => {
                  (previewRef as React.MutableRefObject<HTMLElement | null>).current = el;
                  if (el) {
                    setTimeout(() => {
                      const math = el.querySelectorAll('.math-block[data-latex]');
                      if (math.length > 0) renderMathBlocks(el).catch(() => {});
                    }, 0);
                  }
                }}
                className="markdown-preview-pane"
                style={{ flexBasis: `${100 - editorWidth}%` }}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                onClick={handlePreviewClick}
                onMouseOver={handlePreviewMouseOver}
                onMouseOut={() => { setHoveredWikiLink(null); setHoverPreviewContent(null); }}
              />
              {hoveredWikiLink && (
                <div className="wiki-link-preview" style={{ left: hoveredWikiLink.x - 300, top: hoveredWikiLink.y + 16 }}>
                  <div className="wiki-link-preview-title">{hoveredWikiLink.title}</div>
                  {hoverPreviewContent ? (
                    <div className="wiki-link-preview-content">{hoverPreviewContent}</div>
                  ) : (
                    <div className="wiki-link-preview-empty">{t('note.noteNotFoundSimple')}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Attachment panel */}
      {attachmentPanelOpen && (
        <div className="editor-attachment-section">
          <AttachmentPanel noteId={meta.id} />
        </div>
      )}

      {/* Status bar */}
      <StatusBar
        wordCount={meta.wordCount}
        lineCount={note.content.split('\n').length}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        updatedAt={meta.updatedAt}
        jumpLine={jumpLine}
      />

      {/* Properties drawer */}
      {isPropertiesOpen && (
        <aside className="note-properties-drawer">
          <div className="drawer-header">
            <h3>{t('note.properties')}</h3>
            <button onClick={() => setIsPropertiesOpen(false)}>×</button>
          </div>
          <section>
            <div className="property-row"><span>{t('noteModal.titleLabel')}</span><strong>{meta.title}</strong></div>
            <div className="property-row"><span>{t('note.createdAt')}</span><strong>{new Date(meta.createdAt).toLocaleString()}</strong></div>
            <div className="property-row"><span>{t('note.updatedAt')}</span><strong>{new Date(meta.updatedAt).toLocaleString()}</strong></div>
            <div className="property-row"><span>{t('editor.chars')}</span><strong>{meta.wordCount}</strong></div>
            <div className="property-row"><span>{t('manage.tabTags')}</span><strong>{currentTags.length ? currentTags.join(', ') : t('common.no')}</strong></div>
            <div className="property-row"><span>{t('note.favorite')}</span><strong>{meta.isFavorite ? t('common.yes') : t('common.no')}</strong></div>
            <div className="property-row"><span>{t('note.pin')}</span><strong>{meta.isPinned ? t('common.yes') : t('common.no')}</strong></div>
          </section>
          <div className="backlinks-section">
            <h4>{t('note.backlinks')} ({backlinks.length})</h4>
            {backlinksLoading ? (
              <div className="backlinks-loading">{t('common.loading')}</div>
            ) : backlinks.length === 0 ? (
              <div className="backlinks-empty">{t('note.noBacklinks')}</div>
            ) : (
              <ul className="backlinks-list">
                {backlinks.map((bl) => (
                  <li key={bl.sourceId} className="backlinks-item">
                    <button className="backlinks-link" onClick={() => { selectNote(bl.sourceId); setIsPropertiesOpen(false); }}>
                      {bl.sourceTitle}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      )}

      {/* Tag modal */}
      {tagModalOpen && (
        <div className="tag-modal-backdrop" onClick={() => setTagModalOpen(false)}>
          <div className="tag-modal" onClick={(event) => event.stopPropagation()}>
            <div className="tag-modal-header">
              <h3>{t('manage.tabTags')}</h3>
              <button onClick={() => setTagModalOpen(false)}>×</button>
            </div>
            <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder={t('tag.inputPlaceholder')} autoFocus />
            <div className="tag-modal-actions">
              <button className="ghost-btn" onClick={() => setTagModalOpen(false)}>{t('common.cancel')}</button>
              <button className="primary-btn" onClick={() => {
                const cleanTag = tagDraft.trim().replace(/^#/, '');
                if (!cleanTag) return;
                if (currentTags.includes(cleanTag)) {
                  showToast('info', t('tag.tagExists'));
                  return;
                }
                updateNote(meta.id, { tags: [...currentTags, cleanTag] });
                setTagDraft('');
                setTagModalOpen(false);
              }}>{t('tag.addTag')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
