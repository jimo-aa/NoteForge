// NoteForge — Simple Markdown <-> HTML converter
// Used for TipTap WYSIWYG <-> Markdown source mode switching.
// Not a full spec parser — handles common formatting for note-taking.

export function markdownToHtml(md: string): string {
  if (!md) return '';

  const html = md
    // Escape HTML tags first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Images before links
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~~(.+?)~~~/g, '<s><em>$1</em></s>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    .replace(/^\*+---+$/gm, '<hr>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // Task lists
    .replace(/^- \[x\] (.+)$/gim, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>')
    .replace(/^- \[ \] (.+)$/gim, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br>');

  return '<p>' + html + '</p>';
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  const md = html
    // Images
    .replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g, '![$2]($1)')
    .replace(/<img[^>]+src="([^"]+)"[^>]*>/g, '![]($1)')
    // Links
    .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
    // Bold + italic
    .replace(/<strong><em>(.*?)<\/em><\/strong>/g, '***$1***')
    .replace(/<em><strong>(.*?)<\/strong><\/em>/g, '***$1***')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<s>(.*?)<\/s>/g, '~~$1~~')
    .replace(/<u>(.*?)<\/u>/g, '__$1__')
    // Code blocks
    .replace(/<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g, '```$1\n$2\n```')
    // Inline code
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    // Headings
    .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
    // Blockquotes
    .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n')
    // Task lists
    .replace(/<li class="task-list-item">\s*<input[^>]*checked[^>]*>\s*(.*?)<\/li>/g, '- [x] $1')
    .replace(/<li class="task-list-item">\s*<input[^>]*>\s*(.*?)<\/li>/g, '- [ ] $1')
    // Lists
    .replace(/<ul>([\s\S]*?)<\/ul>/g, (_, content) => {
      return content.replace(/<li>(.*?)<\/li>/g, '- $1\n');
    })
    .replace(/<ol>([\s\S]*?)<\/ol>/g, (_, content) => {
      let i = 1;
      return content.replace(/<li>(.*?)<\/li>/g, () => `${i++}. $1\n`);
    })
    // Tables
    .replace(/<table>([\s\S]*?)<\/table>/g, (_, content) => {
      const rows: string[] = [];
      const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(content)) !== null) {
        const cells: string[] = [];
        const cellRegex = /<t[dh][^>]*>(.*?)<\/t[dh]>/g;
        let cellMatch: RegExpExecArray | null;
        const rowContent = rowMatch[1] ?? '';
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          cells.push((cellMatch[1] ?? '').trim());
        }
        rows.push('| ' + cells.join(' | ') + ' |');
      }
      return rows.join('\n') + '\n';
    })
    // Horizontal rules
    .replace(/<hr\s*\/?>/g, '\n---\n')
    // Paragraphs
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    // Line breaks
    .replace(/<br\s*\/?>/g, '\n')
    // Clean up
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Remove extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return md;
}
