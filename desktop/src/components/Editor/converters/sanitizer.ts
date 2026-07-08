// NoteForge — HTML Sanitizer
// Wraps DOMPurify for safe HTML rendering in the editor preview.
// Prevents XSS attacks while allowing safe rich content.

import DOMPurify from 'dompurify';

/** Default allowed tags for editor content */
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'u', 's', 'code', 'pre',
  'a', 'img',
  'ul', 'ol', 'li',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'sup', 'sub',
  'input',
  'button', 'mark',
  'figure', 'figcaption',
  'video', 'iframe',
  'details', 'summary',
];

/** Allowed attributes */
const ALLOWED_ATTRS = [
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height',
  'class', 'id', 'style',
  'data-*',
  'type', 'checked', 'disabled',
  'title',
  'align',
  'lang',
];

/** Sanitize HTML string for safe rendering */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'],
  });
}

/** Sanitize with extra restrictions for preview mode (strips interactive elements) */
export function sanitizeForPreview(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ALLOWED_TAGS.filter((t) => !['input', 'button', 'iframe', 'video'].includes(t)),
    ALLOWED_ATTR: ALLOWED_ATTRS.filter((a) => a !== 'checked'),
  });
}
