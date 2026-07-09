// NoteForge — KaTeX Math NodeView for TipTap WYSIWYG
// Renders LaTeX formulas via KaTeX inside atom nodes / marks.
// NodeViews own their DOM so ProseMirror won't overwrite.

import { useEffect, useRef } from 'react';
import type { NodeViewProps } from '@tiptap/react';

/** Block math $$...$$ NodeView */
export function MathBlockNodeView({ node, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latex = (node.attrs.latex as string) || '';
  const hasRendered = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !latex || hasRendered.current) return;
    hasRendered.current = true;

    const el = containerRef.current;

    (async () => {
      try {
        const katexMod = await import('katex');
        const katex = (katexMod as any).default ?? katexMod;
        const html = katex.renderToString(latex, {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        });
        el.innerHTML = html;
      } catch (e: any) {
        console.warn('[MathView] Block render error:', e);
        el.textContent = `❌ ${latex}`;
      }
    })();
  }, [latex]);

  return (
    <div
      ref={containerRef}
      className={selected ? 'math-rendered ProseMirror-selectednode' : 'math-rendered'}
      style={{ textAlign: 'center', padding: '8px 0', overflowX: 'auto' }}
    >
      <span style={{ color: 'var(--text-muted, #7a849e)', fontSize: '13px' }}>∫ {latex}</span>
    </div>
  );
}
