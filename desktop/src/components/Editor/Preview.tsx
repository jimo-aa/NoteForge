import { useMemo } from 'react';
import { renderMarkdown } from '@/utils/markdown';

export function Preview({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div className="preview-pane">
      <div className="preview-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
