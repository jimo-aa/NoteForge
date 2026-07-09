// NoteForge — Built-in Editor Plugins
// Registers the Phase 2 extensions as EditorPlugin instances.

import type { EditorPlugin, ToolbarItemDef, SlashCommandDef } from './types';
import { getSlashCommands } from '../wysiwyg/extensions/SlashMenu';
import { CodeBlockLang } from '../wysiwyg/extensions/CodeBlockLang';
import { TableHelper } from '../wysiwyg/extensions/TableHelper';
import { TaskCheckbox } from '../wysiwyg/extensions/TaskCheckbox';
import { LinkHover } from '../wysiwyg/extensions/LinkHover';
import { ImageResize } from '../wysiwyg/extensions/ImageResize';

import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import ImageExtension from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { TagMark, CalloutNode, DetailsNode, TableCellAlignment, MermaidNode, MathBlockNode, MathInlineMark } from '../wysiwyg/extensions/CustomExtensions';

const lowlight = createLowlight(common);

// ── Core Extensions Plugin (Phase 1 — always active) ──

export const coreExtensionsPlugin: EditorPlugin = {
  id: 'core-extensions',
  name: '核心编辑器扩展',
  version: '1.0.0',
  description: '基础编辑功能：加粗/斜体/表格/代码块/任务列表等',
  meta: { phase: 'core' },
  extensions: [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false },
      underline: false, // We add Underline separately
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
      HTMLAttributes: { class: 'code-block' },
    }),
    Placeholder.configure({ placeholder: '开始输入...' }),
    ImageExtension,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TextStyle,
    TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
  ],
};

// ── Built-in Extension Plugins (Phase 2) ──

export const codeBlockLangPlugin: EditorPlugin = {
  id: 'code-block-lang',
  name: '代码块语言选择',
  version: '1.0.0',
  description: '代码块右上角显示语言标签和下拉选择器',
  meta: { phase: 'builtin' },
  extensions: CodeBlockLang,
};

export const tableHelperPlugin: EditorPlugin = {
  id: 'table-helper',
  name: '表格键盘导航',
  version: '1.0.0',
  description: '表格内 Tab/Enter/方向键快速导航',
  meta: { phase: 'builtin' },
  extensions: TableHelper,
};

export const taskCheckboxPlugin: EditorPlugin = {
  id: 'task-checkbox',
  name: '任务列表点击切换',
  version: '1.0.0',
  description: 'WYSIWYG 模式下点击复选框切换任务状态',
  meta: { phase: 'builtin' },
  extensions: TaskCheckbox,
};

export const linkHoverPlugin: EditorPlugin = {
  id: 'link-hover',
  name: '链接悬停提示',
  version: '1.0.0',
  description: '鼠标悬停在链接上时显示 URL 提示',
  meta: { phase: 'builtin' },
  extensions: LinkHover,
};

export const imageResizePlugin: EditorPlugin = {
  id: 'image-resize',
  name: '图片拖拽调整',
  version: '1.0.0',
  description: '图片右下角拖拽手柄调整宽高',
  meta: { phase: 'builtin' },
  extensions: ImageResize,
};

// ── Slash Menu Plugin ──

export const slashMenuPlugin: EditorPlugin = {
  id: 'slash-menu',
  name: '斜杠命令菜单',
  version: '1.0.0',
  description: '输入 / 弹出命令面板（4 类 15 个命令）',
  meta: { phase: 'builtin' },
  slashCommands: getSlashCommands().map((cmd): import('./types').SlashCommandDef => ({
    id: cmd.id,
    title: cmd.title,
    desc: cmd.desc,
    category: cmd.category ?? 'custom',
    execute: ({ editor }) => cmd.execute(editor),
  })),
  onActivate(ctx) {
    // Legacy slash commands still use the old module for UI rendering
    // The plugin system will provide the command definitions for future use
  },
};

// ── Markdown Extension Plugins (add preview pipeline hooks) ──

/** Callout/Admonition — already rendered by markdown.ts; marks as plugin for tracking */
export const calloutPlugin: EditorPlugin = {
  id: 'callout',
  name: 'Callout 警示块',
  version: '1.0.0',
  description: '> [!note/warning/tip/danger] 语法支持，6 种类型',
  meta: { phase: 'builtin' },
};

/** Math formula — already rendered as placeholder by markdown.ts */
export const mathPlugin: EditorPlugin = {
  id: 'math',
  name: '数学公式',
  version: '1.0.0',
  description: '$...$ 行内公式 / $$...$$ 块级公式 (KaTeX 占位符)',
  meta: { phase: 'builtin' },
};

/** Mermaid diagram — already rendered as placeholder by markdown.ts */
export const mermaidPlugin: EditorPlugin = {
  id: 'mermaid',
  name: 'Mermaid 图表',
  version: '1.0.0',
  description: '```mermaid 流程图/时序图/甘特图 (占位符渲染)',
  meta: { phase: 'builtin' },
};

/** Wiki Link — [[title]] syntax for bidirectional linking */
export const wikiLinkPlugin: EditorPlugin = {
  id: 'wiki-link',
  name: 'Wiki Link 双向链接',
  version: '1.0.0',
  description: '[[笔记标题]] 语法，点击跳转，悬停预览',
  meta: { phase: 'builtin' },
};

/** Frontmatter — YAML metadata block rendered by markdown.ts */
export const frontmatterPlugin: EditorPlugin = {
  id: 'frontmatter',
  name: 'Frontmatter 元数据',
  version: '1.0.0',
  description: '--- 包裹的 YAML 元数据，展示为属性面板',
  meta: { phase: 'builtin' },
};

/** Footnote — [^id] reference syntax */
export const footnotePlugin: EditorPlugin = {
  id: 'footnote',
  name: '脚注',
  version: '1.0.0',
  description: '[^id] 脚注引用，预览渲染为上标链接',
  meta: { phase: 'builtin' },
};

/** Highlight — ^^text^^ syntax (uses @tiptap/extension-highlight) */
export const highlightPlugin: EditorPlugin = {
  id: 'highlight',
  name: '高亮语法',
  version: '1.0.0',
  description: '^^text^^ 语法，渲染为 <mark> 高亮标签',
  meta: { phase: 'builtin' },
};

/** Tag mark — #tag syntax */
export const tagPlugin: EditorPlugin = {
  id: 'tag-mark',
  name: '标签语法',
  version: '1.0.0',
  description: '#tag 标签语法，渲染为彩色标签',
  meta: { phase: 'builtin' },
  extensions: TagMark,
};

/** Callout node — > [!note/warning/tip/danger] */
export const calloutNodePlugin: EditorPlugin = {
  id: 'callout-node',
  name: 'Callout 节点',
  version: '1.0.0',
  description: 'Callout 警示块 TipTap 节点，保留结构和样式',
  meta: { phase: 'builtin' },
  extensions: CalloutNode,
};

/** Details node — >+++ collapsible details */
export const detailsNodePlugin: EditorPlugin = {
  id: 'details-node',
  name: '可折叠详情',
  version: '1.0.0',
  description: '>+++ 可折叠详情 TipTap 节点',
  meta: { phase: 'builtin' },
  extensions: DetailsNode,
};

/** Table cell alignment */
export const tableAlignmentPlugin: EditorPlugin = {
  id: 'table-alignment',
  name: '表格对齐',
  version: '1.0.0',
  description: '表格列对齐样式 (ta-left/center/right)',
  meta: { phase: 'builtin' },
  extensions: TableCellAlignment,
};

/** Mermaid diagram node */
export const mermaidNodePlugin: EditorPlugin = {
  id: 'mermaid-node',
  name: 'Mermaid 图表节点',
  version: '1.0.0',
  description: '```mermaid 图表，保留源码并渲染 SVG',
  meta: { phase: 'builtin' },
  extensions: MermaidNode,
};

/** Block math node */
export const mathBlockNodePlugin: EditorPlugin = {
  id: 'math-block-node',
  name: '块级公式节点',
  version: '1.0.0',
  description: '$$...$$ 块级公式，保留 LaTeX 并在预览时渲染',
  meta: { phase: 'builtin' },
  extensions: MathBlockNode,
};

/** Inline math mark */
export const mathInlineMarkPlugin: EditorPlugin = {
  id: 'math-inline-mark',
  name: '行内公式标记',
  version: '1.0.0',
  description: '$...$ 行内公式，保留 LaTeX',
  meta: { phase: 'builtin' },
  extensions: MathInlineMark,
};

/** Emoji shortcodes — :smile: → 😊 */
export const emojiPlugin: EditorPlugin = {
  id: 'emoji',
  name: 'Emoji 简码',
  version: '1.0.0',
  description: ':smile: :heart: :rocket: 等 50+ 表情简码',
  meta: { phase: 'builtin' },
};

// ── All built-in plugins ──

export const BUILTIN_PLUGINS: EditorPlugin[] = [
  coreExtensionsPlugin,
  codeBlockLangPlugin,
  tableHelperPlugin,
  taskCheckboxPlugin,
  linkHoverPlugin,
  imageResizePlugin,
  slashMenuPlugin,
  calloutPlugin,
  mathPlugin,
  mermaidPlugin,
  wikiLinkPlugin,
  frontmatterPlugin,
  footnotePlugin,
  highlightPlugin,
  emojiPlugin,
  tagPlugin,
  calloutNodePlugin,
  detailsNodePlugin,
  tableAlignmentPlugin,
  mermaidNodePlugin,
  mathBlockNodePlugin,
  mathInlineMarkPlugin,
];

/** Create the default PluginManager with all built-in plugins registered */
export function registerBuiltinPlugins(manager: import('./PluginManager').PluginManager): void {
  for (const plugin of BUILTIN_PLUGINS) {
    manager.register(plugin);
  }
}
