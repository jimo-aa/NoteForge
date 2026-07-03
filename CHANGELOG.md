# Changelog

All notable changes to NoteForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.0] - 2026-07-03
### Added
- **V2.0 Sprint 1 — 基础设施加固**
  - Backend: JWT Secret 隔离（USER_JWT_SECRET / NOTE_JWT_SECRET 独立环境变量）
  - Desktop: Zustand 状态管理迁移（useAuthStore.ts）
  - Desktop: 类型系统清理（NoteResponseItem extends NoteMeta）
  - Backend: Testcontainers 集成测试基类（AbstractIntegrationTest）
- **V2.0 Sprint 2 — AI 核心能力**
  - Backend: ai-service 微服务模块（LlmClient + AiWritingService + AiTagService + AiEmbeddingService）
  - Backend: AI 写作 API（续写/改写/翻译/补全，SSE 流式）
  - Backend: 自动标签 API（LLM prompt + 关键词 fallback）
  - Backend: Embedding API（文本向量化）
  - Desktop: AIToolbar 浮动工具栏（选中文本 → 续写/改写/翻译/补全）
  - Desktop: SSE 流式渲染（实时增量插入编辑器）
  - Infrastructure: ai-service docker-compose 容器化
- **V2.0 Sprint 3 — 桌面体验增强**
  - Backend: 语义搜索（pgvector + BM25 混合搜索，POST /api/v1/ai/search）
  - Desktop: SearchBox 全文/语义/混合三模式切换
  - Desktop: SyncIndicator 侧边栏同步状态指示器
  - Desktop: 管理面板「同步」Tab（冲突检测 + 本地保留/远程接受）
  - Desktop: TipTap 富文本编辑器（WYSIWYG / Markdown 源码双模式）
  - Desktop: RichTextToolbar 格式化工具栏（B/I/U/标题/列表/表格/链接/图片）
  - Desktop: TipTap Table 扩展（行/列增删、编辑）
- **V2.0 Sprint 4 — 知识图谱与发布冲刺**
  - Desktop: GraphView NLP 实体提取 + 实体模式切换
  - Desktop: Chunk 拆分 + GraphView 懒加载（1.2MB→264KB main chunk）
  - Backend: API Gateway 微服务（Spring Cloud Gateway，端口 8000）
  - Backend: Gateway JWT 鉴权过滤器 + 速率限制
  - Infrastructure: Lighthouse CI GitHub Actions 工作流
  - Core: 加密安全性强化（OsRng 替代 thread_rng，6 项新增安全测试）
  - Docs: 安全审计报告（docs/security-audit-report.md，评级：通过）
- **V3.0 Sprint 1 — Web 端 MVP**
  - Web: Next.js 15 App Router 项目骨架
  - Web: 共享 API 客户端（api-client.ts，封装全部后端服务）
  - Web: JWT 认证（登录/注册，Zustand 持久化）
  - Web: 主布局 + 侧边栏导航 + 认证守卫
  - Web: 笔记列表（笔记本筛选、收藏筛选、Pin 标识、标签展示）
  - Web: TipTap 富文本编辑器（WYSIWYG + Markdown 源码双模式、表格编辑）
  - Web: 笔记属性面板（笔记本选择、标签管理、Pin/Favorite、日期、字数、版本）
  - Web: AI 自动标签（创建笔记后自动推荐）
  - Web: 笔记本管理（创建/删除/筛选）
  - Web: 全文搜索页面 + 设置页面
  - Web: PWA manifest + 中英文 i18n 完整支持

- **V3.0 Sprint 2 — Flutter 移动端 MVP**
  - Mobile: Flutter 3.x 项目骨架 + Provider 状态管理
  - Mobile: 核心 API 客户端（与 backend REST API 集成）
  - Mobile: JWT 认证（登录/注册，SharedPreferences 持久化）
  - Mobile: 笔记列表（笔记本筛选、收藏筛选、Pin/Star 标识）
  - Mobile: 笔记编辑器（标题/内容编辑、标签管理、Pin/Favorite）
  - Mobile: 笔记本管理（创建/删除/筛选）
  - Mobile: 全文搜索 + 设置页面
  - Mobile: Material You 深色主题 + Provider 响应式状态

### Changed
- Vite 5.4 → Vite 8 回退（修复 __BUNDLED_DEV__ HMR 错误）

## [1.0.0] - 2026-07-02

### Added
- Desktop: Tauri 2 + React 18 Vite dev environment
- Desktop: Markdown editor with live preview (CodeMirror 6)
- Desktop: Wiki Link navigation and autocomplete ([[Note Title]])
- Desktop: WYSIWYG task list checkboxes in editor
- Desktop: Image paste/drop preview in editor
- Desktop: Full-text search with Tantivy + jieba-rs (Chinese tokenization)
- Desktop: Version control with libgit2 (create/restore branches, diff)
- Desktop: Milestone management per note
- Desktop: Draft recovery with crash detection
- Desktop: Notebook organization with icon/color picker
- Desktop: Tag management and filtering
- Desktop: End-to-end encryption (AES-256-GCM + Argon2)
- Desktop: Export to Markdown, HTML, JSON
- Desktop: Full backup/restore system
- Desktop: Internationalization (i18n) — zh-CN and en-US
- Desktop: Keyboard shortcuts
- Desktop: Knowledge Graph view (D3.js force layout)
- Desktop: Attachment management
- Desktop: Dark/Light theme toggle
- Desktop: Auth UI (login/register/logout)
- Desktop: Context menu on notes/notebooks
- Desktop: Batch operations (multi-select, batch move/delete/tag)
- Desktop: Auto-save indicator with status bar
- Desktop: Virtual scrolling for 60fps note list
- Desktop: Tauri system tray + global search (Ctrl+K)
- Desktop: Welcome guide on first launch
- Desktop: Local usage metrics tracking
- Desktop: Updater integration (Tauri plugin + release workflow)
- Core: Rust core engine (markdown, search, encryption, git-based versioning)
- Core: Typed error system (CoreError enum) replacing Box<dyn Error>
- Backend: Spring Boot 3.3 microservices (common, note-service, user-service)
- Backend: PostgreSQL with pgvector extension
- Backend: Redis-based token blacklist with 5min TTL
- Backend: WebSocket real-time sync
- Backend: Elasticsearch integration (conditional, via feature flag)
- Backend: Operation audit logging
- Backend: Rate limiting, CORS, MDC tracing
- Backend: 59 unit/integration tests (JaCoCo 60%+ coverage)
- Backend: Docker Compose infrastructure (PostgreSQL, Redis, MinIO, ES, Prometheus, Grafana, Nginx)
- Infrastructure: GitHub Actions CI pipeline (tsc → vitest → cargo clippy → cargo test → gradlew build → vite build)
- Infrastructure: Tauri MSI/DMG signed build via release workflow
- Infrastructure: Prometheus/Grafana monitoring stack
- Infrastructure: Multi-layer security audit (npm + cargo + Gradle)
- Docs: Architecture, API, Database, Rust Engine, AI, Sync, Deployment docs
- Docs: AGENTS.md for agent-assisted development (root + backend + components)

### Changed
- Version bumped to 1.0.0
- Refactored i18n: all UI components use react-i18next by default
- Updated eslint to flat config (ESLint 9 + typescript-eslint + react-hooks)

### Fixed
- Editor: Chinese input with IME no longer triggers duplicate autosave
- Editor: Multiple wiki link brackets in same line handled correctly
- Editor: Table format alignment respects cursor position
- Search: Works with empty queries and partial Chinese terms
- Tests: NoteList test mocks i18n properly
- Tests: Backend controller tests mock StringRedisTemplate for Redis-dependent flows
- Clippy: Fixed ptr_arg, identity_op, needless_borrows warnings
- Lint: Fixed conditional useMemo hook in DraftRecoveryModal

### Security
- AES-256-GCM encryption with Argon2id key derivation
- Encryption keys stored in memory only (never persisted)

## [0.1.0] - 2026-06-01
### Added
- MVP baseline: Tauri desktop shell, Rust core, basic CRUD
