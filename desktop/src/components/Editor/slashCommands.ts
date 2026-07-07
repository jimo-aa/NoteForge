// NoteForge — TipTap Slash Commands

import { type Editor } from "@tiptap/react";

export interface CommandItem {
  id: string;
  title: string;
  desc: string;
  execute: (editor: Editor) => void;
}

export const SLASH_COMMANDS: CommandItem[] = [
  { id: "h1", title: "标题 1", desc: "大标题", execute: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: "h2", title: "标题 2", desc: "中标题", execute: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: "h3", title: "标题 3", desc: "小标题", execute: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: "ul", title: "无序列表", desc: "圆点列表", execute: (e) => e.chain().focus().toggleBulletList().run() },
  { id: "ol", title: "有序列表", desc: "编号列表", execute: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: "task", title: "任务列表", desc: "复选框", execute: (e) => e.chain().focus().toggleTaskList().run() },
  { id: "quote", title: "引用", desc: "块级引用", execute: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: "code", title: "代码块", desc: "代码 + 语法高亮", execute: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: "table", title: "表格", desc: "插入 3x3 表格", execute: (e) => { e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); } },
  { id: "hr", title: "分割线", desc: "水平分割线", execute: (e) => e.chain().focus().setHorizontalRule().run() },
];

let menuEl: HTMLDivElement | null = null;
let savedEditor: Editor | null = null;
let savedRange: { from: number; to: number } | null = null;
let currentIdx = 0;
let kbHandler: (e: KeyboardEvent) => void = () => {};
let outsideHandler: (e: MouseEvent) => void = () => {};

function cleanup() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
  document.removeEventListener("keydown", kbHandler);
  document.removeEventListener("mousedown", outsideHandler);
  kbHandler = () => {};
  outsideHandler = () => {};
  savedEditor = null;
  savedRange = null;
  currentIdx = 0;
}

function exec(item: CommandItem) {
  const editor = savedEditor;
  const range = savedRange;
  cleanup();
  if (!editor || !range) return;

  // Delete the "/" character first
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .run();

  // Execute the item command synchronously.
  // TipTap's chain API handles document state transitions correctly
  // for sequential transactions.
  item.execute(editor);
}

export function checkAndShowSlashMenu(editor: Editor) {
  const { from } = editor.state.selection;
  if (from <= 1) { cleanup(); return; }
  const charBefore = editor.state.doc.textBetween(from - 1, from);
  if (charBefore !== "/") { cleanup(); return; }
  const $pos = editor.state.doc.resolve(from);
  const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, "\n", " ");
  if (textBefore !== "/") { cleanup(); return; }

  cleanup();
  savedEditor = editor;
  savedRange = { from: from - 1, to: from };

  menuEl = document.createElement("div");
  menuEl.className = "slash-menu";

  function render(idx: number) {
    if (!menuEl) return;
    menuEl.innerHTML = "";
    SLASH_COMMANDS.forEach((item, i) => {
      const btn = document.createElement("button");
      const active = i === idx;
      btn.style.cssText = "display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;border-radius:6px;background:" + (active ? "var(--accent)" : "transparent") + ";color:" + (active ? "#fff" : "var(--text-soft)") + ";cursor:pointer;font-size:13px;text-align:left;";
      btn.innerHTML = "<div><div style=\"font-weight:500\">" + item.title + "</div><div style=\"font-size:11px;color:" + (active ? "rgba(255,255,255,0.75)" : "var(--text-muted)") + ";margin-top:1px\">" + item.desc + "</div></div>";
      btn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
      btn.onmouseup = (e) => { e.preventDefault(); e.stopPropagation(); exec(item); };
      btn.onmouseenter = () => { currentIdx = i; render(currentIdx); };
      menuEl!.appendChild(btn);
    });
  }
  render(0);
  document.body.appendChild(menuEl);

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r) { menuEl.style.top = (r.bottom + 4) + "px"; menuEl.style.left = Math.max(4, r.left) + "px"; }
  }

  const kbd = (e: KeyboardEvent) => {
    if (!menuEl) return;
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopImmediatePropagation(); currentIdx = Math.min(currentIdx + 1, SLASH_COMMANDS.length - 1); render(currentIdx); }
    else if (e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); currentIdx = Math.max(currentIdx - 1, 0); render(currentIdx); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); if (savedEditor) exec(SLASH_COMMANDS[currentIdx] || SLASH_COMMANDS[0]!); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); cleanup(); }
  };
  kbHandler = kbd;
  // Use capturing phase (true) so the handler fires BEFORE ProseMirror processes the key
  document.addEventListener("keydown", kbHandler, true);

  const out = (e: MouseEvent) => {
    if (menuEl && !menuEl.contains(e.target as Node)) cleanup();
  };
  outsideHandler = out;
  setTimeout(() => document.addEventListener("mousedown", outsideHandler), 50);
}
