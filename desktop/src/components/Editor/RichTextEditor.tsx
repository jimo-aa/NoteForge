// NoteForge — Rich Text Editor (TipTap)
// Dual mode: Markdown source / WYSIWYG with slash commands, image resize,
// code block language selector, and search highlight.

import { useCallback, useImperativeHandle, forwardRef, useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent, type Extensions, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExtension from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';

const lowlight = createLowlight(common);
import { markdownToHtml, htmlToMarkdown } from '@/services/markdownConverter';
import { RichTextToolbar } from './RichTextToolbar';
import TextAlign from '@tiptap/extension-text-align';
import { checkAndShowSlashMenu } from './slashCommands';
import { createSearchHighlightPlugin } from './searchHighlight';

// Supported code languages for the language selector
const CODE_LANGUAGES = [
  { label: 'Plain Text', value: '' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'Rust', value: 'rust' },
  { label: 'Go', value: 'go' },
  { label: 'Java', value: 'java' },
  { label: 'CSS', value: 'css' },
  { label: 'HTML', value: 'html' },
  { label: 'JSON', value: 'json' },
  { label: 'Bash', value: 'bash' },
  { label: 'SQL', value: 'sql' },
  { label: 'YAML', value: 'yaml' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'C++', value: 'cpp' },
  { label: 'C#', value: 'csharp' },
];

export interface RichTextHandle {
  focus: () => void;
  getSelection: () => { from: number; to: number };
  getContentBeforeCursor: () => string;
  insertTextAtCursor: (text: string) => void;
  insertText: (text: string) => void;
  setContent: (content: string) => void;
  setSelection: (from: number, to: number) => void;
  getContent: () => string;
  wrapText: (before: string, after: string) => void;
}

interface RichTextEditorProps {
  initialContent: string;
  onChange: (text: string) => void;
  onSelectionChange?: (from: number, to: number, selectedText?: string) => void;
  placeholderText?: string;
  searchQuery?: string;
}

export const RichTextEditor = forwardRef<RichTextHandle, RichTextEditorProps>(
  function RichTextEditor(
    { initialContent, onChange, onSelectionChange, placeholderText = '...', searchQuery },
    ref,
  ) {
    const [mode, setMode] = useState<'wysiwyg' | 'source'>('wysiwyg');
    const [sourceContent, setSourceContent] = useState(initialContent);
    const isUpdatingFromSource = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const [resizeTarget, setResizeTarget] = useState<string | null>(null);
    const [resizeAlign, setResizeAlign] = useState<string | null>(null);
    const [codeBlockRect, setCodeBlockRect] = useState<DOMRect | null>(null);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const editorRef = useRef<Editor | null>(null);

    // Insert an image file as a base64 data URL at the current cursor position
    const insertImageFile = useCallback((file: File) => {
      const ed = editorRef.current;
      if (!ed) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        ed.chain().focus().setImage({ src: dataUrl }).run();
        onChangeRef.current(htmlToMarkdown(ed.getHTML()));
      };
      reader.readAsDataURL(file);
    }, []);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          heading: { levels: [1, 2, 3] },
          link: { openOnClick: false },
        }),
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: 'plaintext',
          HTMLAttributes: { class: 'code-block' },
        }),
        Placeholder.configure({ placeholder: placeholderText }),
        ImageExtension,
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TextStyle,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        // Search highlight as a lightweight extension
        { name: 'search-highlight', plugins: () => [createSearchHighlightPlugin(searchQuery || '')] } as unknown as Extensions[number],
      ],
      content: markdownToHtml(initialContent),
      onUpdate: ({ editor: ed }) => {
        if (isUpdatingFromSource.current) return;
        const html = ed.getHTML();
        const md = htmlToMarkdown(html);
        onChangeRef.current(md);
        setSourceContent(md);
        // Check for slash command trigger
        checkAndShowSlashMenu(ed);
      },
      onSelectionUpdate: ({ editor: ed }) => {
        const { from, to } = ed.state.selection;
        const selectedText = ed.state.doc.textBetween(from, to, '\n', ' ');
        onSelectionChange?.(from, to, selectedText);
      },
      editorProps: {
        attributes: {
          class: 'rich-editor-content prose prose-sm max-w-none',
        },
        handleDOMEvents: {
          // Prevent default to allow drop (don't block PM's dragover handler)
          dragover: () => false,
          // Handle drag-and-drop image insertion at the DOM level
          drop: (view, event) => {
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) {
              for (const file of Array.from(files)) {
                if (file.type.startsWith('image/')) {
                  event.preventDefault();
                  insertImageFile(file);
                  return true; // Signal handled — stop PM processing
                }
              }
            }
            return false; // Let ProseMirror handle text drops
          },
          // Handle image paste from clipboard (return false = let PM handle text paste)
          paste: (view, event) => {
            const items = event.clipboardData?.items;
            if (items) {
              for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (file) insertImageFile(file);
                  return true;
                }
              }
            }
            return false; // Let ProseMirror handle text paste normally
          },
          // Handle image click to show resize/align toolbar
          // AND prevent ProseMirror clickHandler from collapsing text selections
          click: (view, event) => {
            const target = event.target as HTMLElement;
            // Check DOM selection FIRST — more reliable than PM state after mouseup
            const domSel = window.getSelection();
            if (domSel && !domSel.isCollapsed && domSel.toString().length > 0 &&
                view.dom.contains(domSel.anchorNode)) {
              event.preventDefault();
              return true; // Block PM's clickHandler to preserve selection
            }
            if (!view.state.selection.empty) {
              event.preventDefault();
              return true;
            }
            if (target.tagName === 'IMG') {
              const src = target.getAttribute('src') || '';
              setResizeTarget(src);
              setResizeAlign(target.style.textAlign || 'left');
              return false;
            }
            setResizeTarget(null);
            return false;
          },
        },
      },
    });

    // Keep ref in sync for use in event handlers
    editorRef.current = editor;

    // Sync initial content
    useEffect(() => {
      if (editor && initialContent) {
        const currentHtml = editor.getHTML();
        const expectedHtml = markdownToHtml(initialContent);
        if (currentHtml !== expectedHtml && currentHtml === '<p></p>') {
          editor.commands.setContent(expectedHtml);
        }
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Add line numbers to code blocks
    useEffect(() => {
      if (!editor || mode !== 'wysiwyg') return;

      const updateLineNumbers = () => {
        editor.view.dom.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
          const code = pre.querySelector('code');
          if (!code) return;
          const text = code.textContent || '';
          const lineCount = text.split('\n').length;
          const nums = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n');
          pre.setAttribute('data-line-nums', nums);
        });
      };

      // Initial update
      requestAnimationFrame(updateLineNumbers);

      // Watch for DOM changes (new code blocks from typing or loading)
      const observer = new MutationObserver(() => {
        requestAnimationFrame(updateLineNumbers);
      });
      observer.observe(editor.view.dom, { childList: true, subtree: true, characterData: true });

      return () => observer.disconnect();
    }, [editor, mode]);

    // Track the active code block position for language selector
    useEffect(() => {
      if (!editor || mode !== 'wysiwyg') {
        setCodeBlockRect(null);
        return;
      }

      const updateCodeBlockRect = () => {
        if (!editor.isActive('codeBlock')) {
          setCodeBlockRect(null);
          return;
        }
        const { view } = editor;
        const { from } = view.state.selection;
        const domPos = view.domAtPos(from);
        const pre = (domPos.node as HTMLElement).closest?.('pre') ?? null;
        if (pre) {
          setCodeBlockRect(pre.getBoundingClientRect());
        } else {
          setCodeBlockRect(null);
        }
      };

      updateCodeBlockRect();

      // Re-check on selection changes
      const onSelectionUpdate = () => { requestAnimationFrame(updateCodeBlockRect); };
      editor.on('selectionUpdate', onSelectionUpdate);

      // Re-check on DOM mutations (code block content changes)
      const observer = new MutationObserver(() => { requestAnimationFrame(updateCodeBlockRect); });
      observer.observe(editor.view.dom, { childList: true, subtree: true, attributes: true });

      return () => {
        editor.off('selectionUpdate', onSelectionUpdate);
        observer.disconnect();
      };
    }, [editor, mode]);

    // Fallback: monitor DOM selectionchange directly (bypasses PM's internal event handling).
    // This keeps the AI toolbar visible even if ProseMirror collapses its internal selection.
    useEffect(() => {
      if (!editor || mode !== 'wysiwyg') return;

      const handleSelectionChange = () => {
        const domSel = window.getSelection();
        if (!domSel || domSel.isCollapsed) return;
        if (!editor.view.dom.contains(domSel.anchorNode)) return;

        const text = domSel.toString();
        if (text.length === 0 || text.length > 2000) return;

        const { from, to } = editor.state.selection;
        onSelectionChange?.(from, to, text);
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [editor, mode, onSelectionChange]);

    const switchToSource = useCallback(() => {
      if (!editor) return;
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      setSourceContent(md);
      setMode('source');
    }, [editor]);

    const switchToWysiwyg = useCallback(() => {
      const html = markdownToHtml(sourceContent);
      isUpdatingFromSource.current = true;
      editor?.commands.setContent(html);
      isUpdatingFromSource.current = false;
      setMode('wysiwyg');
    }, [editor, sourceContent]);

    const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setSourceContent(next);
      onChangeRef.current(next);
    }, []);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (mode === 'wysiwyg') editor?.commands.focus();
        else document.querySelector('.rich-editor-source')?.querySelector('textarea')?.focus();
      },
      getSelection: () => {
        if (mode === 'wysiwyg' && editor) {
          const { from, to } = editor.state.selection;
          return { from, to };
        }
        return { from: 0, to: 0 };
      },
      getContentBeforeCursor: () => {
        if (mode === 'wysiwyg' && editor) {
          const { from } = editor.state.selection;
          return editor.state.doc.textBetween(0, from, '\n', ' ');
        }
        return sourceContent;
      },
      insertTextAtCursor: (text: string) => {
        if (mode === 'wysiwyg') {
          editor?.chain().focus().insertContent(text).run();
        } else {
          const ta = document.querySelector('.rich-editor-source textarea') as HTMLTextAreaElement;
          if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const next = sourceContent.slice(0, start) + text + sourceContent.slice(end);
            setSourceContent(next);
            onChangeRef.current(next);
          }
        }
      },
      insertText: (text: string) => {
        if (mode === 'wysiwyg') {
          editor?.chain().focus().insertContent(text).run();
        } else {
          setSourceContent((prev) => prev + text);
          onChangeRef.current(sourceContent + text);
        }
      },
      setContent: (content: string) => {
        if (mode === 'wysiwyg') {
          isUpdatingFromSource.current = true;
          editor?.commands.setContent(markdownToHtml(content));
          isUpdatingFromSource.current = false;
        }
        setSourceContent(content);
      },
      setSelection: () => {
        // TipTap doesn't expose setSelection easily - skip for now
      },
      getContent: () => {
        if (mode === 'wysiwyg' && editor) {
          return htmlToMarkdown(editor.getHTML());
        }
        return sourceContent;
      },
      wrapText: (before: string, after: string) => {
        if (mode === 'wysiwyg' && editor) {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, '\n', ' ');
          editor.chain().focus().insertContent(before + text + after).run();
        } else {
          const ta = document.querySelector('.rich-editor-source textarea') as HTMLTextAreaElement;
          if (ta) {
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const selected = sourceContent.slice(start, end);
            const next = sourceContent.slice(0, start) + before + selected + after + sourceContent.slice(end);
            setSourceContent(next);
            onChangeRef.current(next);
          }
        }
      },
    }), [editor, mode, sourceContent]);

    return (
      <div className="rich-editor">
        <RichTextToolbar
          editor={editor}
          mode={mode}
          onModeSwitch={mode === 'wysiwyg' ? switchToSource : switchToWysiwyg}
          onAddLink={() => { setUrlInput(''); setLinkModalOpen(true); }}
          onAddImage={() => { setUrlInput(''); setImageModalOpen(true); }}
        />
        <div className="rich-editor-body">
          {mode === 'wysiwyg' ? (
            <>
              <EditorContent editor={editor} className="rich-editor-wysiwyg" />
              {/* Code block language selector — floats at top-right of active code block */}
              {editor?.isActive('codeBlock') && codeBlockRect && (
                <div
                  className="code-lang-selector"
                  style={{
                    position: 'fixed',
                    top: codeBlockRect.top + 4,
                    left: codeBlockRect.right - 100,
                    zIndex: 9999,
                    display: 'flex',
                    gap: 4,
                    padding: 2,
                  }}
                >
                  <select
                    value={editor.getAttributes('codeBlock').language || ''}
                    onChange={(e) => {
                      editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run();
                    }}
                    style={{
                      padding: '2px 6px', fontSize: 11, borderRadius: 4,
                      border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--text-soft)',
                    }}
                  >
                    {CODE_LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Link URL input modal */}
              {linkModalOpen && (
                <div className="modal-backdrop" onClick={() => setLinkModalOpen(false)}>
                  <div className="modal url-input-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>插入链接</h3>
                      <button className="modal-close" onClick={() => setLinkModalOpen(false)}>×</button>
                    </div>
                    <div className="url-input-body">
                      <input
                        type="url"
                        className="url-input-field"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && urlInput) {
                            editor?.chain().focus().setLink({ href: urlInput }).run();
                            setLinkModalOpen(false);
                          }
                        }}
                      />
                      <div className="modal-actions">
                        <button className="ghost-btn" onClick={() => setLinkModalOpen(false)}>取消</button>
                        <button
                          className="primary-btn"
                          disabled={!urlInput}
                          onClick={() => {
                            editor?.chain().focus().setLink({ href: urlInput }).run();
                            setLinkModalOpen(false);
                          }}
                        >确认</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Image URL input modal */}
              {imageModalOpen && (
                <div className="modal-backdrop" onClick={() => setImageModalOpen(false)}>
                  <div className="modal url-input-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>插入图片</h3>
                      <button className="modal-close" onClick={() => setImageModalOpen(false)}>×</button>
                    </div>
                    <div className="url-input-body">
                      <input
                        type="url"
                        className="url-input-field"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/image.png"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && urlInput) {
                            editor?.chain().focus().setImage({ src: urlInput }).run();
                            setImageModalOpen(false);
                          }
                        }}
                      />
                      <div className="url-input-hint">支持输入图片URL或拖拽图片文件到编辑区域</div>
                      <div className="modal-actions">
                        <button className="ghost-btn" onClick={() => setImageModalOpen(false)}>取消</button>
                        <button
                          className="primary-btn"
                          disabled={!urlInput}
                          onClick={() => {
                            editor?.chain().focus().setImage({ src: urlInput }).run();
                            setImageModalOpen(false);
                          }}
                        >确认</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {resizeTarget && (
                <div className="image-toolbar" style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'var(--panel-2)',
                  borderTop: '1px solid var(--line)',
                  padding: '4px 8px',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  fontSize: 12,
                  zIndex: 100,
                }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>Image</span>
                  {['left', 'center', 'right'].map((a) => (
                    <button
                      key={a}
                      className={`image-align-btn ${resizeAlign === a ? 'active' : ''}`}
                      onClick={() => {
                        setResizeAlign(a);
                        editor?.chain().focus().setTextAlign(a as 'left' | 'center' | 'right').run();
                      }}
                      style={{
                        padding: '2px 8px',
                        border: '1px solid var(--line)',
                        borderRadius: 4,
                        background: resizeAlign === a ? 'var(--accent)' : 'transparent',
                        color: resizeAlign === a ? '#fff' : 'var(--text-soft)',
                        cursor: 'pointer',
                      }}
                    >
                      {a === 'left' ? '<' : a === 'center' ? '=' : '>'}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rich-editor-source">
              <textarea
                value={sourceContent}
                onChange={handleSourceChange}
                className="rich-editor-textarea"
                placeholder={placeholderText}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);
