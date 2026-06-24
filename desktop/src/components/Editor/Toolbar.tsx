interface ToolbarProps {
  onWrap: (before: string, after: string) => void;
  onInsert: (text: string) => void;
}

export function Toolbar({ onWrap, onInsert }: ToolbarProps) {
  const btns = [
    { label: <b>B</b>, title: '加粗 (Ctrl+B)', action: () => onWrap('**', '**') },
    { label: <i>I</i>, title: '斜体 (Ctrl+I)', action: () => onWrap('*', '*') },
    { label: <s>S</s>, title: '删除线', action: () => onWrap('~~', '~~') },
    { label: <code>`</code>, title: '行内代码', action: () => onWrap('`', '`') },
    null as any, // separator
    { label: 'H', title: '标题', action: () => onInsert('\n## ') },
    { label: '•', title: '无序列表', action: () => onInsert('\n- ') },
    { label: '1.', title: '有序列表', action: () => onInsert('\n1. ') },
    { label: '☐', title: '待办', action: () => onInsert('\n- [ ] ') },
    { label: '❝', title: '引用', action: () => onInsert('\n> ') },
    { label: '</>', title: '代码块', action: () => onInsert('\n```\n\n```') },
    null as any,
    { label: '🔗', title: '链接', action: () => onInsert('[文本](url)') },
    { label: '⊞', title: '表格', action: () => onInsert('\n| 表头 | 表头 |\n|------|------|\n| 数据 | 数据 |') },
    { label: '—', title: '分割线', action: () => onInsert('\n---\n') },
  ];

  return (
    <div className="toolbar">
      {btns.map((b, i) =>
        b === null ? <span key={i} className="sep" /> : (
          <button key={i} title={b.title} onClick={b.action}>{b.label}</button>
        )
      )}
      <span className="spacer" />
    </div>
  );
}
