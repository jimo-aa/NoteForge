// NoteForge — Image Resize Extension
// TipTap extension that adds drag-to-resize handles on images.
// Uses a NodeView wrapper that renders resize controls.

import { NodeViewWrapper } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { useCallback, useRef, useState, type FC } from 'react';

interface ImageAttrs {
  src: string;
  alt?: string;
  width?: string;
  height?: string;
}

/**
 * React component rendered as the image NodeView.
 * Provides drag handles for resizing and alignment controls.
 */
export const ResizableImage: FC<{
  node: { attrs: ImageAttrs };
  updateAttributes: (attrs: Partial<ImageAttrs>) => void;
  editor: Record<string, unknown>;
}> = ({ node, updateAttributes, editor: _editor }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startX = e.clientX;
    const startW = img.offsetWidth;
    setResizing(true);

    const onMove = (me: MouseEvent) => {
      const newW = Math.max(50, startW + (me.clientX - startX));
      updateAttributes({ width: `${Math.round(newW)}px` });
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [updateAttributes]);

  return (
    <NodeViewWrapper className="image-resize-wrapper" style={{ display: 'inline-block', position: 'relative', lineHeight: 0 }}>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ''}
        width={node.attrs.width}
        height={node.attrs.height}
        style={{ maxWidth: '100%', borderRadius: '4px', ...(resizing ? { userSelect: 'none' } : {}) }}
        draggable
      />
      <span
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
          cursor: 'se-resize', background: 'var(--accent, #6a63ff)',
          borderRadius: '0 0 4px 0', opacity: 0.7,
        }}
      />
    </NodeViewWrapper>
  );
};

/** Extension-level attributes for the image resize */
export const imageResizeAttributes = {
  src: { default: null },
  alt: { default: '' },
  width: { default: undefined as string | undefined },
  height: { default: undefined as string | undefined },
};

/** Image Resize extension configuration */
export const ImageResize = Extension.create({
  name: 'imageResize',

  addOptions() {
    return {
      inline: false,
    };
  },
});
