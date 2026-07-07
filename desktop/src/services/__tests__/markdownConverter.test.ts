import { describe, it, expect } from 'vitest';
import { markdownToHtml, htmlToMarkdown } from '../markdownConverter';

function roundtrip(md: string): string {
  return htmlToMarkdown(markdownToHtml(md));
}

describe('markdownConverter', () => {
  it('handles empty input', () => {
    expect(markdownToHtml('')).toBe('<p></p>');
    expect(htmlToMarkdown('')).toBe('');
  });

  it('converts bold text', () => {
    const html = markdownToHtml('**bold**');
    expect(html).toContain('<strong>bold</strong>');
    expect(roundtrip('**bold**')).toContain('**bold**');
  });

  it('converts italic text', () => {
    const html = markdownToHtml('*italic*');
    expect(html).toContain('<em>italic</em>');
    expect(roundtrip('*italic*')).toContain('*italic*');
  });

  it('converts bold+italic combined', () => {
    const html = markdownToHtml('***bold italic***');
    expect(html).toContain('<strong><em>bold italic</em></strong>');
    expect(roundtrip('***bold italic***')).toContain('***bold italic***');
  });

  it('converts strikethrough', () => {
    const html = markdownToHtml('~~struck~~');
    expect(html).toContain('<s>struck</s>');
    expect(roundtrip('~~struck~~')).toContain('~~struck~~');
  });

  it('converts headings', () => {
    expect(markdownToHtml('# H1')).toContain('<h1>H1</h1>');
    expect(markdownToHtml('## H2')).toContain('<h2>H2</h2>');
    expect(markdownToHtml('### H3')).toContain('<h3>H3</h3>');
    expect(roundtrip('# H1')).toContain('# H1');
  });

  it('preserves code block with language', () => {
    const md = '```ts\nconst x = 1;\n```';
    const html = markdownToHtml(md);
    expect(html).toContain('class="language-ts"');
    expect(html).toContain('const x = 1;');
    // Roundtrip should preserve language
    const rt = roundtrip(md);
    expect(rt).toContain('```ts');
    expect(rt).toContain('const x = 1;');
  });

  it('preserves code block without language', () => {
    const md = '```\nplain code\n```';
    const html = markdownToHtml(md);
    expect(html).toContain('<pre><code>');
    const rt = roundtrip(md);
    expect(rt).toContain('plain code');
  });

  it('converts table with alignment', () => {
    const md = '| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |';
    const html = markdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th');
    expect(html).toContain('style="text-align:center"');
    expect(html).toContain('style="text-align:right"');
    // Roundtrip should preserve alignment
    const rt = roundtrip(md);
    expect(rt).toContain('| L | C | R |');
  });

  it('converts simple table', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const html = markdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('handles nested lists', () => {
    const md = '- A\n  - B\n  - C\n- D';
    const html = markdownToHtml(md);
    expect(html).toContain('<li>A</li>');
    // Nested should have sub-list
    expect(html).toContain('<ul>');
    const rt = roundtrip(md);
    expect(rt).toContain('- A');
    expect(rt).toContain('- D');
  });

  it('preserves image alt text', () => {
    const md = '![Logo](https://x.com/logo.png)';
    const html = markdownToHtml(md);
    expect(html).toContain('alt="Logo"');
    expect(html).toContain('src="https://x.com/logo.png"');
    expect(roundtrip(md)).toContain('![Logo](https://x.com/logo.png)');
  });

  it('converts image without alt', () => {
    const md = '![](https://x.com/img.png)';
    expect(roundtrip(md)).toContain('![](https://x.com/img.png)');
  });

  it('converts links', () => {
    const md = '[text](https://example.com)';
    const html = markdownToHtml(md);
    expect(html).toContain('<a href="https://example.com">text</a>');
    expect(roundtrip(md)).toContain('[text](https://example.com)');
  });

  it('converts task list - checked', () => {
    const md = '- [x] done';
    const html = markdownToHtml(md);
    expect(html).toContain('checked');
    expect(html).toContain('done');
  });

  it('converts task list - unchecked', () => {
    const md = '- [ ] todo';
    const html = markdownToHtml(md);
    expect(html).toContain('disabled');
    expect(html).toContain('todo');
  });

  it('handles complex document', () => {
    const md = [
      '# Title',
      '',
      'Paragraph with **bold** and *italic*.',
      '',
      '```ts',
      'function hello() {',
      '  return "world";',
      '}',
      '```',
      '',
      '| Name | Value |',
      '| --- | --- |',
      '| A | 1 |',
      '| B | 2 |',
      '',
      '- Item 1',
      '- Item 2',
    ].join('\n');

    const html = markdownToHtml(md);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('class="language-ts"');
    expect(html).toContain('<table>');
    expect(html).toContain('<li>Item 1</li>');

    const rt = roundtrip(md);
    expect(rt).toContain('# Title');
    expect(rt).toContain('```ts');
    expect(rt).toContain('function hello');
  });

  it('converts inline code', () => {
    expect(markdownToHtml('`code`')).toContain('<code>code</code>');
    expect(roundtrip('`code`')).toContain('`code`');
  });

  it('handles html entities', () => {
    const md = 'AT&T';
    const html = markdownToHtml(md);
    expect(html).toContain('AT&amp;T');
  });

  // ── Regression: plain text heading should NOT produce table HTML ──
  it('plain heading does not produce table HTML', () => {
    const html = markdownToHtml('# 123');
    expect(html).not.toContain('<table');
    expect(html).toContain('<h1>');
  });

  it('roundtrip heading does not contain table tags', () => {
    const result = roundtrip('## Hello World');
    expect(result).not.toContain('<table');
    expect(result).toContain('## Hello World');
  });

  it('roundtrip plain text does not produce tables', () => {
    const result = roundtrip('Just some plain text here.\n\nAnd another paragraph.');
    expect(result).not.toContain('<table');
    expect(result).toContain('Just some plain text');
  });

  it('does not leak TABLE_ROW markers', () => {
    const result = markdownToHtml('Some text\n\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(result).not.toContain('%%TABLE_ROW%%');
    expect(result).not.toContain('%%CELL%%');
    expect(result).toContain('<table>');
  });
});
