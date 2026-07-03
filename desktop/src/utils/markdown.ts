// NoteForge — Markdown 渲染引擎（离线可用）

import DOMPurify from 'dompurify';

// Allow class attribute on code/pre elements for highlight.js
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'code' || data.tagName === 'pre') {
    // Keep existing class attribute (attrs read is implicit via DOMPurify)
  }
});
const SANITIZE_CONFIG = {
  ALLOWED_ATTR: ['class', 'data-lang', 'data-code', 'data-checked', 'data-line', 'target', 'rel', 'loading'],
  ADD_TAGS: ['mark'],
};

export function renderMarkdown(md: string, highlightQuery = ''): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inTable = false;
  let inCode = false;
  let codeLang = '';
  const codeBuf: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  function flushList() {
    if (listType) { out.push(`</${listType === 'ul' ? 'ul' : 'ol'}>`); listType = null; }
  }

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeLang = line.slice(3).trim(); continue; }
      inCode = false;
      const code = escapeHtml(codeBuf.join('\n'));
      const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
      const langLabel = codeLang ? `<span class="code-lang-label">${escapeHtml(codeLang)}</span>` : '';
      const copyBtn = '<button class="code-copy-btn" data-code="' + escapeHtml(codeBuf.join('\n')) + '" title="复制代码">📋</button>';
      out.push(`<pre class="code-block"${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ''}>${langLabel}${copyBtn}<code${langClass}>${code}</code></pre>`);
      codeBuf.length = 0;
      codeLang = '';
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (!line.trim()) { flushList(); out.push('<p class="empty-line"></p>'); continue; }
    const hMatch = line.match(/^(#{1,6})\s(.+)/);
    if (hMatch) { flushList(); if (inTable) { out.push('</table>'); inTable = false; } out.push(`<h${hMatch[1]!.length}>${inlineMd(hMatch[2]!, highlightQuery)}</h${hMatch[1]!.length}>`); continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flushList(); out.push('<hr>'); continue; }
    if (line.startsWith('> ')) { flushList(); out.push(`<blockquote class="quote-block">${inlineMd(line.slice(2), highlightQuery)}</blockquote>`); continue; }
    // Task list - clickable checkbox
    if (/^- \[[ xX]\] /.test(line)) {
      const ch3 = line[3]; const done = ch3 === 'x' || ch3 === 'X';
      if (listType !== 'ul') { flushList(); listType = 'ul'; out.push('<ul class="task-list">'); }
      out.push(`<li class="${done ? 'task-done' : ''}"><button class="task-checkbox" data-checked="${done ? 'true' : 'false'}" data-line="${escapeHtml(line)}" title="${done ? '标记未完成' : '标记完成'}">${done ? '✅' : '⬜'}</button> ${inlineMd(line.replace(/^- \[[ xX]\] /, ''), highlightQuery)}</li>`);
      continue;
    }
    if (/^[-*+]\s/.test(line)) { if (listType !== 'ul') { flushList(); listType = 'ul'; out.push('<ul>'); } out.push(`<li>${inlineMd(line.replace(/^[-*+]\s/, ''), highlightQuery)}</li>`); continue; }
    const olMatch = line.match(/^(\d+)\.\s(.+)/);
    if (olMatch) { if (listType !== 'ol') { flushList(); listType = 'ol'; out.push('<ol>'); } out.push(`<li>${inlineMd(olMatch[2]!, highlightQuery)}</li>`); continue; }
    if (line.startsWith('|')) { flushList(); const cells = line.split('|').filter(c => c.trim()).map(c => inlineMd(c.trim(), highlightQuery)); const isSep = /^[\s:|:-]+$/.test(line); if (!inTable && !isSep) { inTable = true; out.push('<table>'); } if (!isSep) { out.push(`<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`); } continue; }
    if (inTable) { out.push('</table>'); inTable = false; }
    flushList();
    out.push(`<p>${inlineMd(line, highlightQuery)}</p>`);
  }
  flushList();
  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  if (inTable) out.push('</table>');
  return DOMPurify.sanitize(out.join('\n'), SANITIZE_CONFIG);
}

function inlineMd(text: string, highlightQuery = ''): string {
  let r = escapeHtml(text);
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
  r = r.replace(/~~(.+?)~~/g, '<s>$1</s>');
  r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Image rendering (must be before link to avoid matching ![alt](url) as [alt](url))
  r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="inline-image" loading="lazy" />');
  r = r.replace(/\[\[([^\]]+)\]\]/g, '<button class="wiki-link" role="link" tabIndex="0">$1</button>');
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  if (highlightQuery.trim()) {
    const escaped = escapeRegExp(highlightQuery.trim());
    if (escaped) {
      const regex = new RegExp(`(${escaped})`, 'gi');
      r = r.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
  }
  r = r.replace(/(?<!\w)(#[\w\u4e00-\u9fff\-/]+)/gu, '<span class="tag">$1</span>');
  return r;
}

function escapeHtml(text: string): string { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeRegExp(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function countWords(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch >= '\u4e00' && ch <= '\u9fff') { count++; }
    else if (ch.match(/[a-zA-Z0-9]/)) { count++; }
  }
  return count || text.length;
}

export function extractPlainText(md: string): string {
  return md.replace(/```[\s\S]*?```/g, '').replace(/#{1,6}\s/g, '').replace(/[*~`[\]]/g, '').replace(/\n+/g, ' ');
}

export function generateId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
export function formatTime(ts: number): string { const diff = Date.now() - ts; if (diff < 60000) return '刚刚'; if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`; if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`; if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`; return new Date(ts).toLocaleDateString('zh-CN'); }

export function getTemplateContent(tmpl: string): string {
  const templates: Record<string, string> = {
    blank: '',
    meeting: `# 会议记录\n\n**日期**: \n**参与人**: \n\n## 议程\n\n1. \n2. \n\n## 决议\n\n-\n\n## 待办\n\n- [ ] \n`,
    project: `# 项目计划\n\n## 目标\n\n## 里程碑\n\n| 时间 | 里程碑 | 状态 |\n|------|--------|:----:|\n| | | 🟢 |\n\n## 风险\n\n- \n`,
    diary: `# 日记 ${new Date().toLocaleDateString('zh-CN')}\n\n## 今天做了什么\n\n## 感悟\n\n`,
  };
  return templates[tmpl] || '';
}

// ── Table formatting ──

/** Column alignment constants */
export const TABLE_CELL_KEYS = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
} as const;

/**
 * Format a Markdown table: split cells, compute max widths, re-pad.
 * Handles leading/trailing pipes and alignment separator row.
 */
export function formatTable(tableText: string): string {
  const rows = tableText.split('\n').filter((r) => r.trim());
  if (rows.length < 2) return tableText;

  // Parse cells for each row
  const parsed = rows.map((row) => {
    const cells = row.split('|').map((c) => c.trim());
    // Remove empty first/last if row starts/ends with |
    if (row.trimStart().startsWith('|')) cells.shift();
    if (row.trimEnd().endsWith('|')) cells.pop();
    return cells;
  });

  const numCols = Math.max(...parsed.map((r) => r.length));
  if (numCols === 0) return tableText;

  // Identify separator row
  const sepIdx = parsed.findIndex((r) => r.every((c) => /^:?-{3,}:?$/.test(c)));

  // Compute max width per column (excluding alignment markers)
  const colWidths: number[] = Array(numCols).fill(0);
  for (const row of parsed) {
    for (let i = 0; i < row.length && i < numCols; i++) {
      colWidths[i] = Math.max(colWidths[i]!, strWidth(row[i]!));
    }
  }

  // Rebuild
  const result = parsed.map((row, ri) => {
    const cells: string[] = [];
    for (let i = 0; i < numCols; i++) {
      const raw = row[i] ?? '';
      const w = colWidths[i]!;

      if (ri === sepIdx && /^:?-{3,}:?$/.test(raw)) {
        // Alignment separator
        const alignLeft = raw.startsWith(':');
        const alignRight = raw.endsWith(':');
        if (alignLeft && alignRight) cells.push(':'.padEnd(w - 1, '-') + ':');
        else if (alignRight) cells.push(''.padEnd(w - 2, '-') + ':');
        else if (alignLeft) cells.push(':' + ''.padEnd(w - 2, '-'));
        else cells.push(''.padEnd(w, '-'));
      } else {
        // Data cell — left-align, pad
        cells.push(raw + ' '.repeat(Math.max(0, w - strWidth(raw))));
      }
    }
    return '| ' + cells.join(' | ') + ' |';
  });

  return result.join('\n');
}

/** Approximate visible width of a string (CJK chars count as 2) */
function strWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (ch >= '\u4e00' && ch <= '\u9fff') w += 2;
    else if (ch >= '\u3000' && ch <= '\u303f') w += 2;
    else w += 1;
  }
  return w;
}
