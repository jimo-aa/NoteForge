// NoteForge — Content Sync Manager
// Dual-engine content synchronization:
//   WYSIWYG → HTML → Markdown (for storage)
//   Source  → Markdown → HTML (for rendering)

import { markdownToHtml, htmlToMarkdown } from '../converters';
import { eventBus } from './EventBus';

export class ContentSync {
  private _content = '';

  get content(): string {
    return this._content;
  }

  /** Update content from WYSIWYG (HTML → Markdown) */
  fromWysiwyg(html: string): string {
    const md = htmlToMarkdown(html);
    this._content = md;
    eventBus.emit('content:change', { content: md });
    return md;
  }

  /** Update content from source (Markdown kept as-is) */
  fromSource(md: string): string {
    this._content = md;
    eventBus.emit('content:change', { content: md });
    return md;
  }

  /** Get HTML for WYSIWYG rendering */
  toHtml(): string {
    return markdownToHtml(this._content);
  }

  /** Get raw Markdown for source mode */
  toMarkdown(): string {
    return this._content;
  }

  /** Set content directly (for initial load) */
  setContent(md: string): void {
    this._content = md;
  }

  /** Content length */
  get length(): number {
    return this._content.length;
  }
}
