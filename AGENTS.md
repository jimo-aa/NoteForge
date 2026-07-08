# NoteForge — Agent Guide

## Project overview

Multi-platform smart notes system (MVP phase). **Primary deliverable is the Tauri 2.x desktop app** (React 18 + Rust core). All four platforms have working code:

| Platform | Stack | Status |
|----------|-------|--------|
| **desktop/** | Tauri 2 + React 18 + Vite 5 + CodeMirror 6 | Primary deliverable, working |
| **core/** | Rust lib crate `noteforge-core` (8 modules) | Used by desktop via path dep |
| **backend/** | Java 21 + Spring Boot 3.3 (Gradle, 5 submodules) | Working |
| **web/** | Next.js 15 App Router + React 19 + TipTap | Working |
| **mobile/** | Flutter 3.x + Dart ^3.9.2 | Working |

## Monorepo structure

| Directory | What |
|-----------|------|
| `desktop/` | Tauri 2 app — React 18 frontend, Rust Tauri backend (~37 commands, 496 lines in commands.rs) |
| `core/` | Rust core lib: `noteforge-core` (8 modules: lib, md_engine, storage/sqlite, search/tantivy, types, encryption, metrics, error) |
| `backend/` | 5 Gradle submodules: `common`, `user-service`, `note-service`, `ai-service`, `gateway` |
| `mobile/` | Flutter app — notes CRUD, auth, sync with backend API (Material Design) |
| `web/` | Next.js 15 App Router — notes CRUD, TipTap editor, auth, search |
| `infra/` | Docker Compose (PostgreSQL+pgvector, Redis, MinIO, ES, Prometheus, Grafana, Nginx) |
| `docs/` | Architecture & design docs (API, DB, sync, AI, deployment, UX, roadmap) |
| `scripts/` | Dev helpers: `up.ps1`, `down.ps1`, `test.ps1`, `security-audit.ps1`, `test_api.py` |
| `.github/workflows/` | `ci.yml` (quality → tauri-build/docker) + `release.yml` (signed MSI+DMG on tag v*) |

## Key entry points

- **Rust core lib:** `core/src/lib.rs` — exports `NoteForge::open()` as the main API
- **Desktop Rust:** `desktop/src-tauri/src/lib.rs` — Tauri builder, registers 37 commands
- **Desktop React:** `desktop/src/main.tsx` → `desktop/src/App.tsx`
- **State management:** **Zustand stores** are primary (useNoteStore, useAuthStore). Legacy Context providers (NoteProvider, AuthProvider) are deprecated no-op wrappers kept for backward compat. New code should import from `@/stores/useNoteStore` or `@/stores/useAuthStore` directly with selectors to avoid re-renders.
- **Path alias:** `@/` → `desktop/src/` (vite.config.ts + tsconfig.json)
- **Backend config:** `backend/settings.gradle` includes 5: `common`, `user-service`, `note-service`, `ai-service`, `gateway`

## Where to look

| Task | Location |
|------|----------|
| Note CRUD (desktop) | `desktop/src/stores/useNoteStore.ts` (Zustand) + `desktop/src-tauri/src/commands.rs` (Rust) |
| Note CRUD (backend) | `backend/note-service/controller/NoteController.java` |
| Auth | `desktop/src/stores/useAuthStore.ts` + `backend/user-service/controller/AuthController.java` |
| Editor (desktop) | `desktop/src/components/Editor/` — CodeMirror 6 |
| Editor (web) | `web/src/components/` — TipTap |
| Search | `desktop/src/components/Sidebar/SearchBox.tsx` + `core/src/search.rs` (Tantivy) |
| Versioning | `desktop/src-tauri/src/commands.rs` (snapshot-based) + `desktop/src/components/Modals/VersionHistoryDialog.tsx` |
| Sync | `desktop/src/services/syncService.ts` (REST to gateway:8000) + `backend/note-service/config/SyncWebSocketHandler.java` |
| API Gateway | `backend/gateway/` — routes to note-service/user-service on port 8000 |
| AI features | `backend/ai-service/` — embedding, tagging, writing assistant endpoints |

## Dev commands

Run all from repo root.

### Desktop (Tauri + React)

```bash
cd desktop
npm run dev          # Vite-only at localhost:1420
npm run tauri dev    # Full Tauri desktop
npm run build        # tsc && vite build
npm run tauri build  # Production MSI/DMG/NSIS
npm run fmt          # Prettier format src/
npm run lint         # ESLint (typescript-eslint + react-hooks + react-refresh)
npm run lint:fix     # ESLint auto-fix
npm test             # Vitest unit tests (jsdom, src/**/*.{test,spec}.{ts,tsx})
npm run test:e2e     # Playwright e2e (requires docker-compose stack up)
```

### Core (Rust)

```bash
cd core
cargo test              # Unit + integration tests
cargo clippy -- -D warnings   # CI gate
cargo audit             # Dependency vulnerability scan
```

### Backend (Java/Gradle)

```bash
cd backend
./gradlew build                             # Build all + JaCoCo (50% min) + OWASP dep check
./gradlew :note-service:bootRun             # Note service on :8081
./gradlew :user-service:bootRun             # User service on :8082
./gradlew :ai-service:bootRun               # AI service
./gradlew :gateway:bootRun                  # API gateway on :8000
```

### Web (Next.js)

```bash
cd web
npm run dev     # localhost:3000
npm run build   # TypeScript check + Next.js build
npm run lint    # next lint
```

### Mobile (Flutter)

```bash
cd mobile
flutter run           # Requires device/emulator
flutter build apk     # Android APK
```

### Infrastructure

```bash
# Start full stack: Postgres+pgvector, Redis, MinIO, Elasticsearch, Prometheus, Grafana, Nginx
docker compose -f infra/docker-compose.yml up -d
```

## CI pipeline (from .github/workflows/)

**ci.yml** runs on push/PR to `main`:

1. `quality` job: `npm ci` → `npm run build` (tsc+vite) → `npm test` (vitest) → `cargo clippy -D warnings` → `cargo test` → `cargo audit` → `./gradlew build`
2. `tauri-build` (conditional: tag v* or PR label 'build'): Linux system deps → `npm run tauri build -- --bundles msi`
3. `docker` (main branch): Buildx images for note-service + user-service

**release.yml** on tag push `v*`: creates draft GitHub Release → builds signed MSI (Windows) + signed DMG (macOS) → publishes draft.

## Conventions & quirks

### Frontend (desktop)

- **ESM:** `desktop/package.json` has `"type": "module"`
- **ESLint:** `eslint.config.js` with typescript-eslint + react-hooks + react-refresh. `react-refresh/only-export-components` is **warn** (not error). `react-hooks/set-state-in-effect` is **off** (many effects call setState on mount — valid pattern here).
- **TypeScript:** strict mode with `noUncheckedIndexedAccess: true`. `noUnusedLocals` and `noUnusedParameters` are **false**.
- **CSS:** `globals.css` + CSS modules for feature components. Dark/light theme via `data-theme` on `<html>` (controlled by `useTheme` hook). Accent color persisted in localStorage key `noteforge:accent`.
- **i18n:** zh-CN (fallback) + en-US. Auto-detected from localStorage key `noteforge:lang` or browser navigator.
- **Tauri commands** called from React via `@tauri-apps/api/core` `invoke()`, wrapped in `src/utils/invoke.ts` (`tauriInvoke` helper that returns null on error instead of throwing).
- **Tauri commands are snake_case** (e.g. `create_note`, `search_notes_fuzzy`). Rust types use `#[serde(rename_all = "camelCase")]`.
- **Vite config** ignores `src-tauri/**` in `watch.ignored` (prevents infinite rebuild loops).
- **CodeMirror 6** is the editor engine (not TipTap — TipTap is used on the web platform).
- **GraphView** is lazy-loaded via `React.lazy` + `Suspense`.
- **Error handling:** Global error handlers in App.tsx persist crashes via `write_crash_log` Tauri command. `ErrorBoundary` component wraps the app root.
- **Sync** talks to **API Gateway on port 8000** (`http://localhost:8000/api/v1/sync`), not directly to note-service. Gateway URL configurable via localStorage key `noteforge:api:gateway-url`.

### Rust (core + desktop)

- **`timed_command!` macro** in `commands.rs` logs commands exceeding 100ms threshold.
- **`lazy_static!`** used only for metrics singleton (`METRICS`), not for caching.
- **Core modules:** `lib` (NoteForge struct + open()), `md_engine` (pulldown-cmark), `storage` (rusqlite bundled), `search` (tantivy 0.22 + jieba-rs 0.7), `types`, `encryption` (aes-gcm 0.10 + argon2 0.5), `metrics`, `error`.
- Path dependency: `desktop/src-tauri/Cargo.toml` links core via `path = "../../core"`.

### Backend

- 5 submodules: `common` (shared lib), `user-service` (auth:8082), `note-service` (notes:8081), `ai-service` (AI endpoints), `gateway` (API gateway:8000).
- JaCoCo minimum: **50%** (not 60% — confirmed in build.gradle). Excludes dto/, entity/, exception/, document/, ExportService*.
- Standard 3-layer: controller → service → repository. Lombok for entity boilerplate.
- JWT is shared between services (no rotation). No testcontainers in CI (uses `TestSecurityConfig` mock).
- Profiles: dev, test, prod (`application-{profile}.yml`).

### Web

- React **19** with Next.js **15** App Router.
- TipTap editor (v2.11).
- API base configured via env `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`).
- Minimal build step: `npm run build` (no separate typecheck step — Next.js includes it).

### Mobile

- Flutter 3.x with Dart SDK ^3.9.2.
- Material Design. Provider for state management. HTTP + shared_preferences + intl.
- Cross-platform: Android, iOS, Linux, macOS, Windows, Web (flutter run targets).

## Testing quirks

- **Vitest** with jsdom. Setup file: `desktop/src/test/setup.ts`. Test files: `src/**/*.{test,spec}.{ts,tsx}`.
- **Playwright E2E** in `desktop/e2e/` — requires full docker-compose stack (postgres + redis + both backend services). Prerequisite noted in `sync.spec.ts`.
- **Rust tests** in `core/tests/` (integration) and inline in each module.
- **Existing frontend tests:** `NoteList.test.tsx`, `syncService.test.ts`, `markdownConverter.test.ts`, `aiService.test.ts`.
- JaCoCo verification threshold is **50%** (not 60% as stated elsewhere).
- `cargo audit` is installed fresh each CI run (`cargo install cargo-audit`).

## Subdirectory AGENTS.md

| File | Covers |
|------|--------|
| `desktop/src/components/AGENTS.md` | React component tree (28 files, 5 subdirs) |
| `backend/AGENTS.md` | Java/Spring Boot microservices |
