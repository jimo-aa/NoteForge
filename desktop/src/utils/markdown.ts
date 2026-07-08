// NoteForge — Markdown 渲染引擎（离线可用）
// 所见即所得渲染，支持 GFM + 扩展语法：
//   加粗/斜体/删除线/下划线/高亮/代码/链接/图片/标题/列表/表格/代码块
//   引用/Callout/数学公式/Mermaid/任务列表/Wiki Link/标签/脚注/定义列表
//   Frontmatter/分割线/HTML 嵌入/Emoji 简码

import DOMPurify from 'dompurify';

// ── DOMPurify 配置 ──
DOMPurify.addHook('uponSanitizeElement', (_node, data) => {
  if (data.tagName === 'code' || data.tagName === 'pre') {
    // keep class for highlight.js
  }
});
const SANITIZE_CONFIG = {
  ALLOWED_ATTR: [
    'class', 'data-lang', 'data-code', 'data-checked', 'data-line',
    'data-type', 'data-title',
    'target', 'rel', 'loading', 'href', 'src', 'alt',
    'width', 'height', 'align', 'style',
    'type', 'checked', 'disabled',
  ],
  ADD_TAGS: ['mark', 'details', 'summary', 'video', 'iframe'],
};

// ── Protected block placeholders ──
let _protectedBlocks: string[] = [];

function protect(code: string): string {
  const idx = _protectedBlocks.length;
  _protectedBlocks.push(code);
  return `%%PROTECTED_${idx}%%`;
}

function restore(raw: string): string {
  return raw.replace(/%%PROTECTED_(\d+)%%/g, (_m, idx) => _protectedBlocks[parseInt(idx)] ?? '');
}

// ── Emoji shortcode map ──
const EMOJI_MAP: Record<string, string> = {
  smile: '😊', happy: '😄', sad: '😢', cry: '😭', laugh: '😂',
  heart: '❤️', fire: '🔥', star: '⭐', thumbsup: '👍', thumbsdown: '👎',
  ok: '👌', clap: '👏', wave: '👋', check: '✅', x: '❌',
  warning: '⚠️', info: 'ℹ️', question: '❓', exclamation: '❗',
  clock: '🕐', calendar: '📅', mail: '📧', phone: '📞',
  book: '📖', pencil: '✏️', scissors: '✂️', lock: '🔒', unlock: '🔓',
  key: '🔑', bulb: '💡', rocket: '🚀', bug: '🐛', note: '📝',
  page: '📄', folder: '📁', search: '🔍', link: '🔗', tag: '🏷️',
  chart: '📊', graph: '📈', tools: '🔧', gear: '⚙️',
};

/** 展开 :emoji: 简码 */
function expandEmoji(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (_m, name) => EMOJI_MAP[name.toLowerCase()] ?? _m);
}

/** 转义 HTML */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 转义正则 */
function escRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 前置保护：提取代码块 / 数学块 / Mermaid / Frontmatter */
function preprocess(text: string): string {
  _protectedBlocks = [];

  let s = text;

  // 1. Frontmatter ---...---
  s = s.replace(/^---\n([\s\S]*?)\n---\n?/, (_m, content) => {
    // Render frontmatter as hidden metadata, not displayed
    return protect(`<div class="frontmatter" style="display:none">${esc(content)}</div>`);
  });

  // 2. Mermaid code blocks (must preceed generic code blocks)
  s = s.replace(/```mermaid\n([\s\S]*?)```/g, (_m, code) => {
    const encoded = esc(code.trim());
    return protect(`<div class="mermaid-block" data-code="${encoded}"><div class="mermaid-placeholder">
      <span class="mermaid-icon">📊</span>
      <span class="mermaid-label">Mermaid 图表</span>
      <span class="mermaid-hint">渲染需要加载 mermaid.js</span>
    </div></div>`);
  });

  // 3. Math blocks $$...$$
  s = s.replace(/\$\$\n?([\s\S]*?)\n?\$\$/g, (_m, code) => {
    const encoded = esc(code.trim());
    return protect(`<div class="math-block" data-latex="${encoded}"><span class="math-placeholder">∑ ${encoded}</span></div>`);
  });

  // 4. Generic code blocks ```lang
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const langAttr = lang ? ` data-lang="${esc(lang)}"` : '';
    const langLabel = lang ? `<span class="code-lang-label">${esc(lang)}</span>` : '';
    const rawCode = code.trimEnd();
    const copyBtn = `<button class="code-copy-btn" data-code="${esc(rawCode)}" title="复制代码">📋</button>`;
    const lineCount = rawCode.split('\n').length;
    const lineNums = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
    return protect(`<pre class="code-block"${langAttr} data-line-nums="${lineNums}">${langLabel}${copyBtn}<code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(rawCode)}</code></pre>`);
  });

  // 5. Inline math $...$ (only single-line, not $$)
  s = s.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_m, code) => {
    const encoded = esc(code.trim());
    return protect(`<span class="math-inline" data-latex="${encoded}"><span class="math-placeholder-inline">${encoded}</span></span>`);
  });

  return s;
}

// ── Inline formatting ──

function renderInline(text: string, highlightQuery = ''): string {
  let r = esc(text);

  // Must process in order to avoid nested conflicts:
  // 1. Protected blocks (already escaped, restore placeholders)
  r = r.replace(/%%PROTECTED_(\d+)%%/g, (_m, idx) => _protectedBlocks[parseInt(idx)] ?? _m);

  // 2. Image (before link, so ![alt](url) doesn't match as [alt](url))
  r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="inline-image" loading="lazy" />');

  // 3. Bold+Italic ***text***
  r = r.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // 4. Bold **text**
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 5. Italic *text*
  r = r.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // 6. Underline __text__ (but not inside words like foo__bar)
  r = r.replace(/(?<!\w)__(.+?)__(?!\w)/g, '<u>$1</u>');

  // 7. Strikethrough ~~text~~
  r = r.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // 8. Highlight ^^text^^
  r = r.replace(/\^\^(.+?)\^\^/g, '<mark>$1</mark>');

  // 9. Inline code
  r = r.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 10. Wiki Link [[title]]
  r = r.replace(/\[\[([^\]]+)\]\]/g, '<button class="wiki-link" role="link" tabIndex="0">$1</button>');

  // 11. Link [text](url)
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 12. Footnote reference [^id]
  r = r.replace(/\[\^([^\]]+)\]/g, (_m, id) => {
    return `<sup class="footnote-ref" data-footnote-id="${esc(id)}"><a href="#fn:${esc(id)}">[${esc(id)}]</a></sup>`;
  });

  // 13. Emoji shortcodes
  r = expandEmoji(r);

  // 14. Tags #tag (must be at word boundary, not inside another token)
  r = r.replace(/(?<!\w)(#[\w\u4e00-\u9fff\-/]+)/gu, '<span class="tag">$1</span>');

  // 15. Search highlight
  if (highlightQuery.trim()) {
    const q = escRegex(highlightQuery.trim());
    if (q) {
      const regex = new RegExp(`(${q})`, 'gi');
      r = r.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
  }

  return r;
}

// ── Block-level rendering ──

export function renderMarkdown(md: string, highlightQuery = ''): string {
  if (!md) return '';

  // Pre-process: extract protected blocks
  const body = preprocess(md);

  const lines = body.split('\n');
  const out: string[] = [];
  let i = 0;

  // State tracking
  const listStack: Array<{ type: 'ul' | 'ol'; tight: boolean }> = [];

  /** Flush list stack back to a given depth */
  function flushListTo(depth: number) {
    while (listStack.length > depth) {
      const lst = listStack.pop()!;
      out.push(`</${lst.type === 'ul' ? 'ul' : 'ol'}>`);
    }
  }

  /** Get indent level (number of leading spaces / 2) */
  function indentLevel(line: string): number {
    const m = line.match(/^( *)/);
    return m ? Math.floor(m[1]!.length / 2) : 0;
  }

  /** Check if line is a protected block placeholder */
  function isProtected(line: string): boolean {
    return /^%%PROTECTED_\d+%%$/.test(line.trim());
  }

  /** Process a line as non-list, non-table block content */
  function processBlock(line: string) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('<p class="empty-line"></p>');
      return;
    }

    // Protected block (code, math, mermaid, frontmatter)
    if (isProtected(line)) {
      out.push(restore(line));
      return;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      out.push('<hr>');
      return;
    }

    // Headings # to ######
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1]!.length;
      out.push(`<h${level}>${renderInline(hMatch[2]!, highlightQuery)}</h${level}>`);
      return;
    }

    // Callout / Admonition: > [!type] title
    const calloutMatch = trimmed.match(/^>\s*\[!(\w+)\]\s*(.*)/i);
    if (calloutMatch) {
      const type = calloutMatch[1]!.toLowerCase();
      const title = calloutMatch[2]!;
      const calloutTypes = ['note', 'warning', 'tip', 'danger', 'info', 'success', 'question'];
      const validType = calloutTypes.includes(type) ? type : 'note';
      out.push(`<div class="callout callout-${validType}">`);
      out.push(`<div class="callout-header"><span class="callout-icon">${getCalloutIcon(validType)}</span><span class="callout-title">${title || validType.charAt(0).toUpperCase() + validType.slice(1)}</span></div>`);
      out.push('<div class="callout-body">');
      // Remaining callout content will be processed as nested block
      return; // caller handles continuation lines
    }

    // Simple blockquote > text
    if (trimmed.startsWith('> ') && !/^>\s*\[!\w+\]/i.test(trimmed)) {
      out.push(`<blockquote class="quote-block">${renderInline(trimmed.slice(2), highlightQuery)}</blockquote>`);
      return;
    }

    // Definition list term:
    const defTerm = trimmed.match(/^:(.+)/);
    if (defTerm) {
      out.push(`<dl><dt>${renderInline(defTerm[1]!, highlightQuery)}</dt>`);
      // Definition body will be next line
      return;
    }

    // Details / Summary: >+++ title
    const detailsMatch = trimmed.match(/^>\+\+\+\s*(.*)/);
    if (detailsMatch) {
      out.push(`<details><summary>${renderInline(detailsMatch[1]! || '展开', highlightQuery)}</summary>`);
      return;
    }
    if (trimmed === '>---') {
      out.push('</details>');
      return;
    }

    // If we reach here, it's a plain paragraph
    out.push(`<p>${renderInline(trimmed, highlightQuery)}</p>`);
  }

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const indent = indentLevel(line);

    // ── Tables ──
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        tableLines.push(lines[i]!.trim());
        i++;
      }
      flushListTo(0);
      out.push(renderTable(tableLines, highlightQuery));
      continue;
    }

    // ── Lists ──
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)/);
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    const taskMatch = trimmed.match(/^(- \[[ xX]\]\s+)(.+)/);
    const defMatch = trimmed.startsWith('  ') && lines[i - 1] && /^:/.test(lines[i - 1]!.trim());

    if (ulMatch || olMatch || taskMatch) {
      // Determine list type
      const isTask = !!taskMatch;
      const isOl = !!olMatch;
      const content = isTask ? taskMatch![2]! : (olMatch?.[2] ?? ulMatch![1]!);
      const type = isOl ? 'ol' : 'ul';

      // Handle indent depth changes
      const depth = indent;
      if (depth > listStack.length) {
        // Indent - start nested list
        const parentType = listStack.length > 0 ? listStack[listStack.length - 1]!.type : type;
        const nestingType = isTask ? 'ul' : type;
        if (nestingType !== parentType) {
          out.push(`<${nestingType}>`);
          listStack.push({ type: nestingType, tight: true });
        }
        out.push(`<${nestingType}>`);
        listStack.push({ type: nestingType, tight: true });
      } else if (depth < listStack.length) {
        flushListTo(depth);
      } else if (listStack.length > 0 && listStack[listStack.length - 1]!.type !== type) {
        // Type switch within same depth
        flushListTo(depth);
        out.push(`<${type}>`);
        listStack.push({ type, tight: true });
      } else if (listStack.length === 0) {
        // Start new list
        out.push(`<${type}>`);
        listStack.push({ type, tight: true });
      }

      // Render list item
      if (isTask) {
        const ch3 = trimmed[3];
        const done = ch3 === 'x' || ch3 === 'X';
        out.push(`<li class="task-list-item${done ? ' task-done' : ''}">`);
        out.push(`<button class="task-checkbox" data-checked="${done ? 'true' : 'false'}" data-line="${esc(line)}" title="${done ? '标记未完成' : '标记完成'}">${done ? '✅' : '⬜'}</button>`);
        out.push(` ${renderInline(content, highlightQuery)}</li>`);
      } else {
        out.push(`<li>${renderInline(content, highlightQuery)}</li>`);
      }
      i++;
      // Check if next line is a continuation (paragraph inside list)
      if (i < lines.length && lines[i]!.trim() && !lines[i]!.trim().startsWith('|') && indentLevel(lines[i]!) >= depth) {
        // Paragraph continuation inside list item
        // Actually for tight lists, we don't add <p> tags
      }
      continue;
    }

    // ── Definition list body (starts with space, follows :term) ──
    if (defMatch) {
      out.push(`<dd>${renderInline(trimmed, highlightQuery)}</dd></dl>`);
      i++;
      continue;
    }

    // Non-list content: flush lists
    flushListTo(0);

    // ── Callout continuation lines ──
    if (trimmed.startsWith('> ') && out.length > 0) {
      // Check if we're inside a callout
      const lastNonEmpty = out[out.length - 1] ?? '';
      if (lastNonEmpty?.startsWith('<div class="callout-body">')) {
        // Still inside callout - accumulate content
        if (!trimmed) {
          // Empty line = end callout block
          out.push('</div></div>');
        } else {
          out.push(`<p>${renderInline(trimmed.slice(2), highlightQuery)}</p>`);
        }
        i++;
        continue;
      }
      if (lastNonEmpty?.startsWith('</div></div>') || /^<div class="callout-body">/.test(lastNonEmpty ?? '')) {
        // Inside callout, not yet closed
      }
    }

    // Close any open callout if we hit non-quote content after callout body started
    if (out.length > 0) {
      const lastOut = out[out.length - 1] ?? '';
      if (lastOut === '<div class="callout-body">' && !trimmed.startsWith('> ')) {
        out.push('</div></div>');
      }
    }

    // ── Regular block processing ──
    processBlock(line);
    i++;
  }

  // Flush remaining
  flushListTo(0);

  // Close any unclosed callout
  if (out.length > 0 && out[out.length - 1] === '<div class="callout-body">') {
    out.push('</div></div>');
  }

  // Close any unclosed details
  const outStr = out.join('\n');

  // Restore any inline protected blocks that were escaped
  const restored = restore(outStr);

  // Post-process: combine adjacent paragraphs inside callouts (already handled)

  return DOMPurify.sanitize(restored, SANITIZE_CONFIG);
}

// ── Table rendering ──

function renderTable(rows: string[], highlightQuery: string): string {
  if (rows.length < 2) return '';

  // Parse cells
  const parsed = rows.map((row) => {
    let r = row.trim();
    if (r.startsWith('|')) r = r.slice(1);
    if (r.endsWith('|')) r = r.slice(0, -1);
    return r.split('|').map((c) => c.trim());
  });

  // Find separator row
  const sepIdx = parsed.findIndex((row) =>
    row.length > 0 && row.every((c) => /^:?-{3,}:?$/.test(c)),
  );
  if (sepIdx === -1) return ''; // Not a valid table

  // Extract alignments
  const numCols = Math.max(...parsed.map((r) => r.length));
  const aligns: string[] = [];
  if (sepIdx >= 0) {
    const sepRow = parsed[sepIdx]!;
    for (let c = 0; c < numCols; c++) {
      const cell = sepRow[c] ?? '---';
      if (cell.startsWith(':') && cell.endsWith(':')) aligns.push('center');
      else if (cell.endsWith(':')) aligns.push('right');
      else if (cell.startsWith(':')) aligns.push('left');
      else aligns.push('left');
    }
  }

  let html = '<table>';
  // Header
  if (sepIdx > 0) {
    html += '<thead><tr>';
    const headerRow = parsed[0]!;
    for (let c = 0; c < numCols; c++) {
      const align = aligns[c] || 'left';
      const style = align !== 'left' ? ` style="text-align:${align}"` : '';
      html += `<th${style}>${renderInline(headerRow[c] ?? '', highlightQuery)}</th>`;
    }
    html += '</tr></thead>';
  }
  // Body
  html += '<tbody>';
  for (let r = sepIdx + 1; r < parsed.length; r++) {
    html += '<tr>';
    for (let c = 0; c < numCols; c++) {
      const align = aligns[c] || 'left';
      const style = align !== 'left' ? ` style="text-align:${align}"` : '';
      html += `<td${style}>${renderInline(parsed[r]![c] ?? '', highlightQuery)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// ── Callout icons ──

function getCalloutIcon(type: string): string {
  const icons: Record<string, string> = {
    note: '📝', warning: '⚠️', tip: '💡', danger: '🚨',
    info: 'ℹ️', success: '✅', question: '❓',
  };
  return icons[type] ?? '📝';
}

// ── Utility functions ──

export function countWords(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch >= '\u4e00' && ch <= '\u9fff') count++;
    else if (ch.match(/[a-zA-Z0-9]/)) count++;
  }
  return count || text.length;
}

export function extractPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/[*~`^]/g, '').replace(/[[\]]/g, '')
    .replace(/\n+/g, ' ');
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

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

export const TABLE_CELL_KEYS = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
} as const;

export function formatTable(tableText: string): string {
  const rows = tableText.split('\n').filter((r) => r.trim());
  if (rows.length < 2) return tableText;

  const parsed = rows.map((row) => {
    const cells = row.split('|').map((c) => c.trim());
    if (row.trimStart().startsWith('|')) cells.shift();
    if (row.trimEnd().endsWith('|')) cells.pop();
    return cells;
  });

  const numCols = Math.max(...parsed.map((r) => r.length));
  if (numCols === 0) return tableText;

  const sepIdx = parsed.findIndex((r) => r.every((c) => /^:?-{3,}:?$/.test(c)));

  const colWidths: number[] = Array(numCols).fill(0);
  for (const row of parsed) {
    for (let i = 0; i < row.length && i < numCols; i++) {
      colWidths[i] = Math.max(colWidths[i]!, strWidth(row[i]!));
    }
  }

  const result = parsed.map((row, ri) => {
    const cells: string[] = [];
    for (let i = 0; i < numCols; i++) {
      const raw = row[i] ?? '';
      const w = colWidths[i]!;

      if (ri === sepIdx && /^:?-{3,}:?$/.test(raw)) {
        const alignLeft = raw.startsWith(':');
        const alignRight = raw.endsWith(':');
        if (alignLeft && alignRight) cells.push(':'.padEnd(w - 1, '-') + ':');
        else if (alignRight) cells.push(''.padEnd(w - 2, '-') + ':');
        else if (alignLeft) cells.push(':' + ''.padEnd(w - 2, '-'));
        else cells.push(''.padEnd(w, '-'));
      } else {
        cells.push(raw + ' '.repeat(Math.max(0, w - strWidth(raw))));
      }
    }
    return '| ' + cells.join(' | ') + ' |';
  });

  return result.join('\n');
}

function strWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (ch >= '\u4e00' && ch <= '\u9fff') w += 2;
    else if (ch >= '\u3000' && ch <= '\u303f') w += 2;
    else w += 1;
  }
  return w;
}
