# NoteForge 桌面端 + 后端 — 功能完成路线图

> **版本：** v2.1.0（最新提交 v1.9.1）
> **聚焦范围：** 桌面端 (Tauri 2 + React 18 + Rust Core) + 后端 (Spring Boot 5 微服务)
> **更新日期：** 2026-07-05

---

## 一、当前状态摘要

### 1.1 桌面端

| 维度 | 数据 |
|------|------|
| Tauri 命令 | 63 个（笔记 CRUD/搜索/加密/版本控制/同步/导出/里程碑/缓存） |
| 编辑器 | CodeMirror 6 (Markdown) + TipTap (WYSIWYG) 双模式 |
| AI 能力 | AIToolbar（续写/改写/翻译/补全 SSE 流式）+ 自动标签 + 语义搜索 |
| 知识图谱 | D3.js force layout + NLP 实体提取 |
| 版本控制 | libgit2：分支/版本/Diff/里程碑/搜索/缓存 |
| ESLint | 0 errors, 20 warnings |
| 测试 | 15 Vitest + 20 Rust tests，全部通过 |
| 构建 | ✅ 通过（有 1.26MB 大 chunk 警告） |
| 状态管理 | **混合模式**：authStore (Context→Zustand wrapper) + noteStore (纯 Context) |

### 1.2 后端

| 维度 | 数据 |
|------|------|
| 微服务 | 5 个全部完成（common / note-service / user-service / ai-service / gateway） |
| Java 文件 | ~70 个（控制器/服务/仓库/实体/DTO/配置/安全/异常） |
| AI 服务 | 写作 API + 自动标签 + Embedding + 语义搜索 (pgvector+BM25) |
| API Gateway | Spring Cloud Gateway，端口 8000，JWT 鉴权 + 限流 |
| 存储 | PostgreSQL+pgvector / Redis / MinIO / Elasticsearch（可选） |
| 实时同步 | WebSocket（SyncWebSocketHandler） |
| 测试 | 59 项（JUnit + Mockito），JaCoCo 60%+ |
| Docker | Compose 全栈部署（含 ai-service + gateway） |
| CI/CD | GitHub Actions：tsc → vitest → cargo clippy → cargo test → gradlew build → vite build |

### 1.3 构建质量

```
ESLint:    0 errors, 20 warnings (pre-existing)
Vitest:   15/15 passed
Rust:     20/20 passed (cargo test)
Build:    vite build ✅ (chunk size warning)
Clippy:   0 warnings
```

---

## 二、发现的技术债务

| # | 问题 | 位置 | 严重度 | 影响 |
|:-:|------|------|:------:|------|
| TD-1 | **noteStore.tsx 纯 Context 模式** — 未迁移 Zustand，组件树顶层 wrap 导致大面积重渲染 | `desktop/src/stores/noteStore.tsx` | 🔴 高 | 性能、可维护性 |
| TD-2 | **authStore.tsx 多余 Context wrapper** — 内部调 useAuthStore 但外层包一层 Context，新组件应直调 Zustand | `desktop/src/stores/authStore.tsx` | 🟡 中 | 架构冗余 |
| TD-3 | **1.26MB 大 chunk** — `index-CC6Y-bnq.js` 超过 500KB 限制，影响首屏加载 | Vite build 产物 | 🔴 高 | 用户体验 |
| TD-4 | **混合 import 模式** — `invoke.ts`、`syncService.ts`、`@tauri-apps/api/core` 同时被 static + dynamic import，阻止正确分块 | 多处 | 🟡 中 | 构建优化 |
| TD-5 | **ESLint 20 warnings** — 主要是 `react-hooks/exhaustive-deps` 和 `react-refresh/only-export-components` | 多处 | 🟢 低 | 代码质量 |
| TD-6 | **ExportService 后端未对接桌面端** — 后端有导出 API（未跟踪新文件），桌面端导出走 Rust 命令 | `backend/note-service/.../ExportService.java` | 🟡 中 | 功能冗余 |
| TD-7 | **API Gateway 刚完成，桌面端仍直连 service** — 同步服务、AI 服务等未通过 Gateway 统一入口 | `desktop/src/services/syncService.ts` | 🟡 中 | 架构一致性 |
| TD-8 | **Testcontainers 集成测试未实际编写** — `AbstractIntegrationTest` 基类已存在但各 service 缺少真实集成测试 | `backend/common/` | 🟡 中 | 测试覆盖 |
| TD-9 | **Markdown↔HTML 转换精度** — `markdownConverter.ts` 在代码块、表格、嵌套列表处可能丢失格式 | `desktop/src/services/markdownConverter.ts` | 🟡 中 | 数据一致性 |

---

## 三、功能完成顺序（5 个 Sprint）

### Sprint 1：状态管理重构 + 性能优化

> **目标：** 清除最大架构债务 + 优化首屏加载
> **周期：** 1 周

| # | 任务 | 工作量 | 详细说明 | 交付物 |
|:-:|------|:------:|----------|--------|
| 1.1 | **noteStore → Zustand 全量迁移** | 2-3d | 将 `noteStore.tsx` 从 `createContext/useContext` 全量迁移到 Zustand（参考 `useAuthStore.ts` 模式）。暴露 `useNoteStore` hook，逐步替换 `useStore()`。打破 Context Provider 树，消除不必要重渲染 | `src/stores/useNoteStore.ts` 新增，`noteStore.tsx` 改为兼容层 |
| 1.2 | **消除 authStore Context wrapper** | 0.5d | `authStore.tsx` 只做版本兼容导出标记为 deprecated，新代码直接 `import { useAuthStore } from '@/stores/useAuthStore'` | authStore.tsx 简化为 re-export |
| 1.3 | **大 chunk 拆分** | 1d | `vite.config.ts` 中 `manualChunks` 把 `@codemirror/*`, `@tiptap/*`, `react`, `@tauri-apps/*` 等拆分为独立 vendor chunk。目标：所有 chunk < 500KB | `vite.config.ts` 更新 |
| 1.4 | **修复混合 import 模式** | 0.5d | `invoke.ts` 改为统一 static import（移除 dynamic import），确保分块策略生效 | `src/utils/invoke.ts` |
| 1.5 | **验证 + 回归测试** | 0.5d | `npm run build` + `npm test` + 手动 E2E 流程 | 构建通过，测试通过 |

**验收标准：**
- [ ] noteStore 完全脱离 Context，使用 Zustand
- [ ] 无 >500KB 的 JS chunk
- [ ] 构建零 warning（除 chunk size 外）
- [ ] 15 项测试全部通过
- [ ] 桌面端手动 E2E 流程正常

---

### Sprint 2：编辑器体验打磨 + AI 增强

> **目标：** 编辑器双模式稳定 + AI 交互顺滑
> **周期：** 1 周

| # | 任务 | 工作量 | 详细说明 | 交付物 |
|:-:|------|:------:|----------|--------|
| 2.1 | **TipTap 斜杠命令菜单** | 1d | 输入 `/` 弹出菜单：标题/列表/表格/代码块/引用/分割线/图片。基于 `@tiptap/suggestion` | `Editor/RichTextEditor.tsx` |
| 2.2 | **TipTap 图片节点拖拽** | 0.5d | 插入的图片支持拖拽调整大小 + 对齐方式选择 | `Editor/RichTextEditor.tsx` |
| 2.3 | **代码块语言选择器** | 0.5d | WYSIWYG 模式代码块顶部显示语言选择下拉框 | `Editor/RichTextToolbar.tsx` |
| 2.4 | **AIToolbar 交互优化** | 1d | 快捷键触发（`Ctrl+I` 选中文本→AI下拉）、长文本分段处理、流式渲染中取消按钮、语气记忆 | `Editor/AIToolbar.tsx` |
| 2.5 | **Markdown↔HTML 转换精度修复** | 1d | 为 `markdownConverter.ts` 添加：代码块 fence 保留、表格对齐、嵌套列表、图片 alt 文本的转换测试。覆盖 10+ 边界 case | `services/markdownConverter.ts` + 测试 |
| 2.6 | **TipTap 搜索高亮** | 1d | 为 WYSIWYG 模式添加文本搜索装饰功能，与 CodeMirror 搜索保持一致的快捷键和 UI | `Editor/Editor.tsx` |

**验收标准：**
- [ ] 双模式切换内容无丢失
- [ ] AI 工具栏支持快捷键 + 取消
- [ ] markdownConverter 边界 case 全部通过
- [ ] 搜索结果在双模式下均可见

---

### Sprint 3：后端深度集成 + 网关标准化

> **目标：** 微服务统一入口 + 后端测试覆盖 + 搜索体验完善
> **周期：** 1 周

| # | 任务 | 工作量 | 详细说明 | 交付物 |
|:-:|------|:------:|----------|--------|
| 3.1 | **API Gateway 统一接入** | 2d | 桌面端 syncService.ts / aiService.ts 改为通过 Gateway (`http://localhost:8000`) 访问后端。Gateway 添加 note-service/user-service/ai-service 路由。桌面端 i18n 提示 URL 可配置 | `desktop/src/services/` 更新 + `gateway/` 路由配置 |
| 3.2 | **后端导出 API ↔ 桌面端对接** | 1d | `ExportService.java` 对接桌面端 ExportBackupModal。增加「云端导出」选项：选择导出格式后调用后端 API 生成并下载 | 两端同步 |
| 3.3 | **Testcontainers 集成测试** | 2d | 基于 `AbstractIntegrationTest` 基类，为 note-service 编写 PostgreSQL + Redis 集成测试（笔记CRUD + 同步 + 版本控制各 3-5 用例） | `backend/note-service/src/test/` |
| 3.4 | **语义搜索前端完善** | 1d | 搜索历史（localStorage）、搜索建议下拉、快捷键 `Ctrl+S` 聚焦搜索栏、搜索结果分段展示（全文/语义结果并列） | `Sidebar/SearchBox.tsx` |
| 3.5 | **版本控制 API 增强** | 1d | 将 `VersionDiffResponse.java` 与桌面端 VersionControlModal 对接。后端支持远程版本存储，桌面端支持「本地版本/云端版本」切换显示 | 后端 DTO + 桌面端 UI |

**验收标准：**
- [ ] 桌面端所有后端调用经过 Gateway
- [ ] 后端集成测试 ≥ 20 项
- [ ] 搜索支持历史 + 建议 + 双模式并列展示
- [ ] 版本控制支持远程 Diff

---

### Sprint 4：功能完整性 —— 补齐差距

> **目标：** 桌面端功能深度完善，达到生产级
> **周期：** 1.5 周

| # | 任务 | 工作量 | 详细说明 | 交付物 |
|:-:|------|:------:|----------|--------|
| 4.1 | **批量操作增强** | 1d | 新增：批量导出（选中笔记→导出为 ZIP）、批量置顶/取消置顶、批量收藏/取消收藏、批量添加/移除笔记本 | `Sidebar/NoteList.tsx` + 命令 |
| 4.2 | **离线模式深度增强** | 2d | 离线指标仪表板（ManageModal 同步 Tab）：待同步数/冲突数/最后同步时间/服务器连通状态。冲突合并 3-way 可视化对比。选择性同步（按笔记本筛选哪些同步） | `Modals/ManageModal.tsx` + `Common/SyncIndicator.tsx` |
| 4.3 | **Diff 可视化优化** | 1.5d | DiffViewerModal 增强：语法高亮 Diff（使用 CodeMirror 对比模式）、单词级差异、侧边栏版本树交互、分支合并冲突可视化解决向导 | `Modals/DiffViewerModal.tsx` |
| 4.4 | **知识图谱增强** | 2d | GraphView 增加：节点搜索/过滤框、笔记间关系权重（引用次数）可视化、点击节点展开子图（懒加载）、导出图谱为 SVG/PNG | `Common/GraphView.tsx` |
| 4.5 | **附件管理后端同步** | 1d | 附件同步策略：冲突时版本合并提示、增量上传/下载、断点续传（大文件分块）、附件状态指示（已同步/待同步/冲突） | `services/syncService.ts` + `Editor/AttachmentPanel.tsx` |

**验收标准：**
- [ ] 批量操作覆盖全部 CRUD 场景
- [ ] 离线仪表板展示真实同步状态
- [ ] Diff 支持语法高亮 + 单词级差异
- [ ] 知识图谱节点搜索 + 导出可用
- [ ] 附件同步无数据丢失

---

### Sprint 5：质量冲刺

> **目标：** 零 warning、测试覆盖提升、构建产物优化、性能达标
> **周期：** 1 周

| # | 任务 | 工作量 | 详细说明 | 交付物 |
|:-:|------|:------:|----------|--------|
| 5.1 | **ESLint 20 warnings → 0** | 1d | 修复 `react-hooks/exhaustive-deps`（补齐依赖数组）+ `react-refresh/only-export-components`（拆分 Context export 到独立文件） | 全量 TS 文件 |
| 5.2 | **桌面端测试扩展** | 2d | Editor 测试（render/命令输入/格式化）、AIService 测试（SSE 解析/错误处理）、SearchBox 测试（模式切换/防抖）、VersionControl 测试（Diff 格式/缓存） | `src/**/*.test.ts` 新增 |
| 5.3 | **Rust Core 测试扩展** | 1d | 加密边界 case（空密码/超大内容/反复加解密）、搜索模糊匹配 edge case（空查询/特殊字符/超长）、同步队列并发测试 | `core/tests/` 新增 |
| 5.4 | **Tauri 构建优化** | 1d | 产物体积优化（strip debug symbols）、Windows MSI 签名流程完善、macOS notarization 脚本验证 | `tauri.conf.json` + CI |
| 5.5 | **Lighthouse 性能审计** | 1d | `lighthouse-ci` 接入桌面端 WebView。Performance ≥ 90、Accessibility ≥ 95、SEO ≥ 90。优化重点：JS 执行时间、布局抖动、图片懒加载 | CI + 性能报告 |

**验收标准：**
- [ ] ESLint 0 errors, 0 warnings
- [ ] 前端测试 ≥ 40 项，全部通过
- [ ] Rust 测试 ≥ 35 项，全部通过
- [ ] `tauri build` 产物 < 80MB（Windows MSI）
- [ ] Lighthouse Performance ≥ 90

---

## 四、完整路线图总览

```
Sprint 1 (1 周)   状态管理重构 + 性能优化
  ├── noteStore → Zustand 全量迁移 (2-3d)
  ├── 消除 authStore Context wrapper (0.5d)
  ├── 大 chunk 拆分 (1d)
  ├── 修复混合 import (0.5d)
  └── 验证 + 回归测试 (0.5d)

Sprint 2 (1 周)   编辑器体验打磨 + AI 增强
  ├── TipTap 斜杠命令菜单 (1d)
  ├── 图片节点拖拽 + 代码块语言选择 (1d)
  ├── AIToolbar 交互优化 (1d)
  ├── Markdown↔HTML 转换精度修复 (1d)
  └── TipTap 搜索高亮 (1d)

Sprint 3 (1 周)   后端深度集成 + 网关标准化
  ├── API Gateway 统一接入 (2d)
  ├── 后端导出 API 对接 (1d)
  ├── Testcontainers 集成测试 (2d)
  ├── 语义搜索前端完善 (1d)
  └── 版本控制 API 增强 (1d)

Sprint 4 (1.5 周) 功能完整性
  ├── 批量操作增强 (1d)
  ├── 离线模式深度增强 (2d)
  ├── Diff 可视化优化 (1.5d)
  ├── 知识图谱增强 (2d)
  └── 附件管理后端同步 (1d)

Sprint 5 (1 周)   质量冲刺
  ├── ESLint warnings → 0 (1d)
  ├── 桌面端测试扩展 (2d)
  ├── Rust Core 测试扩展 (1d)
  ├── Tauri 构建优化 (1d)
  └── Lighthouse 性能审计 (1d)
```

### 工作量汇总

| Sprint | 任务数 | 预估人天 | 产出 |
|:------:|:------:|:--------:|------|
| Sprint 1 | 5 | ~7d | 架构债务清除 + 构建优化 |
| Sprint 2 | 5 | ~5d | 编辑器 + AI 体验提升 |
| Sprint 3 | 5 | ~7d | 后端标准化 + 测试覆盖 |
| Sprint 4 | 5 | ~7.5d | 功能深度完善 |
| Sprint 5 | 5 | ~6d | 质量门禁全通过 |
| **总计** | **25** | **~32.5d** | |

### 推荐优先级

1. **Sprint 1** — 状态管理重构 + 性能优化（阻塞后续所有优化）
2. **Sprint 2** — 编辑器 + AI（用户可见度最高）
3. **Sprint 3** — 后端集成（架构加固）
4. **Sprint 4** — 功能补齐（产品深度）
5. **Sprint 5** — 质量冲刺（发布准备）

---

## 五、不纳入本次范围的功能

以下功能明确不在桌面端 + 后端聚焦计划内（留待后续阶段）：

| 功能 | 原因 | 建议阶段 |
|------|------|:--------:|
| Web 端功能补齐 | 非本次聚焦范围 | 独立 Web 端计划 |
| Flutter 移动端功能补齐 | 非本次聚焦范围 | 独立移动端计划 |
| 实时协作编辑 (CRDT) | 需独立 collab-service + 架构设计 | V3.0+ |
| 分享 + 权限系统 | 与协作编辑绑定 | V3.0+ |
| 社区插件系统 | 需沙箱 + SDK 设计 | V4.0+ |
| 移动端离线存储 | 非本次聚焦范围 | 移动端计划 |
| 三端 E2E 测试 | 非本次聚焦范围 | 三端对齐阶段 |

---

## 六、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| noteStore Zustand 迁移破坏现有功能 | 中 | 高 | 迁移期间保留旧 Context 接口做兼容层，逐步替换消费方；每步都跑测试 |
| TipTap 编辑器与现有 CodeMirror 编辑器冲突 | 低 | 中 | Sprint 1 只重构状态管理不碰编辑器；Sprint 2 独立改动 Editor.tsx |
| API Gateway 切换导致连接中断 | 低 | 高 | 先增加 Gateway 路由配置 + 本地验证，再切桌面端配置；保留 fallback 直连选项 |
| 大 chunk 拆分后 HMR 变慢 | 中 | 低 | manualChunks 只在 build 时生效，dev 模式不受影响 |

---

*本文档基于代码库实际状态生成，聚焦桌面端 + 后端，建议按 Sprint 顺序依次执行。*
