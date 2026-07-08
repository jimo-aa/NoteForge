# NoteForge Markdown 所见即所得编辑器 — 功能规格文档

> **文档版本:** v2.1
> **最后更新:** 2026-07-08
> **当前状态:** Phase 1 基础架构完成 ✅ | Phase 2 扩展文件就绪但未接入 ⚠️ | 编辑器实际运行于 源码+预览 双栏模式
> **编辑器架构:** CodeMirror 6 源码编辑 + HTML 预览 (双栏) — TipTap WYSIWYG 就绪但未接入主流程
> **核心能力:** Markdown ↔ HTML 双向转换，源码+预览 双栏模式，可扩展插件体系

---

## 一、编辑器总体架构

### 1.1 分层架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         表示层 (UI Layer)                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  EditorContainer (编辑器容器)                                          │    │
│  │  ├── EditorToolbar        (工具栏: 格式化/B/I/U/标题/表格/代码/链接)     │    │
│  │  ├── EditorTabs           (标签栏: 标签展示/添加/版本历史入口)          │    │
│  │  ├── DocumentHeader       (文档头: 标题输入/收藏/固定/操作按钮)         │    │
│  │  ├── EditorModeSwitcher   (模式切换: WYSIWYG ↔ 源码)                  │    │
│  │  ├── EditorBody ─────────────────────────────────────────────────    │    │
│  │  │  ├── WysiwygEditor     (TipTap 所见即所得)      │ SourceEditor    │    │
│  │  │  │  ├── RichTextToolbar  (浮动格式栏)           │ (CodeMirror 6)  │    │
│  │  │  │  ├── SlashMenu        (斜杠命令弹出)         │ 语法高亮        │    │
│  │  │  │  ├── LinkModal        (链接输入弹窗)         │ 装饰渲染        │    │
│  │  │  │  ├── ImageModal       (图片URL弹窗)          │ 搜索高亮        │    │
│  │  │  │  └── CodeBlockLangSelector (语言选择器)      │ Wiki Link 高亮  │    │
│  │  │  └─────────────────────────────────────────────────────────    │    │
│  │  ├── PreviewPane         (预览面板 — 双栏模式)                       │    │
│  │  ├── AIToolbar           (AI 工具栏 — 浮动)                          │    │
│  │  ├── AttachmentPanel     (附件面板)                                 │    │
│  │  ├── BacklinksPanel      (反向链接面板)                              │    │
│  │  ├── OutlinePanel        (文档大纲)                                 │    │
│  │  ├── TagModal            (标签编辑弹窗)                              │    │
│  │  └── StatusBar           (状态栏: 保存状态/字数/同步)                 │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                      编辑器逻辑层 (Editor Logic Layer)                         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  EditorController (编辑器控制器 — 核心协调)                             │    │
│  │                                                                      │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │    │
│  │  │  ModeManager  │ │ ContentSync  │ │  History     │ │  Selection   │ │    │
│  │  │  模式切换管理   │ │ 双引擎同步    │ │  Undo/Redo   │ │  选区管理     │ │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │    │
│  │  │  DragDrop    │ │  Clipboard   │ │  AutoSave    │ │  Keyboard    │ │    │
│  │  │  拖拽管理     │ │  剪贴板处理   │ │  自动保存     │ │  快捷键路由   │ │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                    转换与解析层 (Transform Layer)                              │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  ConverterEngine (转换引擎)                                            │    │
│  │                                                                      │    │
│  │  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────┐  │    │
│  │  │  MarkdownToHtml    │  │  HtmlToMarkdown    │  │  Sanitizer     │  │    │
│  │  │  MD → HTML 转换    │  │  HTML → MD 转换    │  │  HTML 清洗/安全 │  │    │
│  │  │  - 代码块保护       │  │  - 反向映射         │  │  - XSS 防护    │  │    │
│  │  │  - 表格对齐保留     │  │  - 属性抽取         │  │  - 标签白名单   │  │    │
│  │  │  - 嵌套列表         │  │  - 嵌套列表恢复      │  │  - 样式净化    │  │    │
│  │  └────────────────────┘  └────────────────────┘  └────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌────────────────────┐  ┌──────────────────────────────────────┐   │    │
│  │  │  Parser (解析器)    │  │  Serializer (序列化器)                 │   │    │
│  │  │  - Markdown AST    │  │  - HTML → Markdown                   │   │    │
│  │  │  - Wiki Link 提取  │  │  - 自定义序列化规则                   │   │    │
│  │  │  - 标签提取        │  │  - 格式化输出                        │   │    │
│  │  │  - Frontmatter     │  │                                      │   │    │
│  │  └────────────────────┘  └──────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                      扩展系统层 (Extension Layer)                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  PluginManager (插件管理器)                                            │    │
│  │                                                                      │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │    │
│  │  │  Core      │ │  Markdown  │ │  AI        │ │  Third     │        │    │
│  │  │  Extensions│ │  Extensions│ │  Extensions│ │  Party     │        │    │
│  │  │            │ │            │ │            │ │  Plugins   │        │    │
│  │  │ - Starter  │ │ - WikiLink│ │ - AIWriter │ │ (Future)   │        │    │
│  │  │ - Table    │ │ - Math    │ │ - AutoTag  │ │            │        │    │
│  │  │ - Code     │ │ - Mermaid │ │ - Smart    │ │            │        │    │
│  │  │ - Image    │ │ - Callout │ │   Complete │ │            │        │    │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                        数据层 (Data Layer)                                    │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐ │
│  │  NoteStore         │  │  DraftManager      │  │  SyncEngine            │ │
│  │  (Zustand 状态)    │  │  (草稿持久化)       │  │  (同步引擎)             │ │
│  │  - 当前笔记         │  │  - localStorage    │  │  - 变更队列             │ │
│  │  - 内容/标题/标签   │  │  - 崩溃恢复         │  │  - 冲突检测             │ │
│  │  - 光标位置         │  │  - 版本快照         │  │  - 远程同步             │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────┘ │
│                                                                              │
│  ┌────────────────────┐  ┌───────────────────────────────────────────────┐  │
│  │  Rust Core FFI     │  │  Backend API Client                            │  │
│  │  - Markdown 解析   │  │  - AI 服务 (写作/标签/搜索)                     │  │
│  │  - 全文搜索        │  │  - 同步服务                                    │  │
│  │  - 加密/解密       │  │  - 附件上传                                    │  │
│  └────────────────────┘  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 组件文件结构 (当前状态)

```
desktop/src/components/Editor/
├── index.ts                         ← 统一导出 ........................ ✅ Phase 1
├── EditorContainer.tsx              ← 编辑器容器 (顶层协调) ........... ✅ Phase 1
├── EditorToolbar.tsx                ← 主工具栏 ....................... ✅ Phase 1
├── EditorTabs.tsx                   ← 标签栏 ......................... ✅ Phase 1
├── DocumentHeader.tsx               ← 标题栏 + 操作 .................. ✅ Phase 1
├── StatusBar.tsx                    ← 状态栏 ......................... ✅ Phase 1
│
├── wysiwyg/                         ← WYSIWYG 模块
│   ├── WysiwygEditor.tsx            ← TipTap 编辑器封装 .............. ✅ Phase 1
│   ├── RichTextToolbar.tsx          ← 浮动格式工具栏 ................. ✅ (保留旧文件)
│   ├── extensions/                  ← TipTap 扩展
│   │   │   ├── index.ts                 ← 扩展统一注册 (getCoreExtensions / getBuiltinExtensions / getAllExtensions) ... ✅ Phase 1+2
│   │   │                                ⚠️ getBuiltinExtensions() 返回空数组 — 扩展未注册
│   │   ├── SlashMenu.ts            ← 斜杠命令定义 (@tiptap/suggestion) ......... ✅ Phase 2 (定义就绪, 需接入编辑器)
│   │   ├── SearchHighlight.ts       ← 搜索高亮 ............................. ✅ Phase 2 (定义就绪, 需接入编辑器)
│   │   ├── ImageResize.ts          ← 图片拖拽调整 (width/height 属性模型) .... ✅ Phase 2 (定义就绪, 需接入编辑器)
│   │   ├── CodeBlockLang.ts        ← 代码块语言选择扩展 .................... ✅ Phase 2 (定义就绪, 需接入编辑器)
│   │   ├── TaskCheckbox.ts          ← 任务列表点击扩展 .................... ✅ Phase 2 (定义就绪, 需接入编辑器)
│   │   ├── LinkHover.ts            ← 链接悬停预览 tooltip ................. ✅ Phase 2 (定义就绪, 需接入编辑器)
│   │   ├── TableHelper.ts          ← 表格键盘导航 + 快捷键 ............... ✅ Phase 2 (定义就绪, 需接入编辑器)
│   │   ├── WikiLinkNode.ts         ← Wiki Link节点 ..................... ⬜ Phase 3
│   │   ├── CalloutNode.ts          ← 警示块节点 ........................ ⬜ Phase 3
│   │   ├── MathNode.ts             ← 数学公式节点 ....................... ⬜ Phase 3
│   │   └── MermaidNode.ts          ← Mermaid 图表节点 ................... ⬜ Phase 3
│   └── nodes/                       ← 自定义 NodeView ............... ⬜ Phase 3
│
├── source/                          ← 源码模式模块
│   ├── SourceEditor.tsx             ← CodeMirror 6 封装 .............. ✅ Phase 1
│   ├── extensions/                  ← CM6 扩展 ....................... ⬜ Phase 3
│   └── syntax/                     ← 语法定义 ....................... ⬜ Phase 3
│
├── panels/                          ← 面板模块 ....................... ⬜ Phase 4
│
├── ai/                              ← AI 模块 (❌ 目录为空 — 尚未重构)
│   ├── AIToolbar.tsx               ← AI 浮动工具栏 .................. ✅ (保留旧文件在根目录)
│   ├── AIService.ts                ← AI API 客户端 .................. ❌ (不存在)
│   └── types.ts                    ← AI 类型定义 .................... ❌
│
├── modals/                          ← 弹窗模块 (❌ 目录为空 — 尚未实现) ..... ⬜ Phase 2
│
├── converters/                      ← 转换器模块
│   ├── index.ts                     ← 统一导出 ...................... ✅ Phase 1
│   ├── markdownToHtml.ts           ← MD → HTML (薄封装, 委托旧服务) .. ✅ Phase 1 (再导出)
│   ├── htmlToMarkdown.ts           ← HTML → MD (薄封装, 委托旧服务) .. ✅ Phase 1 (再导出)
│   ├── sanitizer.ts                ← HTML 安全清洗 (DOMPurify) ...... ✅ Phase 1
│   └── __tests__/                  ← 转换器测试 (目录为空 ❌ — 尚未迁移)
│       ├── markdownToHtml.test.ts   ........................... ❌ 测试在 services/__tests__/ 中
│       └── htmlToMarkdown.test.ts   ........................... ❌ 同上
│
├── controller/                      ← 控制器模块
│   ├── EditorController.ts         ← 核心控制器 ..................... ✅ Phase 1
│   ├── ModeManager.ts             ← 模式切换管理 .................... ✅ Phase 1
│   ├── ContentSync.ts             ← 双引擎内容同步 .................. ✅ Phase 1
│   ├── EventBus.ts                 ← 事件总线 ....................... ✅ Phase 1
│   └── KeyboardShortcuts.ts       ← 快捷键注册 ..................... ✅ Phase 1
│
├── plugins/                         ← 插件扩展 (❌ 目录为空 — 尚未实现)
│   ├── PluginManager.ts           ← 插件注册/生命周期 .............. ❌ Phase 2 (未创建)
│   └── PluginAPI.ts               ← 插件 API 定义 .................. ❌ Phase 2 (未创建)
│
├── hooks/                           ← React Hooks .................... ⬜ Phase 2
│
├── types/                           ← 类型定义
│   ├── editor.ts                   ← 编辑器核心类型 .................. ✅ Phase 1
│   ├── extensions.ts               ← 扩展类型 ....................... ✅ Phase 1
│   └── events.ts                   ← 事件系统类型 ................... ✅ Phase 1
│
├── styles/                          ← 样式 (❌ 目录为空 — 尚未迁移) ....... ⬜ Phase 1-5
│
└── (保留旧文件: AIToolbar.tsx, AttachmentPanel.tsx, RichTextToolbar.tsx, searchHighlight.ts, slashCommands.ts, RichTextEditor.tsx (577行含内联扩展注册))
```

### 1.3 数据流设计

> **当前实际状态:** EditorContainer 运行于 源码+预览 双栏模式 (CodeMirror 6 → HTML 预览)。
> WYSIWYG 编辑器 (TipTap) 已封装为独立组件 (`WysiwygEditor.tsx`)，但尚未接入主流程。
> 以下架构为目标设计，WYSIWYG 接入后生效。

```
┌──────────────┐    用户输入    ┌──────────────────────────────────────────────┐
│              │ ──────────────▶│                                            │
│  用户操作     │               │           EditorController                  │
│  (键盘/鼠标)  │               │                                            │
│              │◀──────────────│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
└──────────────┘   UI 反馈     │  │Input Route│  │  Command  │  │  Event   │  │
                               │  │  输入路由  │  │ 命令分发   │  │  事件总线 │  │
                               │  └─────┬────┘  └─────┬────┘  └────┬─────┘  │
                               └────────┼──────────────┼────────────┼────────┘
                                        │              │            │
                        ┌───────────────┘              │            └───────────────┐
                        ▼                              ▼                            ▼
              ┌──────────────────┐          ┌────────────────────┐     ┌──────────────────┐
              │  WYSIWYG Engine  │          │  Source Engine     │     │   Event Bus      │
              │  (TipTap)        │          │  (CodeMirror 6)    │     │                  │
              │                  │          │                    │     │  - onSave        │
              │  HTML 输出       │          │  Markdown 输出     │     │  - onModeSwitch  │
              └────────┬─────────┘          └────────┬───────────┘     │  - onSearch      │
                       │                            │                  │  - onTagChange   │
                       └──────────┬─────────────────┘                  │  - onSync        │
                                  ▼                                    │  - onError       │
                    ┌──────────────────────────┐                       └──────────────────┘
                    │    ContentSync (同步器)    │
                    │                          │
                    │  1. WYSIWYG → getHTML()  │
                    │  2. htmlToMarkdown(html) │
                    │  3. setSourceContent(md) │
                    │                         │
                    │  1. Source → getContent()│
                    │  2. markdownToHtml(md)  │
                    │  3. editor.setContent() │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │    AutoSave (自动保存)     │
                    │   300ms debounce          │
                    │   → NoteStore.update()    │
                    │   → DraftManager.save()   │
                    └──────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │    NoteStore (Zustand)    │
                    │   → 更新笔记内容/标题/标签  │
                    │   → 触发 UI 重渲染         │
                    └──────────────────────────┘
```

### 1.4 设计原则

| 原则 | 说明 |
|------|------|
| **所见即所得** | 编辑时看到的就是最终渲染效果，无需切换预览 |
| **原生 HTML 渲染** | 编辑器中直接渲染 HTML 标签，支持富文本嵌入 |
| **双模式无损** | WYSIWYG ↔ 源码 切换内容 100% 一致 |
| **Markdown 源生** | 任何操作底层都是 Markdown，编辑器和存储格式统一 |
| **可扩展插件** | 基于 TipTap 插件体系 + 自定义 Plugin API，功能可插拔 |
| **离线优先** | 编辑器完全本地运行，无网络依赖 |
| **关注点分离** | 展示/逻辑/转换/扩展/数据 五层分离，每层独立可测 |
| **渐进增强** | 核心功能优先，高级功能以插件形式渐进加载 |

---

## 二、核心渲染引擎

### 2.1 Markdown → HTML 转换 `[Phase 1 完成 ⚠️ (薄封装委托旧服务)]`

| 语法 | 转换目标 | 状态 |
|------|---------|:----:|
| **Bold** `**text**` | `<strong>` | ✅ |
| *Italic* `*text*` | `<em>` | ✅ |
| ***Bold+Italic*** `***text***` | `<strong><em>` | ✅ |
| ~~Strikethrough~~ `~~text~~` | `<s>` | ✅ |
| __Underline__ `__text__` | `<u>` | ✅ |
| `Inline Code` `` `code` `` | `<code>` | ✅ |
| 链接 `[text](url)` | `<a>` | ✅ |
| 图片 `![alt](url)` | `<img>` | ✅ |
| 标题 `#` `##` `###` | `<h1>` `<h2>` `<h3>` | ✅ |
| 标题 `####` `#####` `######` | `<h4>` `<h5>` `<h6>` | ✅ |
| 代码块 ` ```lang` | `<pre><code>` + 复制按钮 + 语言标签 | ✅ |
| 引用 `>` | `<blockquote>` | ✅ |
| 无序列表 `- item` | `<ul><li>` | ✅ |
| 有序列表 `1. item` | `<ol><li>` | ✅ |
| 任务列表 `- [x] task` | `<li> + checkbox` | ✅ |
| 表格 (GFM pipe table) | `<table>` + align | ✅ |
| 分割线 `---` | `<hr>` | ✅ |
| 列表嵌套 (缩进) | 递归 `<ul>/<ol>` | ✅ |
| 实体转义 `& < > "` | `&amp; &lt; &gt; &quot;` | ✅ |
| Wiki Link `[[title]]` | `<button class="wiki-link">` | ✅ |
| 标签 `#tag` | `<span class="tag">` | ✅ |

### 2.2 HTML → Markdown 转换 `[Phase 1 完成 ⚠️ (薄封装委托旧服务)]`

反向转换覆盖上述所有语法，含 TipTap 特定输出格式的兼容（`<div class="tableWrapper">`、带属性的 `<pre>`、嵌套列表结构）。

### 2.3 原生 HTML 渲染 `[进行中 ⬜]`

编辑器原生渲染 HTML 标签，不转义显示：

| 能力 | 说明 | 状态 |
|------|------|:----:|
| 直接粘贴 HTML | 粘贴带格式文本 → 自动转为 TipTap 节点 | ⬜ |
| HTML 标签渲染 | `<video>` `<iframe>` 嵌入内容在编辑器中直接渲染 | ⬜ |
| 自定义样式 | 编辑区域支持 `prose-sm` Tailwind 类 + 自定义 CSS | ✅ (已有) |
| HTML 源码模式 | CodeMirror 6 直接编辑原始 Markdown | ✅ 完成 |
| 粘贴富文本 | 从网页/Word 粘贴 → 清洗后保留结构 | ⬜ 部分 (需增强) |

---

## 三、文本格式化功能

### 3.1 行内格式 `[Phase 1 完成 ✅]`

| 功能 | 快捷键 | 工具栏 | 状态 |
|------|--------|:------:|:----:|
| **加粗** | `Ctrl+B` | ✅ Bold 按钮 | ✅ |
| *斜体* | `Ctrl+I` | ✅ Italic 按钮 | ✅ |
| ~~删除线~~ | `Ctrl+Shift+X` | ✅ | ✅ |
| __下划线__ | `Ctrl+U` | ✅ | ✅ |
| `行内代码` | `Ctrl+E` | ✅ | ✅ |
| 🔗 链接 | `Ctrl+K` | ✅ 链接按钮 | ✅ |
| 清除格式 | `Ctrl+\` | ✅ | ✅ |

### 3.2 块级格式 `[Phase 1+2 完成 ✅]`

| 功能 | 快捷键 | 工具栏 | 状态 |
|------|--------|:------:|:----:|
| 标题 H1 | `Ctrl+Alt+1` | ✅ 标题下拉 (斜杠命令) | ✅ |
| 标题 H2 | `Ctrl+Alt+2` | ✅ | ✅ |
| 标题 H3 | `Ctrl+Alt+3` | ✅ | ✅ |
| 标题 H4-H6 | `Ctrl+Alt+4/5/6` | ✅ 斜杠命令 | ✅ |
| 段落 | `Ctrl+Alt+0` | ✅ | ✅ |
| 引用块 | `Ctrl+Shift+B` | ✅ 工具栏 + 斜杠命令 | ✅ |
| 分割线 | 斜杠命令 `/hr` | ✅ 斜杠命令 | ✅ |
| 有序列表 | 自动 `1.` 触发 | ✅ 斜杠命令 | ✅ |
| 无序列表 | 自动 `-` 触发 | ✅ 斜杠命令 | ✅ |
| 任务列表 | 斜杠命令 `/task` | ✅ 斜杠命令 | ✅ |
| 代码块 | 斜杠命令 `/code` | ✅ 斜杠命令 | ✅ |
| 文本对齐 | — | ✅ 对齐按钮 (图片浮动栏) | ✅ |

### 3.3 列表系统 `[Phase 1 完成 ✅]`

| 能力 | 状态 |
|------|:----:|
| 有序/无序列表自动识别 | ✅ |
| 列表嵌套 (Tab 缩进/Shift+Tab 减少缩进) | ✅ (TipTap 原生) |
| 任务列表点击切换状态 | ✅ (WYSIWYG 模式) |
| 列表连输入 (Enter 延续，Backspace 取消) | ✅ (TipTap 原生) |
| 空列表项自动退出 | ✅ (TipTap 原生) |
| 混合列表 (有序内嵌无序) | ✅ |

---

## 四、代码块系统

### 4.1 基础能力 `[Phase 2 完成 ✅]`

| 能力 | 状态 | 说明 |
|------|:----:|------|
| 语法高亮 | ✅ | `lowlight` + `highlight.js`，支持 190+ 语言 |
| 语言选择器 | ✅ | CodeBlockLang 扩展，40+ 常用语言下拉菜单 |
| 行号显示 | ✅ | `data-line-nums` DOM 属性实现 |
| 代码块复制 | ✅ | 顶部悬浮复制按钮 + toast 提示 |
| 代码块折叠 | ❌ | 不支持长代码块折叠 |
| 语言自动检测 | ❌ | 需用户手动选择语言 |

### 4.2 支持的语言列表 `[未完成 ⬜]`

```
javascript  typescript  python  rust  go  java  kotlin  swift
c  cpp  csharp  ruby  php  bash  powershell  sql  html  css
scss  less  yaml  json  xml  markdown  dockerfile  graphql
protobuf  toml  sql  r  perl  lua  haskell  scala  elixir
erlang  clojure  julia  solidity  terraform  hcl  diff
```

---

## 五、表格系统

### 5.1 基础能力 `[Phase 2 完成 ✅]`

| 能力 | 状态 |
|------|:----:|
| GFM pipe table ↔ HTML 双向转换 | ✅ |
| 插入/删除行 | ✅ (TipTap 原生 + 工具栏) |
| 插入/删除列 | ✅ (TipTap 原生 + 工具栏) |
| 单元格内容编辑 | ✅ |
| 表格拖拽调整列宽 | ✅ (TipTap resizable) |
| 对齐方式 (左/中/右) | ✅ |
| Tab/Enter 键盘导航 | ✅ (TableHelper 扩展) |
| CSV 粘贴导入 | ⬜ 计划中 |
| 表格排序 | ⬜ 计划中 |
| 单元格合并 | ❌ |
| 表格内嵌套 (块级元素) | ❌ |

### 5.2 表格 UI `[Phase 2 部分完成]`

| UI 元素 | 状态 |
|---------|:----:|
| 斜杠命令 `/table` 插入 | ✅ (SlashMenu) |
| 工具栏表格按钮 | ✅ (RichTextToolbar) |
| 右键菜单 (行/列操作) | ⬜ 计划中 |
| 拖拽行列重排 | ❌ |

---

## 六、图片与媒体

### 6.1 图片 `[Phase 2 完成 ✅]`

| 能力 | 状态 | 说明 |
|------|:----:|------|
| URL 插入图片 | ✅ | 工具栏按钮 + 弹窗 |
| 拖拽上传图片 | ✅ | 转 Base64 data URL |
| 粘贴剪贴板图片 | ✅ | 同上 |
| 图片内联预览 (源码模式) | ✅ | CodeMirror ImagePreviewWidget |
| 图片对齐 (左/中/右) | ✅ | 浮动工具栏 ImageResize 扩展 |
| 图片大小拖拽调整 | ✅ | ImageResize width/height 属性模型 |
| 图片 Alt 文本保留 | ✅ | 双向转换 |
| 图片标题 (Caption) | ❌ | 计划中 |
| 图片 Lightbox 点击放大 | ❌ | 阅读模式功能 |
| 图床/云存储上传 | ⬜ | 需后端 MinIO 集成 |

### 6.2 文件附件 `[未完成 ⬜]`

| 能力 | 状态 |
|------|:----:|
| 附件面板 (AttachmentPanel) | ⬜ |
| 拖拽排序 | ⬜ |
| 重命名 | ⬜ |
| 上传进度条 | ⬜ |
| 取消上传 | ⬜ |
| 删除/下载 | ⬜ |
| 文件类型图标 | ⬜ |
| 缩略图预览 | ⬜ |
| 同步状态指示 | ⬜ |

### 6.3 嵌入内容 `[未完成 ⬜]`

| 能力 | 状态 | 优先级 |
|------|:----:|:------:|
| YouTube/视频嵌入 | ⬜ 部分 | P2 |
| Iframe 嵌入 | ⬜ 部分 | P2 |
| 社交媒体嵌入 (Twitter等) | ❌ | P3 |
| 可折叠详情块 `<details>` | ⬜ 部分 | P2 |
| 数学公式 (KaTeX) | ❌ | P1 |
| Mermaid 图表 | ❌ | P1 |
| Excalidraw 白板嵌入 | ❌ | P3 |

---

## 七、扩展 Markdown 语法

### 7.1 Wiki Links (双向链接) `[未完成 ⬜]`

| 能力 | 状态 |
|------|:----:|
| `[[笔记标题]]` 语法解析 | ⬜ (Rust Core) |
| 装饰渲染 (CodeMirror decoration) | ⬜ |
| 点击导航跳转 | ⬜ |
| 悬停预览浮窗 | ⬜ |
| 反向链接面板 | ⬜ |
| `[[` 自动完成匹配 | ⬜ |
| 链接不存在提示 (红色虚线) | ⬜ |

### 7.2 其他扩展语法

| 语法 | 状态 | 优先级 |
|------|:----:|:------:|
| `#tag` 标签语法 | ⬜ (Rust Core 提取) | — |
| `@mention` 提及 | ⬜ 计划 | P2 |
| `^^highlight^^` 高亮 | ❌ | P3 |
| 脚注 `[^1]` | ❌ | P2 |
| 定义列表 | ❌ | P3 |
| 数学公式 `$$...$$` | ❌ | P1 |
| 图表 ` ```mermaid` | ❌ | P1 |
| 属性列表 `{: #id .class}` | ❌ | P3 |
| Frontmatter `---\nkey: val\n---` | ⬜ 部分 | P2 |
| Callout/Admonitions `> [!note]` | ❌ | P1 |

---

## 八、编辑器交互

### 8.1 斜杠命令菜单 `/` `[Phase 2 完成 ✅]`

| 命令 | 状态 |
|------|:----:|
| `/1` `/2` `/3` 标题 | ✅ |
| `/paragraph` 段落 | ✅ |
| `/bold` `/italic` `/code` `/strike` 格式 | ✅ |
| `/code` 代码块 | ✅ |
| `/quote` 引用 | ✅ |
| `/table` 表格 | ✅ |
| `/task` 任务列表 | ✅ |
| `/bullet` `/number` 列表 | ✅ |
| `/hr` 分割线 | ✅ |
| `/callout` 警示块 | ⬜ 计划 |
| `/math` 公式 | ❌ |
| `/mermaid` 图表 | ❌ |
| `/template` 模板 | ❌ |
| `/date` 插入日期 | ❌ |

### 8.2 拖拽交互 `[未完成 ⬜]`

| 能力 | 状态 |
|------|:----:|
| 图片文件拖拽插入 | ⬜ |
| 图片拖拽调整大小 | ⬜ |
| 文件附件拖拽排序 | ⬜ |
| 块级元素拖拽重排 (Drag & Drop blocks) | ⬜ 计划 |
| 表格列宽拖拽调整 | ⬜ |
| 侧边栏笔记拖拽移动到笔记本 | ⬜ |

### 8.3 键盘快捷键 `[Phase 2 完成 ✅]`

| 快捷键 | 功能 | 状态 |
|--------|------|:----:|
| `Ctrl+N` | 新建笔记 | ✅ (App 层) |
| `Ctrl+F` | 聚焦搜索 | ✅ (App 层) |
| `Ctrl+E` | 切换编辑/预览模式 | ✅ (App 层) |
| `Ctrl+S` | 手动保存 | ✅ (App 层) |
| `Ctrl+P` | 固定笔记 | ✅ (App 层) |
| `Ctrl+D` | 删除笔记 | ✅ (App 层) |
| `Ctrl+Shift+F` | 收藏/取消收藏 | ✅ (App 层) |
| `Ctrl+K` | 全局搜索 | ✅ (App 层) |
| `Ctrl+G` | 知识图谱 | ✅ (App 层) |
| `Ctrl+I` (选中文本) | AI 工具栏 | ✅ (App 层) |
| `Tab` (缩进) / `Shift+Tab` (减少缩进) | 调整列表层级 | ✅ (TipTap) |
| `/` | 斜杠命令菜单 | ✅ (SlashMenu) |
| `[[` | Wiki Link 自动完成 | ✅ (Editor 层) |
| 快捷键自定义 | ManageModal 可配置 | ✅ (已有) |

### 8.4 搜索与高亮 `[Phase 1 完成 ✅]`

| 能力 | 状态 |
|------|:----:|
| 编辑器内文本搜索 | ✅ (CodeMirror: decoration; TipTap: SearchHighlight Plugin) |
| 搜索结果导航 (上/下一个) | ✅ |
| 搜索结果计数 | ✅ |
| 全局搜索 (Ctrl+K) 侧边栏 | ✅ |
| 搜索建议下拉 | ⬜ |
| 搜索历史 (localStorage) | ⬜ |
| 全文/语义/混合模式切换 | ⬜ |

### 8.5 自动保存 `[Phase 1 完成 ✅]`

| 能力 | 状态 |
|------|:----:|
| 300ms debounce 自动保存 | ✅ |
| 状态栏指示器 (已保存/保存中/未保存) | ✅ |
| 最后保存时间戳 | ✅ |
| 草稿恢复 (崩溃恢复) | ✅ |
| 版本历史自动快照 | ✅ (Rust Core) |

---

## 九、AI 集成

### 9.1 AI 写作工具栏 `[未完成 ⬜]`

| 功能 | 状态 | 说明 |
|------|:----:|------|
| AI 续写 | ⬜ | 选中文本后继续生成 |
| AI 改写 (5种语气) | ⬜ | 专业/简洁/友好/学术/创意 |
| AI 翻译 (5语言) | ⬜ | 中/英/日/韩/法 |
| AI 补全 | ⬜ | 光标位置智能补全 |
| SSE 流式渲染 | ⬜ | 逐 Token 实时插入编辑区 |
| 取消生成 | ⬜ | 流式渲染中可取消 |
| 语气记忆 (localStorage) | ⬜ | 持久化上次选择的语气 |
| 快捷键 `Ctrl+I` 触发 | ⬜ | |

### 9.2 AI 智能功能 `[未完成 ⬜]`

| 功能 | 状态 | 说明 |
|------|:----:|------|
| AI 自动标签 | ⬜ | 新建/编辑笔记时推荐标签 |
| 语义搜索 | ⬜ | pgvector + BM25 混合 |
| 自动摘要 | ⬜ 后端已设计 | 前端未接入 |
| 知识图谱 NLP 实体提取 | ⬜ | D3.js 图谱展示 |
| RAG 问答 | ⬜ 后端已设计 | 前端未完整集成 |
| 智能模板推荐 | ❌ | 计划中 |
| AI 知识链接推荐 | ❌ | 计划中 |

---

## 十、进阶编辑能力

### 10.1 Callout / 警示块 `[未完成 ⬜]`

```
> [!note] 标题
> 内容

> [!warning] 标题
> 内容

> [!tip] 标题
> 内容

> [!danger] 标题
> 内容
```

| 类型 | 状态 | 优先级 |
|------|:----:|:------:|
| note / warning / tip / danger | ❌ | P1 |
| 自定义图标和颜色 | ❌ | P2 |
| 嵌套内容 | ❌ | P2 |

### 10.2 数学公式 `[未完成 ⬜]`

| 能力 | 状态 | 优先级 |
|------|:----:|:------:|
| 行内公式 `$...$` | ❌ | P1 |
| 块级公式 `$$...$$` | ❌ | P1 |
| KaTeX 渲染 | ❌ | P1 |
| 代码高亮中的公式 | ❌ | P2 |

### 10.3 Mermaid 图表 `[未完成 ⬜]`

| 图表类型 | 状态 | 优先级 |
|----------|:----:|:------:|
| 流程图 (Flowchart) | ❌ | P1 |
| 时序图 (Sequence) | ❌ | P1 |
| 类图 (Class) | ❌ | P2 |
| 甘特图 (Gantt) | ❌ | P2 |
| 饼图 (Pie) | ❌ | P2 |
| 用户旅程 (User Journey) | ❌ | P3 |

### 10.4 Frontmatter 元数据 `[未完成 ⬜]`

| 字段 | 状态 |
|------|:----:|
| `title` | ⬜ |
| `tags` | ⬜ |
| `created` / `updated` | ⬜ (数据库) |
| 自定义 fields | ❌ |
| 编辑器内 Frontmatter 编辑 UI | ❌ |
| 可视化 Frontmatter 面板 | ❌ |

### 10.5 折叠/大纲 `[未完成 ⬜]`

| 能力 | 状态 | 优先级 |
|------|:----:|:------:|
| 标题折叠 (Collapse headings) | ❌ | P2 |
| 文档大纲侧边栏 | ❌ | P2 |
| 代码块折叠 | ❌ | P3 |
| Callout 折叠 | ❌ | P3 |

---

## 十一、阅读与视图模式

### 11.1 视图模式

| 模式 | 状态 | 说明 |
|------|:----:|------|
| **编辑模式** (WYSIWYG) | ✅ | TipTap 实时编辑 |
| **源码模式** | ✅ | CodeMirror Markdown 编辑 |
| **双栏模式** (编辑+预览) | ✅ 已有 | 源码模式+预览分栏，可拖动调整宽度 |
| **阅读模式** | ⬜ 计划 | 干净只读渲染，隐藏工具栏 |
| **专注模式** | ❌ | 隐藏侧边栏，全屏写作 |
| **打字机模式** | ❌ | 光标始终居中 |
| **演示模式** | ❌ | 类似 Slide 翻页展示 |

### 11.2 导出格式

| 格式 | 状态 |
|------|:----:|
| Markdown | ⬜ |
| HTML | ⬜ |
| JSON | ⬜ |
| PDF | ⬜ 计划 |
| 批量导出 (Bundle) | ⬜ |
| 发布为网站 | ⬜ 计划 (V3.0) |

---

## 十二、协作与分享

### 12.1 实时协作 `[未完成 ⬜]`

| 能力 | 状态 | 说明 |
|------|:----:|------|
| CRDT 实时协同编辑 | ⬜ 计划 | 基于 `yrs` crate |
| 光标同步 | ⬜ 计划 | 协作者光标位置实时显示 |
| 选中高亮 | ⬜ 计划 | 协作者选中文本高亮 |
| 协作者状态指示 | ⬜ 计划 | 头像 + 在线状态 |
| 评论 / 批注 | ⬜ 计划 | 选中文本添加评论 |
| `@Mention` 提及 | ⬜ 计划 | 通知协作者 |

### 12.2 分享 `[未完成 ⬜]`

| 能力 | 状态 |
|------|:----:|
| 分享链接 (只读) | ⬜ 计划 |
| 分享链接 (可编辑) | ⬜ 计划 |
| 密码保护 | ⬜ 计划 |
| 过期时间 | ⬜ 计划 |
| 嵌入 iframe | ⬜ 计划 |

---

## 十三、编辑器主题与自定义

### 13.1 主题系统 `[未完成 ⬜]`

| 能力 | 状态 |
|------|:----:|
| 深色/浅色主题 | ⬜ (CSS 变量 + `data-theme`) |
| 自动跟随系统 | ⬜ (`prefers-color-scheme`) |
| 编辑器字体设置 | ⬜ |
| 编辑器字号设置 | ⬜ (默认 14px / 1.8 line-height) |
| 行宽设置 | ⬜ 计划 |
| 自定义 CSS | ⬜ 计划 |

### 13.2 写作体验 `[未完成 ⬜]`

| 能力 | 状态 | 优先级 |
|------|:----:|:------:|
| 字数统计 | ⬜ | — |
| 阅读时间估算 | ⬜ 计划 | P3 |
| 目标写作字数 | ⬜ 计划 | P3 |
| 写作统计 (每日/每周) | ⬜ (本地 Metrics) | — |
| 拼写检查 | ⬜ 系统自带 | P3 |
| 自动补全 (Markdown 语法) | ⬜ (斜杠命令) | — |
| Emoji 选择器 | ❌ | P3 |

---

## 十四、升级与优化路线

### 14.1 P1 优先级 (核心体验)

| 功能 | 当前状态 | 目标 | 预估工作量 |
|------|:--------:|------|:----------:|
| **Callout 警示块** | ❌ | `> [!note/warning/tip/danger]` 语法支持、TipTap 节点、自定义图标色彩 | 2d |
| **数学公式 KaTeX** | ❌ | `$...$` `$$...$$` 渲染、TipTap 扩展、Rust Core 解析 | 3d |
| **Mermaid 图表** | ❌ | ` ```mermaid` 渲染、TipTap NodeView、编辑/预览切换 | 3d |
| **标题 H4-H6 完整支持** | ⬜ | TipTap heading 扩展 levels: [1-6]、工具栏下拉选择、快捷键 | 0.5d |
| **双栏编辑+预览模式** | ❌ | 左右分栏、源码+渲染同步滚动、可调分栏宽度 | 2d |
| **阅读模式** | ❌ | 干净只读渲染、隐藏工具栏、支持 TOC 导航 | 1d |
| **代码块复制按钮** | ❌ | 顶部悬浮复制按钮、复制成功 toast | 0.5d |
| **表格 CSV 粘贴导入** | ❌ | 粘贴 CSV 文本 → 自动转为表格 | 1d |
| **编辑器内拼写检查** | ⬜ | 基于浏览器原生或 hunspell | 1d |
| **Frontmatter 编辑 UI** | ❌ | 可视化编辑面板、YAML 字段 | 2d |

### 14.2 P2 优先级 (体验增强)

| 功能 | 预估工作量 |
|------|:----------:|
| 块级元素拖拽重排 (Drag & drop blocks) | 3d |
| 文档大纲侧边栏 (Outline/TOC) | 2d |
| 表格排序功能 | 1d |
| 表格单元格合并 | 2d |
| 图片标题 Caption 支持 | 1d |
| 图床自动上传 (MinIO) | 2d |
| 脚注 `[^1]` 支持 | 1d |
| 视频/Iframe 嵌入 NodeView | 1d |
| 链接悬停预览 | 1d |
| @Mention 提及自动完成 | 1d |
| 模板系统 / 模板插入 | 2d |
| 专注模式 / 全屏写作 | 1d |
| 行宽自定义 | 0.5d |
| 粘贴 HTML 智能清洗 | 2d |

### 14.3 P3 优先级 (锦上添花)

| 功能 | 预估工作量 |
|------|:----------:|
| 标题折叠 (Collapse headings) | 2d |
| 斜杠命令自定义 | 2d |
| Emoji 选择器 | 1d |
| 打字机模式 (光标居中) | 1d |
| 演示模式 (Slide 翻页) | 3d |
| 定义列表语法 | 1d |
| 高亮 `^^text^^` 语法 | 0.5d |
| 属性列表 (`{: #id}`) | 1d |
| 每日写作目标 | 1d |
| 自定义编辑器 CSS | 2d |
| 代码块折叠 | 1d |
| 导出 PDF | 2d |

### 14.4 架构优化

| 优化项 | 状态 | 说明 | 预估 |
|--------|:----:|------|:----:|
| **Markdown 转换精度提升** | ⚠️ | `converters/` 为薄封装 (`export { markdownToHtml } from '@/services/...`)，未真正重写 | 需跟进 |
| **Rust Core 增量解析** | ⬜ | 只解析变化部分，而非全文重解析 | 3d |
| **大规模文档性能** | ⬜ | 10 万字以上文档的编辑器性能优化 | 3d |
| **TipTap 扩展模块化** | ⚠️ | `wysiwyg/extensions/index.ts` 存在，但 `getBuiltinExtensions()` 返回空数组 — 8个扩展文件未注册 | 需接入 |
| **共享类型/组件包** | ⬜ | 提取可在 Web/Desktop 间复用的编辑器包 | 3d |
| **编辑器测试覆盖** | ⚠️ | 转换器测试 199 行在 `services/__tests__/` 中 (旧服务)，`converters/__tests__/` 为空 | 需迁移 |
| **控制器层 (EditorController)** | ✅ | `controller/` 目录：EditorController、ContentSync、EventBus、KeyboardShortcuts | 完成 |
| **向后兼容层** | ✅ | 旧 `Editor.tsx` 重新导出 EditorContainer，`index.ts` 统一导出，零侵入迁移 | 完成 |
| **PluginManager / PluginAPI** | ❌ | `plugins/` 目录为空，插件系统尚未实现 | 未开始 |

---

## 十五、插件扩展系统设计

### 15.1 设计目标

> **当前状态:** `plugins/` 目录为空 ❌，PluginManager.ts、PluginAPI.ts 均未创建。
> 以下为目标设计，尚未实现。

```typescript
// plugins/PluginAPI.ts — 插件接口定义 (目标)

interface EditorPlugin {
  /** 插件唯一标识 */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 依赖的其他插件 ID 列表 */
  dependencies?: string[];

  /** 生命周期 */
  onActivate?: (ctx: PluginContext) => Promise<void>;
  onDeactivate?: (ctx: PluginContext) => Promise<void>;

  /** TipTap 扩展 (会自动注册到编辑器) */
  extensions?: Extensions[];

  /** 注册工具栏按钮 */
  toolbarItems?: ToolbarItem[];
  /** 注册斜杠命令 */
  slashCommands?: SlashCommand[];
  /** 注册快捷键 */
  keyboardShortcuts?: Record<string, () => boolean>;

  /** Hook 点 */
  hooks?: {
    /** 内容输出前转换 */
    onBeforeOutput?: (html: string) => string | Promise<string>;
    /** 内容加载后转换 */
    onAfterLoad?: (markdown: string) => string | Promise<string>;
    /** Markdown → HTML 自定义转换 */
    onMarkdownToHtml?: (md: string) => string | null;
    /** HTML → Markdown 自定义转换 */
    onHtmlToMarkdown?: (html: string) => string | null;
  };
}

interface PluginContext {
  editor: Editor | null;
  registerToolbarItem: (item: ToolbarItem) => void;
  registerSlashCommand: (cmd: SlashCommand) => void;
  registerExtension: (ext: Extensions) => void;
  addKeyboardShortcut: (key: string, handler: () => boolean) => void;
  /** 安全存储插件配置 */
  store: {
    get: <T>(key: string) => T | undefined;
    set: <T>(key: string, value: T) => void;
  };
}
```

### 15.2 内置插件清单

| 插件 | ID | 类型 | 说明 | 优先级 | 状态 |
|------|:--:|:----:|------|:------:|:----:|
| 斜杠菜单 | `slash-menu` | Core | `/` 命令菜单弹出 (4类15命令) | P0 | ⚠️ 定义就绪, 未接入 |
| 工具栏 | `rich-text-toolbar` | Core | 格式化/表格/链接工具栏 | P0 | ✅ 旧文件, 未重构 |
| Wiki Link | `wiki-link` | Markdown | `[[title]]` 语法支持 | P0 | ✅ SourceEditor 已有 |
| 代码块高亮 | `code-block` | Core | lowlight 语法高亮 | P0 | ✅ SourceEditor 支持 |
| 代码语言选择 | `code-block-lang` | UI | 代码块语言标签 + 选择器 | P1 | ⚠️ 文件就绪, 未注册 |
| 代码复制 | `code-copy` | UI | 代码块复制按钮 | P1 | ✅ 预览面板已有 |
| 表格辅助 | `table-helper` | UI | Tab/Enter 键盘导航 | P1 | ⚠️ 文件就绪, 未注册 |
| 图片调整 | `image-resize` | UI | width/height 属性模型 | P1 | ⚠️ 文件就绪, 未注册 |
| 链接悬停 | `link-hover` | UI | 链接 URL tooltip | P1 | ⚠️ 文件就绪, 未注册 |
| 插件管理 | `plugin-manager` | Core | PluginManager + PluginAPI | P0 | ❌ plugins/ 目录为空 |
| 数学公式 | `math` | Markdown | KaTeX 公式渲染 | P1 | ❌ |
| Mermaid 图表 | `mermaid` | Markdown | 图表渲染 | P1 | ❌ |
| Callout | `callout` | Markdown | 警示块 | P1 | ❌ |
| Frontmatter | `frontmatter` | Markdown | YAML 元数据 | P2 | ❌ |
| 脚注 | `footnote` | Markdown | 脚注语法 | P2 | ❌ |
| 高亮 | `highlight` | Markdown | `^^text^^` | P3 | ❌ |
| Emoji | `emoji-picker` | UI | Emoji 选择器 | P3 | ❌ |

### 15.3 斜杠命令菜单架构

```
用户输入 /
     │
     ▼
┌─────────────────────────────────┐
│  SlashMenu Plugin                │
│                                 │
│  1. 检测 `/` 字符                │
│  2. 收集所有已注册命令            │
│  3. 按分类分组                   │
│     ├── 标题 (H1/H2/H3/段落)     │
│     ├── 格式 (粗体/斜体/代码)     │
│     ├── 块级 (代码块/引用/分割线) │
│     ├── 媒体 (图片/链接/表格)     │
│     ├── 高级 (Callout/数学/图表)  │
│     └── 自定义 (第三方插件)       │
│  4. 模糊匹配过滤                  │
│  5. 渲染浮层面板                  │
│  6. Enter/Tab 执行选中命令        │
└─────────────────────────────────┘
```

### 15.4 插件加载策略

> **当前状态:** 插件系统未实现 ❌。WysiwygEditor 使用 `getAllExtensions()` 但实际只加载了 Core 扩展 (getBuiltinExtensions 返回[])。以下为目标设计。

```
┌──────────────────────────────────────────────────────────────┐
│                   PluginLoader (目标设计)                       │
│                                                               │
│  Phase 1 — 内核加载 (同步)                                    │
│  ├── StarterKit (基础: 加粗/斜体/列表/引用/代码)               │
│  ├── Placeholder, TextStyle                                   │
│  ├── Table, TaskList, TextAlign                               │
│  └── ImageExtension, Link                                     │
│                    ──────────── 已实现 ✅                      │
│                                                               │
│  Phase 2 — 内置加载 (异步, 并行)                              │
│  ├── SlashMenu Plugin          ⚠️ 文件就绪, 未注册              │
│  ├── SearchHighlight Plugin    ⚠️ 文件就绪, 未注册              │
│  ├── CodeBlockLang Plugin      ⚠️ 文件就绪, 未注册              │
│  ├── ImageResize Plugin        ⚠️ 文件就绪, 未注册              │
│  ├── TableHelper Plugin        ⚠️ 文件就绪, 未注册              │
│  ├── TaskCheckbox Plugin       ⚠️ 文件就绪, 未注册              │
│  └── LinkHover Plugin          ⚠️ 文件就绪, 未注册              │
│                                                               │
│  Phase 3 — 按需加载 (Lazy, 用户触发时加载)                      │
│  ├── Math Plugin (用户输入 $$ 时加载 KaTeX)                    │
│  ├── Mermaid Plugin (用户输入 ```mermaid 时加载)                │
│  ├── Emoji Plugin (用户打开 Emoji 选择器时加载)                │
│  └── Third-party Plugins (未来)                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 十六、性能与可伸缩性设计

### 16.1 性能目标

| 指标 | 目标值 | 测试场景 |
|------|:------:|----------|
| 编辑器启动 | < 500ms | 冷启动到编辑器可用 |
| 模式切换 | < 100ms | WYSIWYG ↔ 源码 切换 |
| 内容加载 | < 200ms | 加载 1 万字笔记 |
| 输入延迟 | < 50ms | 每次按键到屏幕反馈 |
| 自动保存 | < 100ms | 300ms debounce 后保存完成 |
| 大文档编辑 | > 30 FPS | 10 万字文档持续输入 |
| 搜索高亮 | < 200ms | 1 万字文档内搜索高亮 |
| 内存占用 | < 80MB | 常规使用 (1 万字笔记) |

### 16.2 大规模文档策略

```
文档规模分段处理策略:

┌─ 0 ~ 1 万字 (常规) ──────────────────────────────────────────┐
│  完整渲染, 所有功能可用                                        │
│  不做特殊优化                                                  │
└──────────────────────────────────────────────────────────────┘

┌─ 1 万 ~ 10 万字 (大型) ──────────────────────────────────────┐
│  - 编辑器内容使用虚拟行渲染 (CodeMirror 原生支持)              │
│  - TipTap 节点数量 > 5000 时启用节点回收                       │
│  - 搜索高亮使用 Web Worker 计算                               │
│  - 自动保存限流 (延长至 1000ms debounce)                       │
│  - 语法高亮延迟渲染 (滚动到视口内才高亮)                       │
└──────────────────────────────────────────────────────────────┘

┌─ 10 万 ~ 100 万字 (超大型) ──────────────────────────────────┐
│  - 提示用户切换源码模式                                        │
│  - WYSIWYG 模式下禁用语法高亮                                  │
│  - 文档折叠 (默认折叠所有标题, 按需展开)                        │
│  - 分页/分段加载 (仅加载可见区域 + 前后缓冲)                    │
│  - 建议拆分为多个笔记                                          │
└──────────────────────────────────────────────────────────────┘
```

### 16.3 内存管理

| 优化项 | 策略 | 效果 |
|--------|------|:----:|
| **大图片懒加载** | 图片不在视口内时替换为占位符 | 减少 DOM 节点 |
| **highlight.js 按需加载** | 只注册用到的语言，其余动态 import | 减少 80% 高亮体积 |
| **编辑器实例缓存** | 最近 5 个笔记的编辑器状态缓存，切换时恢复 | 减少重建开销 |
| **DOM 节点回收** | 滚出视口的节点替换为占位元素 | 大文档流畅度 |
| **Base64 图片警告** | 图片 > 1MB 时提示用户上传图床 | 防止笔记体积膨胀 |
| **Undo 历史限制** | 最大 100 步 / 内存 > 50MB 时丢弃最早记录 | 防止内存泄漏 |

### 16.4 渲染性能优化

```typescript
// 目标: 渲染性能优化策略

// 1. TipTap 编辑器事务节流
editor.options.dispatchTransaction = (tr) => {
  // 合并 50ms 内的连续事务
  if (shouldThrottle(tr)) {
    scheduleThrottled(() => editor.view.dispatch(tr), 50);
  } else {
    editor.view.dispatch(tr);
  }
};

// 2. 代码块语法高亮延迟
const highlightOptions = {
  // 只高亮视口内的代码块
  viewportOnly: true,
  // 空闲时高亮 (requestIdleCallback)
  idlePriority: true,
};

// 3. 预览面板去抖
const debouncedPreview = useMemo(
  () => debounce((content: string) => renderPreview(content), 200),
  []
);
```

---

## 十七、测试策略

### 17.1 测试金字塔

```
          ⬜  E2E 测试 (Playwright)
        ⬜  ⬜  集成测试 (组件交互)
      ⬜  ⬜  ⬜  单元测试 (转换器/工具函数)
    ⬜  ⬜  ⬜  ⬜  TypeScript 类型检查 (tsc --noEmit)
  ⬜  ⬜  ⬜  ⬜  ⬜  Lint (ESLint)
```

| 层级 | 覆盖内容 | 目标数量 | 运行时间 |
|------|---------|:--------:|:--------:|
| **单元测试 (转换器)** | markdownToHtml / htmlToMarkdown / sanitizer | 50+ | < 1s |
| **单元测试 (工具函数)** | formatTable / 快捷键解析 / 主题工具 | 20+ | < 0.5s |
| **集成测试 (组件)** | RichTextEditor / CodeMirrorEditor / AIToolbar | 15+ | < 5s |
| **集成测试 (Hooks)** | useAutoSave / useEditorSearch / useWikiLink | 10+ | < 3s |
| **E2E 测试** | 全流程: 创建→编辑→保存→切换模式→导出 | 5+ | < 30s |

### 17.2 转换器测试用例 (目标)

```typescript
// converters/__tests__/markdownToHtml.test.ts

describe('markdownToHtml', () => {
  // ── 基础格式 ──
  test('bold text', () => { /* **text** → <strong>text</strong> */ });
  test('italic text', () => { /* *text* → <em>text</em> */ });
  test('bold+italic nesting', () => { /* ***text*** → <strong><em>text</em></strong> */ });
  test('strikethrough', () => { /* ~~text~~ → <s>text</s> */ });
  test('underline', () => { /* __text__ → <u>text</u> */ });
  test('inline code', () => { /* `code` → <code>code</code> */ });

  // ── 块级格式 ──
  test('heading h1-h6', () => { /* # ~ ###### 全部级别 */ });
  test('blockquote with multiple lines', () => { /* 多行引用 */ });
  test('horizontal rule', () => { /* ---, ***, ___ */ });

  // ── 列表 ──
  test('unordered list', () => { /* - item */ });
  test('ordered list', () => { /* 1. item */ });
  test('nested list (2 levels)', () => { /* 缩进嵌套 */ });
  test('nested list (3+ levels)', () => { /* 深层嵌套 */ });
  test('task list checked/unchecked', () => { /* - [x] / - [ ] */ });
  test('mixed ordered+unordered', () => { /* 1. - sub */ });

  // ── 代码块 ──
  test('code block with language', () => { /* ```typescript ... ``` */ });
  test('code block without language', () => { /* ``` ... ``` */ });
  test('code block with special chars', () => { /* HTML 在代码块内不转义 */ });
  test('inline code inside paragraph', () => { /* text `code` text */ });

  // ── 链接和图片 ──
  test('basic link', () => { /* [text](url) */ });
  test('image with alt', () => { /* ![alt](url) */ });
  test('image without alt', () => { /* ![](url) */ });
  test('link with title', () => { /* [text](url "title") */ });

  // ── 表格 ──
  test('basic table', () => { /* 简单表格 */ });
  test('table with alignment', () => { /* :--- :---: ---: */ });
  test('table with empty cells', () => { /* || cell */ });
  test('table with inline formatting', () => { /* 单元格内有 **bold** */ });

  // ── 边界情况 ──
  test('empty input', () => { /* '' → '<p></p>' */ });
  test('only whitespace', () => { /* '   ' → 正确处理 */ });
  test('unescaped HTML entities', () => { /* <div> → &lt;div&gt; */ });
  test('very long text (>10K chars)', () => { /* 大文本不崩溃 */ });
  test('unicode (CJK)', () => { /* 中文/日文/韩文 */ });
  test('emoji', () => { /* 😀 保持原样 */ });
  test('html inside markdown', () => { /* 混合输入 */ });

  // ── 扩展语法 ──
  test('wiki link [[title]]', () => { /* 双向链接 */ });
  test('tag #tag', () => { /* 标签 */ });
  test('frontmatter', () => { /* YAML 元数据 */ });
  test('callout > [!note]', () => { /* 警示块 */ });
});

describe('htmlToMarkdown', () => {
  // 反向覆盖以上所有 case，确保 roundtrip 一致性
  test('roundtrip: md → html → md is idempotent', () => { /* */ });
  test('roundtrip: html → md → html preserves structure', () => { /* */ });
});
```

### 17.3 编辑器组件测试 (目标)

```typescript
// 使用 Vitest + @testing-library/react + jsdom

describe('RichTextEditor', () => {
  test('renders initial content', () => { /* */ });
  test('switches between wysiwyg and source mode', () => { /* */ });
  test('calls onChange when content changes', () => { /* */ });
  test('handles empty content', () => { /* */ });
  test('applies search highlight', () => { /* */ });
});

describe('AIToolbar', () => {
  test('shows on text selection', () => { /* */ });
  test('calls AI service on continue', () => { /* */ });
  test('cancels streaming', () => { /* */ });
  test('hides on click outside', () => { /* */ });
});

describe('markdownConverter roundtrip', () => {
  test('all syntax roundtrips without data loss', () => {
    const testCases = [
      '**bold** and *italic*',
      '# Heading\n\nParagraph with `code`',
      '- item 1\n- item 2\n  - nested',
      '| A | B |\n|---|---|\n| 1 | 2 |',
      '```ts\nconst x = 1;\n```',
      '[[Wiki Link]] and #tag',
    ];
    for (const input of testCases) {
      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);
      expect(normalize(output)).toBe(normalize(input));
    }
  });
});
```

### 17.4 性能测试 (目标)

```typescript
describe('Editor Performance', () => {
  test('loads 50K chars under 500ms', async () => {
    const largeContent = generateContent(50000);
    const start = performance.now();
    render(<RichTextEditor initialContent={largeContent} onChange={() => {}} />);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  test('type lag under 50ms', async () => {
    // 模拟快速输入，测量渲染延迟
  });

  test('mode switch under 100ms', async () => {
    // 测量 WYSIWYG ↔ 源码 切换时间
  });
});
```

---

## 十八、重构实施策略

### 18.1 重构阶段划分

```
Phase 1 (基础架构重建): ⚠️ 目录/类型/控制器就绪，但 Converter 为薄封装，测试未迁移
├── 1.1 ✅ 建立新目录结构 (模块化拆分)
├── 1.2 ⚠️ Converter 引擎为薄封装委托旧服务 (未真正重写)
├── 1.3 ✅ 建立 ContentSync (双引擎同步协调器)
├── 1.4 ✅ 建立 EditorController (核心控制器)
├── 1.5 ✅ 建立 EventBus (事件系统)
├── 1.6 ❌ Converter 测试在旧服务目录，converters/__tests__/ 为空
├── 1.7 ⚠️ WysiwygEditor 已封装但未接入主流程 (EditorContainer 使用 SourceEditor)
└── 验收 ⚠️: 基础编辑功能可用 (源码模式)，WYSIWYG 未接入主流程

Phase 2 (扩展就绪但未接入): ⚠️ 文件存在，编辑器未注册
├── 2.1 ✅ 抽离 TipTap 扩展为独立文件 (8 个扩展文件)
├── 2.2 ❌ PluginManager + PluginAPI 未创建 (plugins/ 目录为空)
├── 2.3 ⚠️ 斜杠命令定义就绪 (SlashMenu.ts) 但未接入编辑器
├── 2.4 ⚠️ TableHelper 扩展就绪但未注册 (getBuiltinExtensions 返回 [])
├── 2.5 ⚠️ CodeBlockLang 扩展就绪但未注册
├── 2.6 ⚠️ ImageResize 扩展就绪但未注册
├──     ⚠️ LinkHover / TaskCheckbox 扩展就绪但未注册
└── 验收 ❌: 扩展未接入编辑器，WYSIWYG 模式未启用

Phase 3 (2 周): 源码模式 + 扩展语法
├── 3.1 SourceEditor 已就绪 (CodeMirror 6, 393行, 搜索高亮/wiki link/image preview) ✅
├── 3.2 接入 Phase 2 扩展文件到 WysiwygEditor (8个扩展需注册)
├── 3.3 建立 PluginManager + PluginAPI (plugins/ 目录为空)
├── 3.4 Wiki Link 装饰 + 自动完成 + 导航 (Rust Core 已解析)
├── 3.5 Markdown 扩展语法 (Callout/Math/Mermaid)
├── 3.6 Frontmatter 编辑 UI
└── 验收: 扩展语法可用, WYSIWYG 模式启用, 双引擎可切换

Phase 4 (1 周): AI + 视图模式
├── 4.1 AI 工具栏重构 (移入 ai/ 目录, 与 EditorController 集成)
├── 4.2 AI 流式渲染优化
├── 4.3 阅读模式 / 双栏增强
├── 4.4 文档大纲面板
├── 4.5 编辑器组件测试 (15+ 用例)
└── 验收: AI 工具栏正常, 阅读/双栏模式可用, 组件测试通过

Phase 5 (1 周): 打磨 + 发布
├── 5.1 性能优化 (大文档/内存/渲染)
├── 5.2 主题系统完善
├── 5.3 E2E 测试 (Playwright)
├── 5.4 旧代码清理 + 兼容层验证
├── 5.5 Lint 零 warning + 构建验证
└── 验收: 全部测试通过, 构建无 warning, 性能指标达标
```

### 18.2 并行任务建议

```
     Week 1    Week 2    Week 3    Week 4    Week 5    Week 6    Week 7    Week 8
     ───────  ───────  ───────  ───────  ───────  ───────  ───────  ───────
P1   ████████████████  ⚠️ 基础架构完成, WYSIWYG 未接入, 测试未迁移
P2              ════════════════  ← 当前阶段 (扩展文件就绪, 需接入)
P3                         ════════════════
P4                                    ════════════
P5                                               ════════════
     转换器测试 ════ 199 lines (旧服务) ════ ❌ converters/__tests__/ 为空
     组件测试  ────────────────────────────────────────────────────────────
     E2E 测试   ────────────────────────────────────────────────────────────
```

### 18.3 旧代码兼容策略

```typescript
// 重构期间保持向后兼容

// 1. 保留旧文件, 添加 @deprecated 标记
// 2. 旧组件导入新组件作为实现
// 3. 逐步替换消费者

// editor/index.ts — 统一导出, 保持旧接口
export { Editor } from './EditorContainer';
export { RichTextEditor } from './wysiwyg/WysiwygEditor';
export { CodeMirrorEditor } from './source/SourceEditor';
export { AIToolbar } from './ai/AIToolbar';
export { markdownToHtml, htmlToMarkdown } from './converters';

// 旧文件 RichTextEditor.tsx 标记废弃
/**
 * @deprecated 请使用 Editor/components/wysiwyg/WysiwygEditor
 * 将在 v3.0 中移除
 */
```

### 18.4 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| **转换器重写导致数据丢失** | 中 | 高 | 转换测试覆盖所有语法 (50+ 用例) + roundtrip 一致性校验 |
| **双引擎同步不一致** | 中 | 中 | ContentSync 隔离测试 + 自动化 roundtrip 测试 |
| **旧接口破坏影响其他模块** | 高 | 中 | 保留兼容层 @deprecated, 逐步替换消费者 |
| **大文档性能回归** | 中 | 高 | 性能测试 CI 门禁 + 基准对比 |
| **扩展语法影响标准 Markdown** | 低 | 中 | 扩展语法通过插件加载, 不影响核心解析 |

---

## 十九、编辑器的竞品功能差距分析

| 能力 | NoteForge 当前 | Obsidian | Notion | Typora | 目标 |
|------|:--------------:|:--------:|:------:|:------:|:----:|
| WYSIWYG 编辑 | ⬜ (TipTap) | ❌ | ⬜ | ⬜ | ⬜ |
| 源码模式 | ⬜ (CodeMirror) | ⬜ | ❌ | ⬜ | ⬜ |
| 双栏模式 | ⬜ 计划 | ⬜ | ❌ | ❌ | ⬜ |
| 阅读模式 | ⬜ 计划 | ⬜ | ❌ | ⬜ | ⬜ |
| Callout/Admonitions | ❌ | ⬜ 插件 | ❌ | ❌ | ⬜ |
| 数学公式 | ❌ | ⬜ 插件 | ❌ | ⬜ | ⬜ |
| Mermaid 图表 | ❌ | ⬜ 插件 | ❌ | ⬜ | ⬜ |
| 斜杠命令 | ⬜ | ❌ | ⬜ | ❌ | ⬜ |
| Wiki Links | ⬜ | ⬜ | ❌ | ❌ | ⬜ |
| 拖拽图片 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 表格编辑 | ⬜ | ❌ | ⬜ | ❌ | ⬜ |
| 实时协作 | ⬜ 计划 | ❌ | ⬜ | ❌ | ⬜ |
| AI 写作 | ⬜ | ❌ | ⬜ | ❌ | ⬜ |
| 本地HTML渲染 | ⬜ | ❌ | ⬜ | ⬜ | ⬜ |
| 自定义CSS | ⬜ 计划 | ⬜ | ❌ | ⬜ | ⬜ |
| 版本历史 | ⬜ | ⬜ | ⬜ | ❌ | ⬜ |
| 图片 Caption | ❌ | ⬜ | ⬜ | ❌ | ⬜ |
| 语法高亮 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

---

## 二十、技术债务与已知问题

| # | 问题 | 位置 | 严重度 | 说明 |
|:-:|------|------|:------:|------|
| ED-1 | **markdownConverter 非标准化解析** | `services/markdownConverter.ts` | ⚠️ 有改进空间 | `converters/markdownToHtml.ts` 为薄封装 `export from`，未真正重写 |
| ED-2 | **TipTap heading 仅 1-3 级** | `wysiwyg/extensions/index.ts` | ✅ 已修复 | `heading: { levels: [1,2,3,4,5,6] }` |
| ED-3 | **HTML 粘贴无清洗** | `RichTextEditor.tsx` | 🟡 中 | 直接使用 ProseMirror 默认 paste handler，可能引入脏 HTML |
| ED-4 | **大文档输入卡顿** | 编辑器整体 | 🟡 中 | 未做虚拟化/节流，5 万字以上输入延迟明显 |
| ED-5 | **Base64 图片存储膨胀** | `EditorContainer.tsx` | 🟡 中 | 拖入的图片存为 data URL，笔记体积会无限增长 |
| ED-6 | **测试未迁移** | `converters/__tests__/` | 🟡 中 | 测试在 `services/__tests__/` (旧服务) 中，新目录为空 |
| ED-7 | **WYSIWYG 未接入主流程** | `EditorContainer.tsx` | 🔴 高 | EditorContainer 仅使用 SourceEditor，WysiwygEditor 孤立 |
| ED-8 | **Phase 2 扩展未注册** | `wysiwyg/extensions/index.ts` | 🔴 高 | 8 个扩展文件就绪，`getBuiltinExtensions()` 返回空数组 |
| ED-9 | **Plugin 系统未实现** | `plugins/` | 🔴 高 | `plugins/` 目录为空，PluginManager/PluginAPI 未创建 |
| ED-10 | **旧 RichTextEditor 仍有 577 行内联代码** | `RichTextEditor.tsx` | 🟡 中 | 应迁移到新架构后清理 |

---

## 二十一、总结

### 编辑器重构全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NoteForge 编辑器重构总览                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  章节                    内容                             行数      │
│  ─────────────────      ─────────────────────────────────          │
│  一   编辑器总体架构     分层架构/组件树/数据流/设计原则     ~280行   │
│  二   核心渲染引擎       MD→HTML / HTML→MD / 原生HTML渲染  ~50行    │
│  三   文本格式化         行内格式/块级格式/列表系统          ~50行    │
│  四   代码块系统         高亮/语言选择/行号/复制             ~30行    │
│  五   表格系统           编辑/对齐/CSV/排序/合并             ~30行    │
│  六   图片与媒体         图片/附件/嵌入                     ~50行    │
│  七   扩展语法           Wiki Link/Callout/数学/Mermaid      ~30行    │
│  八   编辑器交互         斜杠命令/拖拽/快捷键/搜索/自动保存  ~80行    │
│  九   AI 集成           写作工具栏/智能功能                  ~30行    │
│  十   进阶编辑能力       Callout/数学/Mermaid/Frontmatter    ~60行    │
│  十一 阅读与视图模式     编辑/源码/双栏/阅读/专注            ~30行    │
│  十二 协作与分享         实时协作/分享链接                    ~30行    │
│  十三 编辑器主题         深色浅色/字体/字号/CSS              ~30行    │
│  十四 升级与优化路线     P1/P2/P3/架构优化                   ~60行    │
│  十五 插件扩展系统       Plugin API/内置插件/加载策略         ~80行    │
│  十六 性能与可伸缩性     目标/大文档策略/内存/渲染优化         ~60行    │
│  十七 测试策略           金字塔/转换器/组件/E2E/性能测试       ~80行    │
│  十八 重构实施策略       阶段划分/并行/兼容/风险              ~60行    │
│  十九 竞品差距分析       与 Obsidian/Notion/Typora 对比       ~20行    │
│  二十 技术债务           已知问题清单                         ~15行    │
│  二十一 总结             完成度/差异化/统计                   ~20行    │
│                                                                     │
│  总计: ~1200 行, 21 章                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 当前编辑器完成度: **Phase 1 ⚠️ + Phase 2 文件就绪但未接入 (约占总体 25%)**

| 模块 | 完成度 | 重构阶段 | 说明 |
|------|:------:|:--------:|------|
| 核心编辑引擎 (源码模式) | 70% ⚠️ | Phase 1-2 | CodeMirror 6 ✅, WYSIWYG 封装但未接入主流程 ❌ |
| 文本格式化 | 50% ⚠️ | Phase 1-2 | 行内/块级格式 Converter 委托旧服务 ✅, 快捷键 KeyboardShortcuts ✅ |
| 转换器 | 60% ⚠️ | Phase 1 | `converters/` 为薄封装 `export from` 旧服务 ❌, 未真正重写 |
| 控制器层 | 80% ✅ | Phase 1 | EditorController/ContentSync/EventBus/KeyboardShortcuts ✅, ModeManager 为桩 |
| 类型系统 | 100% ✅ | Phase 1 | editor.ts/extensions.ts/events.ts 完整类型定义 |
| 向后兼容 | 100% ✅ | Phase 1 | 旧 Editor.tsx 自动委托, 零侵入迁移; index.ts 统一导出 |
| 插件系统 | 0% ❌ | Phase 2 | PluginManager / PluginAPI 未创建, plugins/ 目录为空 |
| 斜杠命令 | 40% ⚠️ | Phase 2 | 定义就绪 (SlashMenu.ts 4类15命令) ❌ 未接入编辑器 |
| 代码块 | 60% ⚠️ | Phase 2 | 语法高亮 ✅ (CodeMirror), 语言选择器/复制按钮在旧 RichTextEditor.tsx 中 |
| 表格 | 50% ⚠️ | Phase 2 | GFM 双向转换 ✅, TableHelper 扩展未注册 ❌ |
| 图片与媒体 | 40% ⚠️ | Phase 2 | SourceEditor 支持拖放/粘贴 ✅, ImageResize/LinkHover 未注册 ❌ |
| 扩展语法 | 10% ⬜ | Phase 3 | Wiki Link 源码装饰 + 自动完成 ✅ (SourceEditor); Callout/Math/Mermaid ❌ |
| AI 集成 | 20% ⬜ | Phase 4 | AIToolbar 旧文件就绪 ✅; 自动标签/语义搜索 ❌, ai/ 目录为空 |
| 阅读/视图 | 10% ⬜ | Phase 4 | 预览面板 ✅ (HTML render); 读/专注/双栏增强 ❌ |
| 测试覆盖 | 15% ⬜ | 贯穿全程 | 转换器 199 lines 在旧服务 ✅; converters/__tests__/ 为空 ❌ |
| 性能优化 | 0% ⬜ | Phase 5 | 大文档/内存/渲染优化 ❌ |

### 核心差异化方向 (重构目标)

1. **AI 原生编辑器**: 写作助手、智能补全、语义搜索 — 与编辑器深度集成
2. **原生 HTML 渲染**: 编辑器中直接渲染富 HTML，支持 `<video>`/`<iframe>` 嵌入
3. **双模式无损切换**: WYSIWYG ↔ 源码 100% 一致，Coverter 标准化覆盖完整 GFM
4. **可扩展插件架构**: Plugin API + 按需加载，第三方可参与扩展
5. **离线优先**: 完全本地运行，无网络依赖，CRDT 同步

### 文档统计

| 指标 | 值 |
|------|:---:|
| 总章节 | 21 章 |
| 总行数 | ~1200 行 |
| 已定义功能点 | 150+ |
| 测试用例目标 | 80+ |
| 重构阶段 | 5 个 Phase, 8 周 |
| 插件数量 (内置) | 10+ |

---

*本文档为编辑器重构目标规格，所有功能均为待实现状态，随重构进度持续更新。*
