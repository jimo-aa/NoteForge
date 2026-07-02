import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { EditorView, keymap, placeholder, Decoration, DecorationSet } from '@codemirror/view';
import { EditorState, Compartment, StateField, StateEffect, type Range } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

export interface MatchInfo {
  current: number;
  total: number;
  query: string;
}

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
  highlightNext: () => void;
  highlightPrev: () => void;
  getMatchInfo: () => MatchInfo | null;
  /** Jump to the first match in the document, select it, and scroll to it */
  highlightFirst: () => void;
}

interface CodeMirrorEditorProps {
  initialContent: string;
  onChange: (text: string) => void;
  onSelectionChange?: (from: number, to: number) => void;
  onImagePaste?: (file: File) => void;
  onImageDrop?: (file: File) => void;
  placeholderText?: string;
  searchQuery?: string;
}

const themeComp = new Compartment();
const langComp = new Compartment();
const searchHighlightComp = new Compartment();

/** Effect to update the set of highlighted match ranges */
const setSearchDecorations = StateEffect.define<DecorationSet>();

/** StateField that stores the current search highlight decorations */
const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchDecorations)) {
        return effect.value;
      }
    }
    // Remap decorations through document changes so highlights shift with edits
    return deco.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const searchHighlightMark = Decoration.mark({ class: 'cm-search-match' });

function computeSearchDecorations(view: EditorView, query: string): DecorationSet {
  if (!query.trim()) return Decoration.none;
  const doc = view.state.doc;
  const decorations: Range<Decoration>[] = [];
  const lowerQuery = query.toLowerCase();
  const content = doc.toString().toLowerCase();
  let pos = 0;

  while (pos < content.length) {
    const idx = content.indexOf(lowerQuery, pos);
    if (idx === -1) break;
    decorations.push(searchHighlightMark.range(idx, idx + query.length));
    pos = idx + query.length;
  }

  return Decoration.set(decorations, true);
}

function getMatchRanges(view: EditorView | null, query: string): Array<{ from: number; to: number }> {
  if (!view || !query.trim()) return [];
  const doc = view.state.doc.toString();
  const lowerQuery = query.toLowerCase();
  const content = doc.toLowerCase();
  const ranges: Array<{ from: number; to: number }> = [];
  let pos = 0;
  while (pos < content.length) {
    const idx = content.indexOf(lowerQuery, pos);
    if (idx === -1) break;
    ranges.push({ from: idx, to: idx + query.length });
    pos = idx + query.length;
  }
  return ranges;
}

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
        '.cm-search-match': {
          backgroundColor: 'rgba(255, 213, 0, 0.35)',
          borderBottom: '2px solid rgba(255, 183, 0, 0.7)',
          borderRadius: '2px',
        },
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
      searchHighlightComp.of([]),
      searchHighlightField,
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
  function CodeMirrorEditor({ initialContent, onChange, onSelectionChange, onImagePaste, onImageDrop, placeholderText = '开始编写笔记...', searchQuery }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onImagePasteRef = useRef(onImagePaste);
    const onImageDropRef = useRef(onImageDrop);
    const searchQueryRef = useRef(searchQuery);
    const matchRangesRef = useRef<Array<{ from: number; to: number }>>([]);
    const currentMatchRef = useRef(0);

    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;
    onImagePasteRef.current = onImagePaste;
    onImageDropRef.current = onImageDrop;
    searchQueryRef.current = searchQuery;

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

    // Update search highlights when searchQuery changes
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const q = searchQuery || '';
      matchRangesRef.current = getMatchRanges(view, q);

      if (q.trim()) {
        const decorations = computeSearchDecorations(view, q);
        view.dispatch({ effects: setSearchDecorations.of(decorations) });
      } else {
        view.dispatch({ effects: setSearchDecorations.of(Decoration.none) });
      }
    }, [searchQuery]);

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
      highlightNext: () => {
        const view = viewRef.current;
        const ranges = matchRangesRef.current;
        if (!view || ranges.length === 0) return;

        const sel = view.state.selection.main;
        // Find the next match after current cursor position
        let nextIdx = currentMatchRef.current + 1;
        if (nextIdx >= ranges.length) nextIdx = 0;

        const range = ranges[nextIdx];
        if (range) {
          view.dispatch({
            selection: { anchor: range.from, head: range.to },
            scrollIntoView: true,
          });
          currentMatchRef.current = nextIdx;
        }
      },
      highlightPrev: () => {
        const view = viewRef.current;
        const ranges = matchRangesRef.current;
        if (!view || ranges.length === 0) return;

        let prevIdx = currentMatchRef.current - 1;
        if (prevIdx < 0) prevIdx = ranges.length - 1;

        const range = ranges[prevIdx];
        if (range) {
          view.dispatch({
            selection: { anchor: range.from, head: range.to },
            scrollIntoView: true,
          });
          currentMatchRef.current = prevIdx;
        }
      },
      getMatchInfo: (): MatchInfo | null => {
        const q = searchQueryRef.current;
        const ranges = matchRangesRef.current;
        if (!q || ranges.length === 0) return null;
        return {
          current: currentMatchRef.current + 1,
          total: ranges.length,
          query: q,
        };
      },
      highlightFirst: () => {
        const view = viewRef.current;
        const ranges = matchRangesRef.current;
        if (!view || ranges.length === 0) return;

        const range = ranges[0];
        if (range) {
          view.dispatch({
            selection: { anchor: range.from, head: range.to },
            scrollIntoView: true,
          });
          currentMatchRef.current = 0;
        }
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
