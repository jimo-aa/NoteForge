// NoteForge — KaTeX 数学公式渲染器
// 在预览面板中查找 .math-block 和 .math-inline 元素并调用 KaTeX 渲染

import 'katex/dist/katex.min.css';

let _katexLoaded = false;

/** Get the katex render function from the module (handles CJS/ESM interop) */
async function getKatexRender(): Promise<(latex: string, opts: any) => string> {
  _katexLoaded = true;
  const mod = await import('katex');
  // Handle both `import katex from 'katex'` and `import * as katex from 'katex'`
  const katex = (mod as any).default ?? mod;
  return katex.renderToString.bind(katex);
}

/** 在指定容器内渲染所有数学公式块 */
export async function renderMathBlocks(container: HTMLElement): Promise<void> {
  // Block math $$...$$
  const blocks = container.querySelectorAll<HTMLElement>('.math-block[data-latex]');
  // Inline math $...$
  const inlineMath = container.querySelectorAll<HTMLElement>('.math-inline[data-latex]');

  if (blocks.length === 0 && inlineMath.length === 0) return;

  try {
    const renderToString = await getKatexRender();

    for (const el of blocks) {
      const latex = el.getAttribute('data-latex') || '';
      if (!latex) continue;
      try {
        el.innerHTML = renderToString(latex, {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        });
        el.classList.remove('math-block');
        el.classList.add('math-rendered');
      } catch (err) {
        console.error('[KaTeX] Block render failed:', err);
        el.innerHTML = `<span class="math-error">❌ ${(err as Error).message}</span>`;
      }
    }

    for (const el of inlineMath) {
      const latex = el.getAttribute('data-latex') || '';
      if (!latex) continue;
      try {
        const html = renderToString(latex, {
          displayMode: false,
          throwOnError: false,
          output: 'html',
        });
        el.outerHTML = html;
      } catch (err) {
        console.error('[KaTeX] Inline render failed:', err);
        el.innerHTML = `<span class="math-error">${latex}</span>`;
      }
    }
  } catch (err) {
    console.error('[KaTeX] Failed to load:', err);
  }
}
