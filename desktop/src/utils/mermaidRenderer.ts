// NoteForge — Mermaid 图表渲染器
// 在预览面板中查找 .mermaid-block 元素并调用 mermaid.js 渲染

let _mermaidLoaded = false;

/** Get the mermaid render API (handles both ESM default and namespace) */
async function getMermaid(): Promise<{ render: (id: string, code: string) => Promise<{ svg: string }> }> {
  if (!_mermaidLoaded) {
    const mod = await import('mermaid');
    const m = (mod as any).default ?? mod;
    m.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    });
    _mermaidLoaded = true;
    return m;
  }
  // Already loaded — return the cached render function
  const mod = await import('mermaid');
  return (mod as any).default ?? mod;
}

/** 在指定容器内渲染所有 mermaid 块 */
export async function renderMermaidBlocks(container: HTMLElement): Promise<void> {
  const blocks = container.querySelectorAll<HTMLElement>('.mermaid-block[data-code]');
  if (blocks.length === 0) return;

  try {
    const mermaid = await getMermaid();

    for (const block of blocks) {
      const code = block.getAttribute('data-code') || '';
      if (!code) continue;

      // Generate a unique ID for this mermaid diagram
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        const { svg } = await mermaid.render(id, unescapeHtml(code));
        block.innerHTML = svg;
        block.classList.add('mermaid-rendered');
        block.classList.remove('mermaid-block');
      } catch (err) {
        console.error('[Mermaid] Render failed:', err);
        block.innerHTML = `<div class="mermaid-error">❌ 图表渲染失败: ${(err as Error).message}</div>`;
      }
    }
  } catch (err) {
    console.error('[Mermaid] Failed to load mermaid:', err);
  }
}

/** 简易 HTML 实体反转义 */
function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
