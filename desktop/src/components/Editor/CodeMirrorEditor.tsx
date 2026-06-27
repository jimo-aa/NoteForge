import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

export interface CodeMirrorHandle {
  focus: () => void;
  insertText: (text: string) => void;
  wrapText: (before: string, after: string) => void;
  getSelection: () => { from: number; to: number };
  getContentBeforeCursor: () => string;
  insertTextAtCursor: (text: string) => void;
  setContent: (content: string) => void;
  getContent: () => string;
  setSelection: (from: number, to: number) => void;
}

interface CodeMirrorEditorProps {
  initialContent: string;
  onChange: (text: string) => void;
  onSelectionChange?: (from: number, to: number) => void;
  onImagePaste?: (file: File) => void;
  onImageDrop?: (file: File) => void;
  placeholderText?: string;
}

const themeComp = new Compartment();
const langComp = new Compartment();

function createEditorState(
  doc: string,
  onChange: (text: string) => void,
  placeholderText: string,
) {
  return EditorState.create({
    doc,
    extensions: [
      themeComp.of(EditorView.theme({
        '&': { backgroundColor: 'var(--panel, #ffffff)', color: 'var(--text, #141a2e)', height: '100%' },
        '.cm-gutters': { backgroundColor: 'var(--panel-2, #f4f6fb)', color: 'var(--text-muted, #7a849e)', border: 'none' },
        '.cm-activeLineGutter': { backgroundColor: 'var(--accent, #6a63ff)', color: '#fff' },
        '.cm-activeLine': { backgroundColor: 'var(--line, rgba(20,30,55,0.06))' },
        '.cm-cursor': { borderLeftColor: 'var(--accent, #6a63ff)' },
        '.cm-selectionBackground': { backgroundColor: 'rgba(106,99,255,0.15) !important' },
        '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(106,99,255,0.22) !important' },
        '.cm-matchingBracket': { backgroundColor: 'rgba(106,99,255,0.2)', outline: '1px solid var(--accent, #6a63ff)' },
        '.cm-placeholder': { color: 'var(--text-muted, #7a849e)' },
        '&.cm-focused': { outline: 'none' },
      })),
      langComp.of(markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      })),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.lineWrapping,
      closeBrackets(),
      highlightSelectionMatches(),
      placeholder(placeholderText),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      history(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });
}

export const CodeMirrorEditor = forwardRef<CodeMirrorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor({ initialContent, onChange, onSelectionChange, onImagePaste, onImageDrop, placeholderText = '开始编写笔记...' }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onImagePasteRef = useRef(onImagePaste);
    const onImageDropRef = useRef(onImageDrop);

    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;
    onImagePasteRef.current = onImagePaste;
    onImageDropRef.current = onImageDrop;

    useEffect(() => {
      if (!containerRef.current || viewRef.current) return;

      const updateListener = (text: string) => onChangeRef.current(text);

      const view = new EditorView({
        state: createEditorState(initialContent, updateListener, placeholderText),
        parent: containerRef.current,
        dispatch: (tr) => {
          viewRef.current?.update([tr]);
          if (tr.selection) {
            const sel = tr.state.selection.main;
            onSelectionChangeRef.current?.(sel.from, sel.to);
          }
        },
      });

      const handlePaste = (e: ClipboardEvent) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith('image/'));
        if (!imageItem) return;
        const file = imageItem.getAsFile();
        if (!file) return;
        e.preventDefault();
        onImagePasteRef.current?.(file);
      };

      const handleDrop = (e: DragEvent) => {
        const file = Array.from(e.dataTransfer?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file) return;
        e.preventDefault();
        onImageDropRef.current?.(file);
      };

      containerRef.current.addEventListener('paste', handlePaste);
      containerRef.current.addEventListener('drop', handleDrop);
      containerRef.current.addEventListener('dragover', (e) => e.preventDefault());

      viewRef.current = view;

      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('paste', handlePaste);
          containerRef.current.removeEventListener('drop', handleDrop);
        }
        view.destroy();
        viewRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const currentDoc = view.state.doc.toString();
      if (initialContent !== currentDoc) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: initialContent },
        });
      }
    }, [initialContent]);

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      getSelection: () => {
        const view = viewRef.current;
        if (!view) return { from: 0, to: 0 };
        const sel = view.state.selection.main;
        return { from: sel.from, to: sel.to };
      },
      getContentBeforeCursor: () => {
        const view = viewRef.current;
        if (!view) return '';
        const sel = view.state.selection.main;
        return view.state.doc.slice(0, sel.from).toString();
      },
      insertTextAtCursor: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const sel = view.state.selection.main;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: text },
          selection: { anchor: sel.from + text.length },
        });
        view.focus();
      },
      insertText: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const sel = view.state.selection.main;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: text },
          selection: { anchor: sel.from + text.length },
        });
        view.focus();
      },
      wrapText: (before: string, after: string) => {
        const view = viewRef.current;
        if (!view) return;
        const sel = view.state.selection.main;
        const selectedText = view.state.doc.slice(sel.from, sel.to).toString() || 'text';
        const newText = `${before}${selectedText}${after}`;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: newText },
          selection: { anchor: sel.from + before.length + selectedText.length },
        });
        view.focus();
      },
      setContent: (content: string) => {
        const view = viewRef.current;
        if (!view) return;
        const currentDoc = view.state.doc.toString();
        if (content !== currentDoc) {
          view.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: content },
          });
        }
      },
      setSelection: (from: number, to: number) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ selection: { anchor: from, head: to } });
      },
      getContent: () => {
        const view = viewRef.current;
        if (!view) return '';
        return view.state.doc.toString();
      },
    }), []);

    return (
      <div
        ref={containerRef}
        className="codemirror-wrapper"
        style={{ width: '100%', height: '100%', overflow: 'auto' }}
      />
    );
  }
);
