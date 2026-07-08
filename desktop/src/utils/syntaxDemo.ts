// NoteForge — Markdown 语法展示 Demo
// 预渲染的语法展示文档，用于笔记列表中不可修改的语法展示项。
// 内容同步自 docs/markdown-syntax-demo.md

import { renderMarkdown } from './markdown';

export const DEMO_MD = `# NoteForge Markdown 语法完全展示

> **用途:** 本文件完整展示 NoteForge 桌面端编辑器支持的所有 Markdown 语法及自定义扩展语法。

---

## 一、基础格式化

### 1.1 行内格式

| 语法 | 效果 |
|------|------|
| \`**加粗**\` | **加粗** |
| \`*斜体*\` | *斜体* |
| \`***粗斜体***\` | ***粗斜体*** |
| \`~~删除线~~\` | ~~删除线~~ |
| \`__下划线__\` | __下划线__ |
| \\\`行内代码\\\` | \`行内代码\` |
| \`^^高亮^^\` | ^^高亮^^ |

### 1.2 Emoji 简码

在文本中直接输入 \`:smile:\` 会显示为 :smile:，支持 \`:heart:\` (:heart:)、\`:rocket:\` (:rocket:)、\`:fire:\` (:fire:) 等 50+ 常用表情简码。

### 1.3 实体转义

\`\`\`
AT&T → AT&T (自动转义)
<div> → &lt;div&gt; (自动转义)
\`\`\`

---

## 二、标题系统

### 2.1 H1-H6 完整支持

# 标题 1
## 标题 2
### 标题 3
#### 标题 4
##### 标题 5
###### 标题 6

### 2.2 段落

普通段落文本。多个连续段落之间用空行分隔。

这是第二段。段落自动包裹在 \`<p>\` 标签中。

---

## 三、列表系统

### 3.1 无序列表

- 苹果
- 香蕉
- 樱桃

### 3.2 有序列表

1. 第一项
2. 第二项
3. 第三项

### 3.3 嵌套列表

- 水果
  - 苹果
  - 香蕉
    - 巴西香蕉
    - 小米蕉
- 蔬菜
  1. 白菜
  2. 萝卜

### 3.4 任务列表

- [x] 已完成任务
- [ ] 未完成任务
- [ ] 待办事项

---

## 四、代码块系统

### 4.1 无语言标记

\`\`\`
Plain code block without language.
\`\`\`

### 4.2 带语言标记 (语法高亮)

\`\`\`typescript
interface Note {
  meta: NoteMeta;
  content: string;
}

function formatDate(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  return \`\${Math.floor(diff / 60000)}m ago\`;
}
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib[:n]

print(fibonacci(10))
\`\`\`

\`\`\`rust
struct Note {
    id: String,
    title: String,
    content: String,
}

impl Note {
    fn new(title: &str) -> Self {
        Self { id: String::new(), title: title.to_string(), content: String::new() }
    }
}
\`\`\`

### 4.3 行内代码

在段落中可以使用 \`行内代码\` 来标记代码片段，例如 \`const x = 42\` 和 \`npm run build\`。

---

## 五、表格系统

### 5.1 基本表格

| 名称 | 版本 | 描述 |
|------|------|------|
| TypeScript | 5.5 | 类型安全 JavaScript |
| Rust | 1.80 | 系统编程语言 |
| Python | 3.12 | 通用编程语言 |

### 5.2 对齐表格

| 左对齐 | 居中对齐 | 右对齐 |
|:-------|:--------:|-------:|
| 文本 | 文本 | 文本 |
| 长文本内容 | 长文本内容 | 长文本内容 |

### 5.3 空单元格

| 列 A | 列 B | 列 C |
|------|------|------|
| A1 | | C1 |
| | B2 | C2 |
| A3 | B3 | |

---

## 六、引用与分割线

### 6.1 块引用

> 这是一段引用文本。
> 引用可以跨多行。

> > 引用可以嵌套。

### 6.2 分割线

---

### 6.3 可折叠详情

>+++ 点击展开查看详情
> 这里是折叠内容，支持 **Markdown** 格式。
> 可以包含多行文本。
>---

### 6.4 定义列表

: Markdown
: 一种轻量级标记语言，用于格式化纯文本。
: HTML
: 超文本标记语言，用于创建网页。

---

## 七、链接与媒体

### 7.1 超链接

[NoteForge GitHub](https://github.com/noteforge/noteforge)

### 7.2 图片

![NoteForge Logo](https://via.placeholder.com/400x100/6a63ff/ffffff?text=NoteForge)

---

## 八、Callout 警示块

> [!note] 备注
> 这是一条备注信息。支持 **加粗** 和 \`行内代码\`。

> [!warning] 注意
> 请留意这个警告。

> [!tip] 小技巧
> 这是一个实用提示。

> [!danger] 危险
> 这是危险警告！

> [!info] 信息
> 这是一条信息提示。

> [!success] 成功
> 操作已完成！

> [!question] 疑问
> 这是一个疑问提示。

---

## 九、扩展语法

### 9.1 Wiki Links (双向链接)

\`\`\`markdown
[[Note Title]] — 链接到其他笔记
\`\`\`

在笔记列表中显示为可点击的蓝色链接按钮。

### 9.2 标签语法

本文包含 #标签 和 #Rust/编程 和 #日常/2026-07

在编辑器中显示为高亮标签。

### 9.3 高亮语法

^^高亮文本^^ 可用于强调关键内容。

### 9.4 Frontmatter 元数据

\`\`\`
---
title: 语法展示
tags: [demo, reference]
created: 2026-07-07
---
\`\`\`

编辑器会自动识别文件开头的 \`---\` 包裹的 YAML 元数据。

### 9.5 数学公式

行内公式：$E = mc^2$

块级公式：

$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

### 9.6 Mermaid 流程图

\`\`\`mermaid
graph TD
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
    C --> D
\`\`\`

> **说明:** Mermaid 图表由内置 mermaid.js 引擎实时渲染为可交互 SVG。

### 9.7 脚注

这段文字需要脚注说明[^1]。

[^1]: 这是脚注的内容，显示为上标链接。

### 9.8 Emoji 简码

在文本中使用 \`:smile:\` \`:heart:\` \`:rocket:\` 即可显示为 :smile: :heart: :rocket:。

支持 50+ 常用表情简码。

---

## 十、插件功能

### 10.1 斜杠命令菜单（Slash Menu）

在编辑器中输入 \`/\` 即可弹出命令面板，支持分类筛选：

| 类别 | 命令 | 说明 |
|------|------|------|
| 标题 | \`/1\` \`/2\` \`/3\` \`/paragraph\` | 快速切换标题级别 |
| 格式 | \`/bold\` \`/italic\` \`/code\` \`/strike\` | 行内格式快捷操作 |
| 块级 | \`/code\` \`/quote\` \`/hr\` \`/bullet\` \`/number\` \`/task\` | 插入块级元素 |
| 媒体 | \`/table\` | 插入 3×3 表格 |

\`\`\`
使用方式（WYSIWYG 模式）：
1. 在空行输入 / 或选中文本后按 /
2. 从下拉面板中选择命令
3. 或继续输入过滤关键词
\`\`\`

> **注意:** 当前版本使用源码+预览双栏模式，斜杠命令菜单将在 WYSIWYG 模式启用后生效。当前编辑器中直接输入 \`/\` 即可。

### 10.2 插件管理

编辑器的功能通过插件系统管理。在 **管理 → 插件** 中可以查看和切换：

| 插件 | 说明 | 默认 |
|------|------|:----:|
| 核心编辑器扩展 | 加粗/斜体/表格/代码块/任务列表等基础功能 | ✅ |
| 代码块语言选择 | 代码块右上角显示语言标签+下拉选择器 | ✅ |
| 表格键盘导航 | Tab/Enter 在表格单元格间快速导航 | ✅ |
| 任务列表点击切换 | 预览区点击复选框切换任务完成状态 | ✅ |
| 链接悬停提示 | 鼠标悬停链接时显示 URL 提示 | ✅ |
| 图片拖拽调整 | 图片右下角拖拽手柄调整宽高 | ✅ |
| 斜杠命令菜单 | 输入 / 弹出命令面板（4类15命令） | ✅ |
| Callout 警示块 | \`> [!note/warning/tip/danger]\` 6种类型 | ✅ |
| 数学公式 | \`$...$\` 行内公式 / \`$$...$$\` 块级公式 | ✅ |
| Mermaid 图表 | \`\`\`mermaid 流程图/时序图/甘特图 | ✅ |
| Wiki Link 双向链接 | \`[[笔记标题]]\` 点击跳转、悬停预览 | ✅ |
| Frontmatter 元数据 | \`---\` 包裹的 YAML 属性面板 | ✅ |
| 脚注 | \`[^id]\` 引用语法，渲染为上标链接 | ✅ |
| 高亮语法 | \`^^text^^\` 渲染为 <mark> 高亮标签 | ✅ |
| Emoji 简码 | \`:smile:\` \`:heart:\` 等 50+ 表情简码 | ✅ |

启用/禁用即时生效，无需重启应用。

---

## 十一、混合示例

### 11.1 会议笔记

> **Alice:** 编辑器重构进展顺利，插件系统已就绪，可独立启停功能模块。

\`\`\`typescript
// 通过插件系统管理编辑器功能
import { getPluginRegistry } from '@/components/Editor/plugins/registry';
const plugins = getPluginRegistry();
plugins.activate('code-block-lang');  // 启用代码块语言选择
\`\`\`

### 11.2 待办事项

- [x] Alice: 提交 Phase 2 PR
- [ ] Bob: 完成 API 网关限流配置
- [ ] Charlie: 周五前确认移动端设计稿

---

*最后更新: 2026-07-08*`;

/** Pre-rendered HTML from the full syntax demo Markdown */
export const SYNTAX_DEMO_HTML = renderMarkdown(DEMO_MD);
