// NoteForge — Simple Markdown <-> HTML converter
// Used for TipTap WYSIWYG <-> Markdown source mode switching.
// Handles common formatting for note-taking including:
// code blocks, tables (with alignment), nested lists, images, links.

export function markdownToHtml(md: string): string {
  if (!md) return '<p></p>';

  let html = md;

  // Step 1: Extract code blocks FIRST (before inline code converts backticks)
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = codeBlocks.length;
    const langAttr = lang ? ` class="language-${lang}"` : '';
    codeBlocks.push(`<pre><code${langAttr}>${code.trim()}</code></pre>`);
    return `%%CODEBLOCK_${idx}%%`;
  });

  // Step 2: Escape HTML and process inline formatting (code blocks are protected)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Task lists
  html = html.replace(/^- \[x\] (.+)$/gim, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(/^- \[ \] (.+)$/gim, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>');

  // Tables — GFM pipe table to HTML (inline position-preserving conversion)
  // Matches contiguous lines starting with '|' that form a table block
  html = html.replace(
    /(?:^\|.+\|\s*$(?:\n^\|.+\|\s*$)*)/gm,
    (tableBlock) => {
      const lines = tableBlock.split('\n').filter(l => l.trim().startsWith('|'));
      if (lines.length < 2) return tableBlock; // need at least header + separator

      const parsed = lines.map(line => {
        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
        return cells;
      });

      // Find separator row (second line typically)
      const sepRow = parsed[1];
      const isSepRow = sepRow && sepRow.every(c => /^:?-{3,}:?$/.test(c));
      if (!isSepRow) return tableBlock; // not a valid table

      // Extract alignments from separator
      const aligns = sepRow.map(c => {
        const t = c.trim();
        if (t.startsWith(':') && t.endsWith(':')) return 'center';
        if (t.endsWith(':')) return 'right';
        if (t.startsWith(':')) return 'left';
        return 'left';
      });

      // Header row (index 0), data rows (index 2+)
      const headerCells = parsed[0]!;
      const dataRows = parsed.slice(2);

      let tableHtml = '<table>';
      // Header
      tableHtml += '<tr>';
      headerCells.forEach((cell, ci) => {
        const align = aligns[ci] || 'left';
        const style = align !== 'left' ? ` style="text-align:${align}"` : '';
        tableHtml += `<th${style}>${cell}</th>`;
      });
      tableHtml += '</tr>';
      // Data rows
      dataRows.forEach(row => {
        tableHtml += '<tr>';
        row.forEach((cell, ci) => {
          const align = aligns[ci] || 'left';
          const style = align !== 'left' ? ` style="text-align:${align}"` : '';
          tableHtml += `<td${style}>${cell}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</table>';
      return tableHtml;
    }
  );

  // Lists — handle nested by indentation level
  const lines = html.split('\n');
  const listLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let listDepth = 0;

  for (const line of lines) {
    const trimmed = line;
    const indent = line.search(/\S/);
    const isLi = /^- /.test(trimmed) || /^\d+\. /.test(trimmed);
    const isOl = /^\d+\. /.test(trimmed);
    const isTask = trimmed.includes('task-list-item');

    if (isLi || isTask) {
      const content = trimmed.replace(/^- /, '').replace(/^\d+\. /, '');
      const depth = Math.floor(indent / 2);
      const newType = isOl ? 'ol' : 'ul';

      if (!inList) {
        listDepth = depth;
        listType = newType;
        inList = true;
        listLines.push(`  `.repeat(depth) + `<${newType}>`);
      } else if (newType !== listType) {
        listLines.push(`  `.repeat(listDepth) + `</${listType}>`);
        listType = newType;
        listLines.push(`  `.repeat(depth) + `<${newType}>`);
      } else if (depth > listDepth) {
        listLines.push(`  `.repeat(listDepth) + `<${newType}>`);
        listDepth = depth;
      } else if (depth < listDepth) {
        listLines.push(`  `.repeat(listDepth) + `</${listType}>`);
        listDepth = depth;
      }

      listLines.push(`  `.repeat(depth + 1) + `<li>${content}</li>`);
    } else {
      if (inList) {
        listLines.push(`  `.repeat(listDepth) + `</${listType}>`);
        inList = false;
        listType = null;
      }
      listLines.push(line);
    }
  }
  if (inList) {
    listLines.push(`  `.repeat(listDepth) + `</${listType}>`);
  }

  html = listLines.join('\n');

  // Restore code blocks
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_m, idx) => codeBlocks[parseInt(idx)] || '');

  // Wrap in paragraphs (skip headings, lists, tables, code blocks, hr, blockquotes)
  const blockTags = /^<(h[1-3]|ul|ol|li|table|tr|td|th|pre|blockquote|hr|p)/i;
  const lines2 = html.split('\n');
  let result = '';
  let inParagraph = false;

  for (const line of lines2) {
    if (!line.trim()) {
      if (inParagraph) { result += '</p>\n'; inParagraph = false; }
      continue;
    }
    if (blockTags.test(line.trim())) {
      if (inParagraph) { result += '</p>\n'; inParagraph = false; }
      result += line + '\n';
    } else {
      if (!inParagraph) { result += '<p>'; inParagraph = true; }
      else { result += '<br>'; }
      result += line.trim();
    }
  }
  if (inParagraph) result += '</p>';

  return result.trim() || '<p></p>';
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
