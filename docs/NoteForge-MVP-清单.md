# NoteForge MVP 功能清单

> 目标：4 周内交付可用的桌面笔记应用

---

## 一、MVP 范围

### 🎯 核心目标
- ✅ 桌面端可用的笔记编辑器（Markdown + 所见即所得）
- ✅ 本地笔记创建/编辑/删除/搜索
- ✅ 云端备份与多端同步（基础版）
- ✅ 用户注册登录
- ✅ 笔记本/标签管理

### ❌ 不在 MVP（后续 Phase）
| 功能 | 排期 |
|------|:----:|
| Flutter 移动端 | Phase 2 |
| AI 写作/标签/搜索 | Phase 3 |
| 实时协作编辑 | Phase 4 |
| 端到端加密 | Phase 2 |
| 知识图谱 | Phase 3 |
| 社区插件系统 | Phase 4 |

---

## 二、Phase 1 详细任务拆分（4 周）

### Week 1：Rust 核心引擎

| 编号 | 任务 | 状态 |
|:----:|------|:----:|
| 1.1 | Rust 项目骨架搭建 (Cargo workspace) | ✅ 已完成 |
| 1.2 | Markdown 引擎：解析 pulldown-cmark → AST | ✅ 已完成 |
| 1.3 | Markdown 引擎：Wiki Link [[...]] 解析 | ✅ 已完成 |
| 1.4 | Markdown 引擎：HTML 渲染 | ✅ 已完成 |
| 1.5 | 本地存储：SQLite 建表 + 笔记 CRUD | ✅ 已完成 |
| 1.6 | 本地存储：笔记本/标签 CRUD | ✅ 已完成 |
| 1.7 | 本地搜索：Tantivy 全文索引 | ✅ 已完成 |
| 1.8 | FFI 接口：Tauri 命令绑定 | ✅ 已完成 |

### Week 2：Tauri 桌面端

| 编号 | 任务 | 状态 |
|:----:|------|:----:|
| 2.1 | Tauri 项目创建 + React 集成 | ✅ 已完成 |
| 2.2 | 基础 UI：侧边栏 + 笔记列表 + 编辑器 | ✅ 已完成 |
| 2.3 | Markdown 编辑器 (CodeMirror 6) | ✅ 已完成 |
| 2.4 | 笔记 CRUD 界面 | ✅ 已完成 |
| 2.5 | 笔记本/标签管理界面 | ✅ 已完成 |
| 2.6 | 全文搜索界面 | ✅ 已完成 |
| 2.7 | 键盘快捷键 | ✅ 已完成 |
| 2.8 | 系统托盘 + 全局搜索 | ✅ 已完成 |

### Week 2.5：编辑体验与本地数据能力（当前实现标记）

| 编号 | 功能 | 状态 |
|:----:|------|:----:|
| 2.9 | 本地内容保存（SQLite/本地文件持久化） | 🟡 部分完成 |
| 2.10 | 版本控制（历史版本 / 草稿 / 回滚） | 🟡 部分完成 |
| 2.11 | 自动保存 | ✅ 已完成 |
| 2.12 | 崩溃恢复 | 🟡 部分完成 |
| 2.13 | 搜索结果高亮 | ✅ 已完成 |
| 2.14 | Wiki Link 自动补全 | ✅ 已完成 |
| 2.15 | 图片拖拽 / 粘贴 | ✅ 已完成 |
| 2.16 | 草稿管理 | 🟡 部分完成 |
| 2.17 | 历史版本管理 | 🟡 部分完成 |
| 2.18 | 光标位置恢复 | ✅ 已完成 |

### Week 3：Java 后端

| 编号 | 任务 | 状态 |
|:----:|------|:----:|
| 3.1 | Spring Boot 项目骨架 | ✅ 已完成 |
| 3.2 | PostgreSQL 建表 + JPA 实体 | ✅ 已完成 |
| 3.3 | 用户注册/登录 (JWT) | ✅ 已完成 |
| 3.4 | 笔记 CRUD API | ✅ 已完成 |
| 3.5 | 同步 API (pull/push) | ✅ 已完成 |
| 3.6 | MinIO 文件上传 | ✅ 已完成 |
| 3.7 | API 文档 (SpringDoc OpenAPI) | ✅ 已完成 |

### Week 4：集成与打磨

| 编号 | 任务 | 状态 |
|:----:|------|:----:|
| 4.1 | 桌面端 ↔ 后端 同步集成 | ✅ 已完成 |
| 4.2 | 增量同步 (差异计算 + 冲突解决) | ✅ 已完成 |
| 4.3 | Docker Compose 全栈部署 | ✅ 已完成 |
| 4.4 | 基本错误处理 + 重试机制 | ✅ 已完成 |
| 4.5 | 打包测试 (Windows .msi / macOS .dmg) | 📝 |
| 4.6 | 用户引导 + 新手教程 | 📝 |
| 4.7 | 性能优化 + 内存泄漏检查 | 📝 |

---

## 三、MVP 交付物

### 📦 可交付

| 交付物 | 说明 |
|--------|------|
| 📦 **Rust Core crate** | `core/` — 可在 x86_64 编译通过 |
| 🖥️ **Tauri 桌面 App** | `desktop/` — Windows/macOS 可运行 |
| ⚙️ **Java 后端服务** | `backend/` — 可 localhost 启动 |
| 🐳 **Docker Compose** | `infra/` — 一键启动基础设施 |
| 📋 **API 文档** | 访问 `localhost:8080/swagger-ui.html` |

### ✅ 验收标准

```yaml
用户流程:
  ├── 注册/登录 → 创建笔记本 → 写笔记 → 搜索 → 导出 → ✅

技术指标:
  ├── 笔记打开 < 100ms (含 Markdown 渲染)
  ├── 全文搜索 < 200ms (1万条笔记)
  ├── 后端 API 响应 < 50ms
  └── 同步延迟 < 3s (同区域)
```

---

## 四、技术栈（MVP 简化版）

| 组件 | MVP 方案 | 生产方案（未来） |
|------|---------|----------------|
| 搜索引擎 | **Tantivy (Rust 本地)** | Tantivy + Elasticsearch |
| 同步 | **REST pull/push + 版本号** | CRDT WebSocket |
| 加密 | **无（纯文本）** | AES-256-GCM |
| 部署 | **Docker Compose** | Kubernetes |
| CI | **无** | GitHub Actions |
| 移动端 | **无** | Flutter |

---

## 五、MVP 项目结构

```
NoteForge/
├── core/                    ← Rust 核心引擎 (crate)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs           ← 统一导出
│       ├── md_engine.rs     ← Markdown 解析
│       ├── storage.rs       ← SQLite 本地存储
│       ├── search.rs        ← Tantivy 搜索
│       └── types.rs         ← 公共类型
│
├── desktop/                 ← Tauri 桌面端
│   ├── package.json         ← React 前端
│   ├── src/                 ← React 源码
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── src-tauri/           ← Tauri Rust 后端
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs      ← Tauri 入口
│           └── commands.rs  ← Tauri 命令
│
├── backend/                 ← Java Spring Boot
│   ├── note-service/        ← 笔记微服务
│   ├── user-service/        ← 用户微服务
│   └── settings.gradle      ← Gradle 多模块
│
├── web/                     ← React Web 端 (Phase 2)
│   └── (后续)
│
├── infra/                   ← 基础设施
│   └── docker-compose.yml
│
└── docs/                    ← 文档
    ├── api-design.md
    ├── database-schema.md
    └── (等)
```

---

*Phase 1 目标：4 周完成，Week 1-3 开发，Week 4 集成打磨*
