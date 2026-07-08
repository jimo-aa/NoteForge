// NoteForge — Markdown <-> HTML Converter
// Delegates to the enhanced renderMarkdown engine for forward conversion.
// Retains separate htmlToMarkdown for backward compatibility.

import { renderMarkdown } from '@/utils/markdown';

/** Convert Markdown to HTML using the enhanced rendering engine */
export function markdownToHtml(md: string): string {
  return renderMarkdown(md);
}

/** Convert table HTML content (inner <tr>/<td>/<th>) to GFM pipe-table Markdown. */
function convertTableHtmlToMd(content: string): string {
  const rows: string[] = [];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
  let isHeaderProcessed = false;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(content)) !== null) {
    const cells: string[] = [];
    const aligns: string[] = [];
    const cellRegex = /<t([dh])([^>]*)>(.*?)<\/t\1>/g;
    let cellMatch: RegExpExecArray | null;
    const rowContent = rowMatch[1] ?? '';

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const [, , attrs = ''] = cellMatch;
      let cellContent = (cellMatch[3] ?? '').trim();
      // Strip inner paragraph/br tags that TipTap may add
      cellContent = cellContent.replace(/<p>|<\/p>/g, '').replace(/<br\s*\/?>/g, ' ');
      cells.push(cellContent);

      // Extract alignment from style attribute
      const styleMatch = attrs.match(/style="([^"]+)"/);
      const align = styleMatch?.[1]?.match(/text-align:\s*(left|center|right)/)?.[1] || '';
      if (align === 'center') aligns.push(':---:');
      else if (align === 'right') aligns.push('---:');
      else aligns.push('---');
    }

    if (!isHeaderProcessed) {
      // First row: output as header + alignment
      if (cells.length > 0) {
        rows.push('| ' + cells.join(' | ') + ' |');
        rows.push('| ' + (aligns.length === cells.length ? aligns.join(' | ') : cells.map(() => '---').join(' | ')) + ' |');
      }
      isHeaderProcessed = true;
    } else {
      rows.push('| ' + cells.join(' | ') + ' |');
    }
  }

  return rows.join('\n') + '\n';
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html
    // Images — handle src before or after alt
    .replace(/<img\s+([^>]*)>/g, (_match, attrs: string) => {
      const src = attrs.match(/src="([^"]+)"/)?.[1] || '';
      const alt = attrs.match(/alt="([^"]*)"/)?.[1] || '';
      return `![${alt}](${src})`;
    })
    // Links
    .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
    // Bold + italic
    .replace(/<strong><em>(.*?)<\/em><\/strong>/g, '***$1***')
    .replace(/<em><strong>(.*?)<\/strong><\/em>/g, '***$1***')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<s>(.*?)<\/s>/g, '~~$1~~')
    .replace(/<u>(.*?)<\/u>/g, '__$1__')
    // Inline code
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    // Headings
    .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
    // Blockquotes
    .replace(/<blockquote><p>(.*?)<\/p><\/blockquote>/g, '> $1\n')
    .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n');

  // Code blocks — handle <pre><code>, <pre> alone, and pre with direct content
  md = md.replace(/<pre(?:\s+[^>]*)?>([\s\S]*?)<\/pre>/g, (_match, content) => {
    // Extract code inside <code> if present
    const codeMatch = content.match(/<code(?:\s+[^>]*)?>([\s\S]*?)<\/code>/);
    const code = codeMatch ? codeMatch[1]! : content;
    // Extract language from class
    const langMatch = content.match(/class="[^"]*(?:language-|lang-)(\w+)"/);
    const lang = langMatch ? langMatch[1]! : '';
    const trimmed = code.replace(/^<br\s*\/?>/, '').trim();
    return '```' + lang + '\n' + trimmed + '\n```\n';
  });

  // Tables — handle table tags with attributes (TipTap adds styles)
  // TipTap wraps tables in <div class="tableWrapper"> and may add colgroup
  md = md.replace(/<div[^>]*class="[^"]*tableWrapper[^"]*"[^>]*>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>[\s\S]*?<\/div>/g, (_match, content) => {
    return convertTableHtmlToMd(content);
  });
  // Fallback: bare <table> without wrapper
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_match, content) => {
    return convertTableHtmlToMd(content);
  });

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/g, '\n---\n');

  // Paragraphs and line breaks
  md = md.replace(/<\/p>/g, '\n');
  md = md.replace(/<p>/g, '');
  md = md.replace(/<br\s*\/?>/g, '\n');

  // Lists — handle nested
  md = md.replace(/(<ul>|<ol>)/g, '');
  md = md.replace(/(<\/ul>|<\/ol>)/g, '');
  md = md.replace(/<li>([\s\S]*?)<\/li>/g, (_match, content) => {
    // Check if content contains a sub-list
    if (content.includes('<ul>') || content.includes('<ol>')) {
      const parts = content.split(/(<ul>.*?<\/ul>|<ol>.*?<\/ol>)/s);
      let result = '- ' + parts[0]!.trim() + '\n';
      for (let i = 1; i < parts.length; i++) {
        if (parts[i]!.startsWith('<')) {
          const subContent = parts[i]!.replace(/<\/?[ou]l>/g, '').replace(/<li>/g, '  - ').replace(/<\/li>/g, '\n');
          result += subContent;
        } else {
          result += '  - ' + parts[i]!.trim() + '\n';
        }
      }
      return result;
    }
    return '- ' + content.trim() + '\n';
  });

  // Clean up
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  // Remove extra whitespace
  md = md.replace(/\n{4,}/g, '\n\n');
  md = md.trim();

  return md;
}
