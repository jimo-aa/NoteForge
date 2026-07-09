// NoteForge — Mermaid Diagram NodeView for TipTap WYSIWYG
// Renders a mermaid diagram as an SVG inside an atom node.
// ProseMirror won't overwrite the DOM because NodeViews own their DOM.

import { useEffect, useRef } from 'react';
import type { NodeViewProps } from '@tiptap/react';

export function MermaidNodeView({ node, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const source = (node.attrs.source as string) || '';
  const hasRendered = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !source || hasRendered.current) return;
    hasRendered.current = true;

    const el = containerRef.current;

    (async () => {
      try {
        const mermaidMod = await import('mermaid');
        const mermaid = (mermaidMod as any).default ?? mermaidMod;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

        const id = 'mm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const result = await mermaid.render(id, source);
        const svg = result.svg ?? result;
        if (el && svg) {
          el.innerHTML = typeof svg === 'string' ? svg : '';
        }
      } catch (e: any) {
        console.warn('[MermaidView] Render error:', e);
        if (el) {
          el.textContent = `❌ Mermaid: ${e.message ?? e}`;
          el.style.color = '#e74c3c';
        }
      }
    })();
  }, [source]);

  return (
    <div
      ref={containerRef}
      className={selected ? 'mermaid-rendered ProseMirror-selectednode' : 'mermaid-rendered'}
      style={{ textAlign: 'center', padding: '16px', minHeight: '60px' }}
    >
      {/* Placeholder shown while mermaid renders */}
      <span style={{ color: 'var(--text-muted, #7a849e)', fontSize: '13px' }}>⟳ {source.slice(0, 40)}…</span>
    </div>
  );
}
