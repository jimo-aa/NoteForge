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
    'class', 'id', 'data-lang', 'data-code', 'data-checked', 'data-line',
    'data-type', 'data-title', 'data-latex', 'data-footnote-id', 'data-code',
    'target', 'rel', 'loading', 'href', 'src', 'alt',
    'width', 'height', 'align', 'style',
    'type', 'checked', 'disabled', 'role', 'aria-checked', 'tabindex',
  ],
  ADD_TAGS: ['mark', 'details', 'summary', 'video', 'iframe', 'input', 'sup'],
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

  // 1. Frontmatter ---...--- (early extraction before anything else)
  s = s.replace(/^---\n([\s\S]*?)\n---\n?/, (_m: string, content: string) => {
    const lines = content.split('\n').filter((l: string) => l.trim());
    let fmHtml = '<div class="frontmatter">';
    fmHtml += '<div class="frontmatter-header">📋 属性</div>';
    fmHtml += '<table class="frontmatter-table">';
    for (const line of lines) {
      const sep = line.indexOf(':');
      if (sep > 0) {
        const key = esc(line.slice(0, sep).trim());
        let rawVal = line.slice(sep + 1).trim();
        const val = esc(rawVal);
        // Detect YAML array: [item1, item2, ...]
        const arrayMatch = rawVal.match(/^\[(.+)\]$/);
        if (arrayMatch) {
          const items = arrayMatch[1]!.split(',').map(i => esc(i.trim())).filter(Boolean);
          const rendered = items.map(i => `<span class="fm-array-item">${i}</span>`).join('');
          fmHtml += `<tr><td class="fm-key">${key}</td><td class="fm-val">${rendered}</td></tr>`;
        } else {
          fmHtml += `<tr><td class="fm-key">${key}</td><td class="fm-val">${val}</td></tr>`;
        }
      }
    }
    fmHtml += '</table></div>';
    return protect(fmHtml);
  });

  // 2. Mermaid code blocks
  s = s.replace(/```mermaid\n([\s\S]*?)```/g, (_m, code) => {
    const encoded = esc(code.trim());
    return protect(`<div class="mermaid-block" data-code="${encoded}"><div class="mermaid-placeholder">
      <span class="mermaid-icon">📊</span>
      <span class="mermaid-label">Mermaid 图表</span>
      <span class="mermaid-hint">需加载 mermaid.js 库以渲染图表</span>
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

  // 1. Protected blocks (already escaped, restore placeholders)
  r = r.replace(/%%PROTECTED_(\d+)%%/g, (_m, idx) => _protectedBlocks[parseInt(idx)] ?? _m);

  // 2. Image (before link)
  r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="inline-image" loading="lazy" />');

  // 3. Bold+Italic ***text***
  r = r.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // 4. Bold **text**
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 5. Italic *text*
  r = r.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // 6. Underline __text__
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
    return `<sup class="footnote-ref" data-footnote-id="${esc(id)}"><a href="#fn:${esc(id)}" id="fnref:${esc(id)}">[${esc(id)}]</a></sup>`;
  });

  // 13. Emoji shortcodes
  r = expandEmoji(r);

  // 14. Tags #tag
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

// ── Blockquote depth: count leading `>` ──

function parseBlockquoteDepth(line: string): { depth: number; content: string } | null {
  const m = line.trim().match(/^(>+) /);
  if (m) return { depth: m[1]!.length, content: line.trim().slice(m[0]!.length) };
  return null;
}

// ── Block-level rendering ──

export function renderMarkdown(md: string, highlightQuery = ''): string {
  if (!md) return '';

  const body = preprocess(md);
  const lines = body.split('\n');
  const out: string[] = [];
  let i = 0;
  const listStack: Array<{ type: 'ul' | 'ol' }> = [];
  let bqDepth = 0; // current blockquote nesting depth
  let inCallout = false; // track whether we're inside a callout block
  const footnoteDefs: Array<{ id: string; content: string }> = []; // footnote definition collector

  function flushListTo(depth: number) {
    while (listStack.length > depth) {
      const lst = listStack.pop()!;
      out.push(`</${lst.type === 'ul' ? 'ul' : 'ol'}>`);
    }
  }

  function indentLevel(line: string): number {
    const m = line.match(/^( *)/);
    return m ? Math.floor(m[1]!.length / 2) : 0;
  }

  function isProtected(line: string): boolean {
    return /^%%PROTECTED_\d+%%$/.test(line.trim());
  }

  /** Close blockquotes to a target depth */
  function flushBlockquoteTo(target: number) {
    while (bqDepth > target) { out.push('</blockquote>'); bqDepth--; }
    while (bqDepth < target) { out.push('<blockquote>'); bqDepth++; }
  }

  function processBlock(line: string) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push('<p class="empty-line"></p>');
      return;
    }

    if (isProtected(line)) {
      out.push(restore(line));
      return;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      out.push('<hr>');
      return;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1]!.length;
      out.push(`<h${level}>${renderInline(hMatch[2]!, highlightQuery)}</h${level}>`);
      return;
    }

    // Callout / Admonition: > [!type] (handled at depth 1 or more)
    const calloutMatch = trimmed.match(/^>\s*\[!(\w+)\]\s*(.*)/i);
    if (calloutMatch) {
      const type = calloutMatch[1]!.toLowerCase();
      const title = calloutMatch[2]!;
      const calloutTypes = ['note', 'warning', 'tip', 'danger', 'info', 'success', 'question'];
      const validType = calloutTypes.includes(type) ? type : 'note';
      if (inCallout) {
        out.push('</div></div>');
        inCallout = false;
      }
      flushBlockquoteTo(0);
      out.push(`<div class="callout callout-${validType}">`);
      out.push(`<div class="callout-header"><span class="callout-title">${esc(title || validType.charAt(0).toUpperCase() + validType.slice(1))}</span></div>`);
      out.push('<div class="callout-body">');
      inCallout = true;
      return;
    }

    // Nested blockquotes: >> text, > text
    const bq = parseBlockquoteDepth(line);
    if (bq && !/^>\s*\[!\w+\]/i.test(trimmed)) {
      const target = bq.depth;
      flushBlockquoteTo(target);
      out.push(`<p>${renderInline(bq.content, highlightQuery)}</p>`);
      bqDepth = target; // left open for continuation
      return;
    }

    // Definition list term:
    const defTerm = trimmed.match(/^:(.+)/);
    if (defTerm) {
      out.push(`<dl><dt>${renderInline(defTerm[1]!, highlightQuery)}</dt>`);
      return;
    }

    // Details / Summary
    const detailsMatch = trimmed.match(/^>\+\+\+\s*(.*)/);
    if (detailsMatch) {
      out.push(`<details><summary>${renderInline(detailsMatch[1]! || '展开', highlightQuery)}</summary>`);
      return;
    }
    if (trimmed === '>---') {
      out.push('</details>');
      return;
    }

    out.push(`<p>${renderInline(trimmed, highlightQuery)}</p>`);
  }

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const indent = indentLevel(line);

    // ── Callout content handling (tracked via inCallout state) ──
    if (inCallout) {
      if (!trimmed.startsWith('> ')) {
        // Exiting callout context
        out.push('</div></div>');
        inCallout = false;
      } else {
        // Still inside callout — render content line as <p>
        out.push(`<p>${renderInline(trimmed.slice(2), highlightQuery)}</p>`);
        i++;
        // inCallout stays true — track via state, not out[last]
        continue;
      }
    }

    // ── Tables ──
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        tableLines.push(lines[i]!.trim());
        i++;
      }
      flushListTo(0);
      flushBlockquoteTo(0);
      out.push(renderTable(tableLines, highlightQuery));
      continue;
    }

    // ── Lists ──
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)/);
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    const taskMatch = trimmed.match(/^(- \[[ xX]\]\s+)(.+)/);
    const defMatch = trimmed.startsWith('  ') && lines[i - 1] && /^:/.test(lines[i - 1]!.trim());

    if (ulMatch || olMatch || taskMatch) {
      const isTask = !!taskMatch;
      const isOl = !!olMatch;
      const content = isTask ? taskMatch![2]! : (olMatch?.[2] ?? ulMatch![1]!);
      const type = isOl ? 'ol' : 'ul';
      const depth = indent;

      // Handle list stack (depth 0 → stack.length 1, depth 1 → stack.length 2, ...)
      const targetStackLen = depth + 1;
      if (targetStackLen > listStack.length) {
        // Need deeper nesting — start new list
        out.push(`<${type}>`);
        listStack.push({ type });
      } else if (targetStackLen < listStack.length) {
        // Too deep — close inner lists
        flushListTo(targetStackLen);
      } else if (listStack.length > 0 && listStack[listStack.length - 1]!.type !== type) {
        // Same depth but different list type (ul→ol or ol→ul)
        flushListTo(Math.max(0, depth));
        out.push(`<${type}>`);
        listStack.push({ type });
      } else if (listStack.length === 0) {
        // Starting a fresh list
        out.push(`<${type}>`);
        listStack.push({ type });
      }

      // Render item
      if (isTask) {
        const ch3 = trimmed[3];
        const done = ch3 === 'x' || ch3 === 'X';
        out.push(`<li class="task-list-item${done ? ' task-done' : ''}">`);
        out.push(`<span class="task-checkbox" data-checked="${done ? 'true' : 'false'}" role="checkbox" aria-checked="${done ? 'true' : 'false'}" tabindex="0"></span>`);
        out.push(`<span>${renderInline(content, highlightQuery)}</span></li>`);
      } else {
        out.push(`<li>${renderInline(content, highlightQuery)}</li>`);
      }
      i++;
      continue;
    }

    // ── Footnote definition: [^id]: content ──
    const fnDefMatch = trimmed.match(/^\[\^([^\]]+)\]:\s+(.+)/);
    if (fnDefMatch) {
      footnoteDefs.push({ id: fnDefMatch[1]!, content: renderInline(fnDefMatch[2]!, highlightQuery) });
      i++;
      continue;
    }

    // ── Definition list body ──
    if (defMatch) {
      out.push(`<dd>${renderInline(trimmed, highlightQuery)}</dd></dl>`);
      i++;
      continue;
    }

    // Non-list content: flush stacks
    flushListTo(0);

    // Close blockquotes when content is NOT a quote continuation (>)
    // This prevents non-quote content from being wrapped inside <blockquote>
    if (!line.trimStart().startsWith('>')) {
      flushBlockquoteTo(0);
    }

    // ── Regular block ──
    processBlock(line);
    i++;
  }

  // Flush remaining
  flushListTo(0);
  flushBlockquoteTo(0);

  // Close any unclosed callout
  if (inCallout) {
    out.push('</div></div>');
    inCallout = false;
  }

  // ── Footnote definitions section ──
  if (footnoteDefs.length > 0) {
    out.push('<hr class="footnotes-sep">');
    out.push('<section class="footnotes">');
    for (const fn of footnoteDefs) {
      out.push(`<p id="fn:${esc(fn.id)}"><sup>${fn.id}</sup> ${fn.content} <a href="#fnref:${esc(fn.id)}" class="footnote-backref">↩</a></p>`);
    }
    out.push('</section>');
  }

  const outStr = out.join('\n');
  const restored = restore(outStr);

  return DOMPurify.sanitize(restored, SANITIZE_CONFIG);
}

// ── Table rendering ──

function renderTable(rows: string[], highlightQuery: string): string {
  if (rows.length < 2) return '';

  // Parse cells — always produce numCols width per row
  const parsed = rows.map((row) => {
    let r = row.trim();
    // Remove leading/trailing pipes (handles empty first/last cells)
    // We keep empty cells by not trimming around pipes
    const cells: string[] = [];
    const parts = r.split('|');
    let start = 0;
    let end = parts.length;
    if (r.startsWith('|')) start = 1;
    if (r.endsWith('|')) end = parts.length - 1;
    for (let p = start; p < end; p++) {
      cells.push((parts[p] ?? '').trim());
    }
    return cells;
  });

  const sepIdx = parsed.findIndex((row) =>
    row.length > 0 && row.every((c) => /^:?-{3,}:?$/.test(c)),
  );
  if (sepIdx === -1) return '';

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

  let html = '<div class="table-wrapper"><table>';
  if (sepIdx > 0) {
    html += '<thead><tr>';
    for (let c = 0; c < numCols; c++) {
      const align = aligns[c] || 'left';
      html += `<th class="ta-${align}">${renderInline(parsed[0]![c] ?? '', highlightQuery)}</th>`;
    }
    html += '</tr></thead>';
  }
  html += '<tbody>';
  for (let r = sepIdx + 1; r < parsed.length; r++) {
    html += '<tr>';
    for (let c = 0; c < numCols; c++) {
      const align = aligns[c] || 'left';
      html += `<td class="ta-${align}">${renderInline(parsed[r]![c] ?? '', highlightQuery)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
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
