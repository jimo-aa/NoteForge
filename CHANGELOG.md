# Changelog

All notable changes to NoteForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
