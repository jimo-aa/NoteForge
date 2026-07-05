# Changelog

All notable changes to NoteForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.1.0] - 2026-07-03
### Added
- **三端打磨 — 移动端 UIUX 全面重设计 + i18n 国际化**
  - Mobile: 新增完整 i18n 系统（LocaleProvider + zh/en 双语言字符串映射，默认中文）
  - Mobile: 基于 mobile-ui-prototype.html 全面重写 UI，匹配像素级设计稿
  - Mobile: 5-Tab 底部导航（笔记/搜索/笔记本/收藏/我的）+ IndexedStack 页面保持
  - Mobile: 全新笔记首页 — Header头像、问候语、📌已固定分区、最近更新列表
  - Mobile: 全新搜索页 — 搜索栏、最近搜索标签、快速搜索入口、防抖查询
  - Mobile: 全新笔记本页 — 全部笔记卡片、笔记本列表、长按删除
  - Mobile: 全新收藏页 — 星标笔记列表、空状态引导
  - Mobile: 全新个人中心页 — 用户头像、4维统计卡片、7项菜单（同步/主题/加密/存储/反馈/关于/退出）
  - Mobile: 全新全屏编辑器 — 工具栏(返回/收藏/保存/删除)、标签行、标题+正文编辑区、状态栏(保存状态/字数/时间)、浮动格式栏(B/I/S/`/H/•/☐/❝)
  - Mobile: 底部弹窗系统 — 新建笔记(标题/笔记本/标签/内容)、新建笔记本(名称/图标网格/颜色选择/实时预览)、主题设置(浅色/深色/系统 + 字体大小 + 强调色)
  - Mobile: Toast 通知系统 (success/error/info 三种类型，自动消失)
  - Mobile: 完整 Light/Dark 双主题（精确匹配原型配色 #6366f1 强调色系）
  - Desktop: 桌面端 i18n 已确认默认 zh-CN fallback（React i18next）
  - Mobile: flutter analyze 零 issue 通过
- **三端打磨 — 移动端优化**
  - i18n 全部落地：15 个文件约 80 处硬编码中文字符串替换为 l10n.tr() 调用
  - 新增 ThemeProvider（ChangeNotifier），主题切换实时生效
  - theme_sheet 选择模式后立即通过 ThemeProvider 切换 MaterialApp themeMode
  - 清理死代码：移除未使用的 api_client.dart（92 行）
  - 新增 l10n 键：时间相对格式（X分钟前/X小时前/X天前）、默认用户名/邮箱、删除确认、打招呼时间变体
  - note_card/notebook_card 日期格式、数量文本全部走 l10n
  - 所有 AlertDialog 标题/按钮/确认文案走 l10n
  - flutter analyze 零 issue 通过
- **三端打磨 — 移动端图标系统向量化**
  - 新增 `core/app_icons.dart` — 全局图标常量（Material IconData 统一映射）
  - 底部 Tab 导航：emoji → Material Icons（description/search/menu_book/star/person）
  - Tab 图标选中态 accent 色，未选中态 textMutedColor
  - Profile 菜单 7 项 + 退出登录图标全部替换为 Material 向量图标
  - 笔记本图标选择器：16 emoji → 16 Material 向量图标
  - 主题模式选择器：light_mode/dark_mode/settings_remote
  - 笔记卡片类型图标：book/bolt/note/target/push_pin
  - 编辑器、搜索提示、笔记本列表图标全部向量化
  - 新增 `flutter_svg: ^2.0.10+1` 依赖
  - flutter analyze 零 issue 通过
- **三端打磨 — 移动端接入真实后端 API**
  - `core/api_client.dart` 重写：基于后端 Spring Boot 控制器完整实现 REST 调用
  - Auth: POST /api/v1/auth/login, /register, GET /me（Bearer JWT）
  - Notes: GET/POST/PUT/DELETE /api/v1/notes + /search（分页 `PageResponse`）
  - Notebooks: GET/POST /api/v1/notebooks（query params 传 name/icon/color）
  - Tags: GET /api/v1/tags
  - Search: GET /api/v1/search?q=&mode=fulltext
  - `auth_provider.dart`：hydrate() 从 SharedPreferences 取 token 后调用 GET /me 刷新用户
  - `note_provider.dart`：移除全部模拟数据，`loadData()` 并行请求 notes/notebooks/tags
  - CRUD 方法改为 async，返回 Future<bool/NoteItem?>
  - editor_screen/main/notebooks_screen 同步改为 await 异步调用
  - API 响应统一解析：`ApiResponse.code==0` 判定成功，支持分页/列表/单对象三种 data 格式
- **移动端问题修复（P0/P1/P2）**
  - P0: Profile 菜单 5 项空回调 → 点击弹出"即将推出" Toast
  - P0: 搜索页切换至后端 GET /api/v1/notes/search 接口
  - P0: 新增全局网络错误处理 — NoteProvider.error 字段 + 笔记页错误横幅（含重试按钮）
  - P1: 编辑器新增置顶切换按钮（Pin），工具栏显示置顶状态
  - P1: 编辑器新增笔记本选择器 — 点击当前笔记本弹出底部弹窗切换
  - P1: 编辑器保存时传递 isPinned/isFavorite 到后端
  - P2: 搜索页 RefreshIndicator 下拉刷新
  - P2: 移除 search_screen 中不再使用的 NoteProvider 导入
- **移动端主题系统完整化**
  - ThemeProvider 扩展：fontSize scale（small/medium/large/extraLarge）+ accentColor 自定义
  - 主题设置持久化：mode/fontSize/accentColor 通过 SharedPreferences 保存
  - theme.dart 新增 `lightWith()`/`darkWith()` 方法，接收 accentColor + fontSizeScale 参数
  - main.dart MaterialApp 使用 ThemeProvider 的动态值构建 theme/darkTheme
  - theme_sheet 字体大小下拉选择生效，强调色 6 色选择生效
  - 修复 `Color.value` 弃用警告 → 改用 `Color.toARGB32()`
  - flutter analyze 零 issue 通过
- **Docs: 三端对齐进度标记
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
