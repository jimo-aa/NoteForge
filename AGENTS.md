# NoteForge — Agent Guide

## Project overview

Multi-platform smart notes system (MVP phase). Primary deliverable is a **Tauri 2.x desktop app** with React 18 frontend and Rust core engine. Java/Spring Boot backend, Flutter mobile, and Next.js web are planned but not yet implemented.

## Monorepo structure

| Directory | What | Status |
|-----------|------|--------|
| `desktop/` | Tauri 2 + React 18 + Vite 5 | **Primary deliverable**, working |
| `core/` | Rust lib crate `noteforge-core` (7 modules) | Working, used by desktop via path dep |
| `backend/` | Java 21 + Spring Boot 3.3 (Gradle, multi-module) | Working: ~70 Java files across 3 submodules (common, note-service, user-service) |
| `mobile/` | Flutter 3.x (Dart) | **MVP working** — notes CRUD, auth, sync with backend API |
| `web/` | Next.js 15 App Router (React 19) | **MVP working** — notes CRUD, TipTap editor, auth, search |
| `infra/` | Docker Compose (PostgreSQL+pgvector, Redis, MinIO, ES, Prometheus, Grafana, Nginx) | Ready for use |
| `docs/` | Architecture & design docs (15 `.md` files) | Covers API, DB, sync, AI, deployment, UX, roadmap |
| `scripts/` | Build/dev helper scripts (`.ps1`, `.bat`) | `up`, `down`, `test`, `security-audit` |
| `.github/workflows/` | CI + release workflows | CI runs quality checks + optional Tauri build/Docker build |

## Key entry points

- **Rust core lib:** `core/src/lib.rs` — exports `NoteForge::open()` as the main API
- **Desktop Rust:** `desktop/src-tauri/src/lib.rs` — Tauri builder, command registration (~60 commands)
- **Desktop Rust commands:** `desktop/src-tauri/src/commands.rs` — all Tauri command implementations (~1082 lines)
- **Desktop React:** `desktop/src/main.tsx` → `desktop/src/App.tsx`
- **State management:** Two React Context providers — `AuthProvider` (authStore.tsx) wraps `NoteProvider` (noteStore.tsx)
- **Path alias:** `@/` → `desktop/src/` (configured in vite.config.ts and tsconfig.json)

## Dev commands

Run all from repo root:

| Command | What |
|---------|------|
| `cd desktop && npm run dev` | Vite-only dev server at `localhost:1420` |
| `cd desktop && npm run tauri dev` | Launch Tauri desktop in dev mode |
| `cd desktop && npm run build` | TypeScript check + Vite build (`tsc && vite build`) |
| `cd desktop && npm run tauri build` | Production build (MSI/DMG) |
| `cd desktop && npm run fmt` | Prettier format `src/` |
| `cd desktop && npm run lint` | ESLint check (typescript-eslint + react-hooks rules) |
| `cd desktop && npm run lint:fix` | ESLint auto-fix |
| `cd desktop && npm test` | Vitest unit tests (`src/**/*.{test,spec}.{ts,tsx}`) |
| `cd desktop && npm run test:e2e` | Playwright e2e tests (requires docker-compose stack up) |
| `cd desktop && npm run test:watch` | Vitest watch mode |
| `cd core && cargo test` | Rust unit + integration tests (core/tests/) |
| `cd core && cargo clippy -- -D warnings` | Rust lint (CI gate) |
| `cd core && cargo audit` | Rust dependency vulnerability scan |
| `cd backend && ./gradlew build` | Build all backend services + JaCoCo (60% min), OWASP dep check |
| `cd backend && ./gradlew :note-service:bootRun` | Run note-service |
| `cd backend && ./gradlew :user-service:bootRun` | Run user-service |
| `cd web && npm run dev` | Next.js Web dev server at `localhost:3000` |
| `cd web && npm run build` | TypeScript check + Next.js build |
| `cd mobile && flutter run` | Launch Flutter mobile app (requires device/emulator) |
| `cd mobile && flutter build apk` | Build Android APK |
| `scripts/up.ps1` | Docker up → Rust build → Tauri dev → Java backend |
| `scripts/down.ps1` | Docker compose down |
| `scripts/test.ps1` | Rust core tests (wrapper for `cargo test`) |
| `scripts/security-audit.ps1` | Multi-layer audit: npm audit + cargo audit + Gradle dependencyCheck |

## CI pipeline (from .github/workflows/)

**`ci.yml`** runs on push/PR to `main`:
1. `quality` job: `npm ci` → `npm run build` (tsc + vite) → `npm test` (vitest) → `cargo clippy -D warnings` → `cargo test` → `cargo audit` → `./gradlew build` (JaCoCo 60%, OWASP)
2. `tauri-build` job (conditional on tag v\* or PR label 'build'): system deps → `npm run tauri build -- --bundles msi`
3. `docker` job (main branch): Buildx image build for note-service + user-service

**`release.yml`** on tag push `v*`: creates GitHub Release → builds MSI (Windows, signed) + DMG (macOS, signed) → publishes draft release.

## Important quirks

- **Linter exists:** `eslint.config.js` with typescript-eslint + react-hooks + react-refresh (not just tsc). `npm run lint` to run it.
- **Frontend tests exist:** Vitest (`vitest.config.ts`) with jsdom. Test file example: `src/services/__tests__/syncService.test.ts`. E2E via Playwright (`e2e/`). Both are part of CI.
- **Desktop is ESM:** `desktop/package.json` has `"type": "module"`.
- **Tauri 2** uses `@tauri-apps/api` v2.x and `@tauri-apps/cli` v2.x (not v1).
- **Tauri dev URL** must be `localhost:1420` (configured in vite.config.ts and tauri.conf.json).
- **Bundle active** (not disabled): `tauri.conf.json` has `"bundle": {"active": true}` targeting MSI + DMG. Version is `0.9.0`.
- **Rust core** is linked via `path = "../../core"` in desktop's `Cargo.toml` — always build core first if it changes.
- **Vite config** ignores `src-tauri/**` in `watch.ignored` (prevents infinite rebuild loops).
- **Tauri commands** are called from React via dynamic import `@tauri-apps/api/core` (see `src/utils/invoke.ts`). The `tauriInvoke` utility wraps all Rust-backend calls with error handling.
- **Desktop Rust code** uses `lazy_static!` for caching (5-min TTL caches for versions, diffs, search) and `timed_command!` macro for performance logging (threshold: 100ms).
- **Desktop Rust entry** is `desktop/src-tauri/src/main.rs` (just calls `lib::run()`).
- **Backend** uses Gradle wrapper; services in `note-service/` and `user-service/` have Spring Boot application code.
- **Backend security:** Shared JWT secret between services (no rotation), no integration test containers (uses `TestSecurityConfig` mock), no API gateway.
- **E2E tests** (`e2e/sync.spec.ts`) require the full docker-compose stack running (postgres + redis + both services). Prerequisite noted in test file.
- **infra/docker-compose.yml** creates tables via `init.sql` (pgvector + uuid-ossp extensions, 10 tables). Also includes Prometheus/Grafana for monitoring.
- **Desktop app auth** talks to `localhost:8082/api/v1/auth` (user-service). Token auto-refresh scheduled 15min before expiry.
- **i18n:** zh-CN (fallback) + en-US. Auto-detected from browser/localStorage, key `noteforge:lang`.

## Architecture notes

- Desktop app uses **libgit2** (`git2` crate) for per-note version control, not git CLI.
- Git history stored at Tauri's `app_data_dir` as bare repos per-note (branch pattern: `refs/heads/notes/{noteId}/{branch}`).
- Encryption uses AES-256-GCM with Argon2 password-derived keys (stored in-memory only).
- Search uses Tantivy with jieba-rs Chinese tokenization.
- Everything runs **offline-first** — no backend required for desktop app MVP.
- Desktop Rust has 60+ Tauri commands covering: note/notebook/tag CRUD, versioning (diff/diff-stat, milestones, branches), export/backup/restore, search (fuzzy, advanced, multi-version), sync queue, crash recovery, usage metrics, wiki link backlinks.
- Core Rust modules: `lib` (NoteForge struct + open()), `md_engine`, `storage` (SQLite), `search` (Tantivy), `types`, `encryption`, `metrics`.

## Conventions

- Rust types use `#[serde(rename_all = "camelCase")]` for JS interop.
- Tauri commands use snake_case names (e.g. `create_note`, `search_notes_fuzzy`).
- React components use PascalCase, files match component names.
- CSS: vanilla CSS (globals.css) + CSS modules for feature components. Dark/light theme via `data-theme` attribute on `<html>` (controlled by `useTheme` hook).
- Frontend tests: Vitest with jsdom, files match `src/**/*.{test,spec}.{ts,tsx}`.
- React hooks: custom hooks in `src/hooks/` (useKeyboardShortcuts, useTheme, useOnlineStatus, useAdvancedFeatures).

## Subdirectory AGENTS.md

| File | Covers |
|------|--------|
| `desktop/src/components/AGENTS.md` | React component tree (28 files, 5 subdirs) |
| `backend/AGENTS.md` | Java/Spring Boot microservices |
