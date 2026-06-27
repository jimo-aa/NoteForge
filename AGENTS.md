# NoteForge — Agent Guide

## Project overview

Multi-platform smart notes system (MVP phase). Primary deliverable is a **Tauri 2.x desktop app** with React 18 frontend and Rust core engine. Java/Spring Boot backend, Flutter mobile, and Next.js web are planned but not yet implemented.

## Monorepo structure

| Directory | What | Status |
|-----------|------|--------|
| `desktop/` | Tauri 2 + React 18 + Vite 5 | **Primary deliverable**, working |
| `core/` | Rust lib crate `noteforge-core` | Working, used by desktop via path dep |
| `backend/` | Java 21 + Spring Boot 3.3 (Gradle, multi-module) | Config exists, **no Java source yet** |
| `web/` | Next.js 15 (planned) | **Empty directory** |
| `infra/` | Docker Compose (PostgreSQL+pgvector, Redis, MinIO) | Ready for use |

## Key entry points

- **Rust core lib:** `core/src/lib.rs` — exports `NoteForge::open()` as the main API
- **Desktop Rust:** `desktop/src-tauri/src/lib.rs` — Tauri builder, command registration
- **Desktop React:** `desktop/src/main.tsx` → `desktop/src/App.tsx`
- **State management:** React Context in `desktop/src/stores/`
- **Path alias:** `@/` → `desktop/src/` (configured in vite.config.ts and tsconfig.json)

## Dev commands

Run all from repo root:

| Command | What |
|---------|------|
| `cd desktop && npm run tauri dev` | Launch Tauri desktop in dev mode |
| `cd desktop && npm run dev` | Vite-only dev server at `localhost:1420` |
| `cd desktop && npm run tauri build` | Production build |
| `cd desktop && npm run fmt` | Prettier format `src/` |
| `cd desktop && npm run build` | TypeScript check + Vite build (`tsc && vite build`) |
| `cd core && cargo test` | Rust unit + integration tests |
| `scripts/test.ps1` | Rust core tests (wrapper for `cargo test`) |
| `scripts/up.ps1` | Full stack: Docker → Rust build → Tauri dev → backend |
| `scripts/down.ps1` | Docker compose down |
| `rebuild.bat` | `cd desktop && npm run tauri build` |

## Important quirks

- **No JS/TS test framework** — only Rust tests exist (via `cargo test`)
- **No linter** (no eslint) — only `tsc` for type checking (part of `npm run build`)
- **Prettier** is the formatter: `npm run fmt`
- **Tauri 2** uses `@tauri-apps/api` v2.x and `@tauri-apps/cli` v2.x (not v1)
- **Tauri dev URL** must be `localhost:1420` (configured in vite.config.ts and tauri.conf.json)
- **Rust core** is linked via `path = "../../core"` in desktop's `Cargo.toml` — always build core first if it changes
- **Vite config** ignores `src-tauri/**` in `watch.ignored` (prevents infinite rebuild loops)
- **No .github/CI** — no workflows configured
- **Desktop Rust code** uses `lazy_static!` for caching (5-min TTL caches for versions, diffs, search)
- **Desktop Rust entry** is `desktop/src-tauri/src/main.rs` (just calls `lib::run()`)
- **Backend** uses Gradle wrapper; `note-service/build.gradle` references Java 21 but no application code exists
- **infra/init.sql** creates tables (notes, notebooks, tags, note_tags) and enables pgvector + uuid-ossp extensions
- **Tauri config** has `"bundle": {"active": false}` — bundling is disabled

## Architecture notes

- Desktop app uses **libgit2** (`git2` crate) for per-note version control, not git CLI
- Git history stored at Tauri's `app_data_dir` as bare repos per-note (branch pattern: `refs/heads/notes/{noteId}/{branch}`)
- Encryption uses AES-256-GCM with Argon2 password-derived keys (stored in-memory only)
- Search uses Tantivy with jieba-rs Chinese tokenization
- Everything runs **offline-first** — no backend required for desktop app MVP

## Conventions

- Rust types use `#[serde(rename_all = "camelCase")]` for JS interop
- Tauri commands use snake_case names (e.g. `create_note`, `search_notes_fuzzy`)
- React components use PascalCase, files match component names
- CSS: `desktop/src/styles/globals.css` (no CSS-in-JS or Tailwind detected)
