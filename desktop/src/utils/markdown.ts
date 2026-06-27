// NoteForge — Markdown 渲染引擎（离线可用）

import DOMPurify from 'dompurify';

export function renderMarkdown(md: string, highlightQuery = ''): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inTable = false;
  let inCode = false;
  const codeBuf: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  function flushList() {
    if (listType) { out.push(`</${listType === 'ul' ? 'ul' : 'ol'}>`); listType = null; }
  }

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; continue; }
      inCode = false;
      const code = escapeHtml(codeBuf.join('\n'));
      out.push(`<pre class="code-block"><code>${code}</code></pre>`);
      codeBuf.length = 0;
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    if (!line.trim()) { flushList(); out.push('<p class="empty-line"></p>'); continue; }
    const hMatch = line.match(/^(#{1,6})\s(.+)/);
    if (hMatch) { flushList(); if (inTable) { out.push('</table>'); inTable = false; } out.push(`<h${hMatch[1].length}>${inlineMd(hMatch[2], highlightQuery)}</h${hMatch[1].length}>`); continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flushList(); out.push('<hr>'); continue; }
    if (line.startsWith('> ')) { flushList(); out.push(`<blockquote class="quote-block">${inlineMd(line.slice(2), highlightQuery)}</blockquote>`); continue; }
    if (/^- \[[ xX]\] /.test(line)) { const done = line[3] === 'x' || line[3] === 'X'; if (listType !== 'ul') { flushList(); listType = 'ul'; out.push('<ul class="task-list">'); } out.push(`<li class="${done ? 'task-done' : ''}">${done ? '✅' : '⬜'} ${inlineMd(line.slice(6), highlightQuery)}</li>`); continue; }
    if (/^[-*+]\s/.test(line)) { if (listType !== 'ul') { flushList(); listType = 'ul'; out.push('<ul>'); } out.push(`<li>${inlineMd(line.replace(/^[-*+]\s/, ''), highlightQuery)}</li>`); continue; }
    const olMatch = line.match(/^(\d+)\.\s(.+)/);
    if (olMatch) { if (listType !== 'ol') { flushList(); listType = 'ol'; out.push('<ol>'); } out.push(`<li>${inlineMd(olMatch[2], highlightQuery)}</li>`); continue; }
    if (line.startsWith('|')) { flushList(); const cells = line.split('|').filter(c => c.trim()).map(c => inlineMd(c.trim(), highlightQuery)); const isSep = /^[\s:|:-]+$/.test(line); if (!inTable && !isSep) { inTable = true; out.push('<table>'); } if (!isSep) { out.push(`<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`); } continue; }
    if (inTable) { out.push('</table>'); inTable = false; }
    flushList();
    out.push(`<p>${inlineMd(line, highlightQuery)}</p>`);
  }
  flushList();
  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  if (inTable) out.push('</table>');
  return DOMPurify.sanitize(out.join('\n'));
}

function inlineMd(text: string, highlightQuery = ''): string {
  let r = escapeHtml(text);
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
  r = r.replace(/~~(.+?)~~/g, '<s>$1</s>');
  r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
  r = r.replace(/\[\[([^\]]+)\]\]/g, '<a class="wiki-link">$1</a>');
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  if (highlightQuery.trim()) {
    const escaped = escapeRegExp(highlightQuery.trim());
    if (escaped) {
      const regex = new RegExp(`(${escaped})`, 'gi');
      r = r.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
  }
  r = r.replace(/(?<!\w)(#[\w\u4e00-\u9fff\-/]+)/gu, '<span class="tag">$1</span>');
  r = r.replace(/\n/g, '<br>');
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
  return md.replace(/```[\s\S]*?```/g, '').replace(/#{1,6}\s/g, '').replace(/[*~`\[\]]/g, '').replace(/\n+/g, ' ');
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
