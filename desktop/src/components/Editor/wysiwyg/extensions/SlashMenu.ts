// NoteForge — Slash Menu Definitions
// Slash command definitions for the editor.
// The actual UI rendering is handled by the legacy slashCommands.ts module.

import type { SlashCommandItem } from '../../types/extensions';

const BUILTIN_COMMANDS: SlashCommandItem[] = [
  { id: 'h1', title: '标题 1', desc: '大标题', category: 'heading', execute: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2', title: '标题 2', desc: '中标题', category: 'heading', execute: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3', title: '标题 3', desc: '小标题', category: 'heading', execute: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'paragraph', title: '段落', desc: '普通文本', category: 'heading', execute: (e) => e.chain().focus().setParagraph().run() },
  { id: 'bold', title: '粗体', desc: '加粗文本', category: 'format', execute: (e) => e.chain().focus().toggleBold().run() },
  { id: 'italic', title: '斜体', desc: '斜体文本', category: 'format', execute: (e) => e.chain().focus().toggleItalic().run() },
  { id: 'code', title: '行内代码', desc: '代码片段', category: 'format', execute: (e) => e.chain().focus().toggleCode().run() },
  { id: 'strike', title: '删除线', desc: '删除文本', category: 'format', execute: (e) => e.chain().focus().toggleStrike().run() },
  { id: 'code-block', title: '代码块', desc: '代码 + 语法高亮', category: 'block', execute: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: 'quote', title: '引用', desc: '块级引用', category: 'block', execute: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'hr', title: '分割线', desc: '水平分割线', category: 'block', execute: (e) => e.chain().focus().setHorizontalRule().run() },
  { id: 'table', title: '表格', desc: '插入 3x3 表格', category: 'media', execute: (e) => { e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); } },
  { id: 'bullet', title: '无序列表', desc: '圆点列表', category: 'block', execute: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'number', title: '有序列表', desc: '编号列表', category: 'block', execute: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'task', title: '任务列表', desc: '复选框', category: 'block', execute: (e) => e.chain().focus().toggleTaskList().run() },
];

export function getSlashCommands(): SlashCommandItem[] {
  return [...BUILTIN_COMMANDS];
}
