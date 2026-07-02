# Contributing to NoteForge

We love contributions! Here's how to get started.

## Code of Conduct

Be respectful, constructive, and inclusive. Harassment and discrimination are not tolerated.

## How to Contribute

### Report Bugs
- Open a [GitHub Issue](https://github.com/openclaw/NoteForge/issues/new)
- Include: steps to reproduce, expected vs actual behavior, environment info
- Label with `bug`

### Suggest Features
- Open a [GitHub Issue](https://github.com/openclaw/NoteForge/issues/new)
- Describe the problem you're solving and your proposed solution
- Label with `enhancement`

### Submit Code
1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `npm run build` in `desktop/` to verify TypeScript
5. Run `cargo test` in `core/` to verify Rust tests
6. Run `./gradlew test` in `backend/` to verify Java tests
7. Commit with a descriptive message
8. Push and open a Pull Request

## Development Setup

### Prerequisites
- Node.js 18+
- Rust 1.75+
- Java 21+ (for backend)
- Docker Desktop (for backend infra)

### Desktop (Tauri + React)
```bash
cd desktop
npm install
npm run tauri dev
```

### Core (Rust)
```bash
cd core
cargo test
```

### Backend
```bash
cd backend
./gradlew bootRun
```

### Infrastructure
```bash
docker compose -f infra/docker-compose.yml up -d
```

## Code Style

- **TypeScript**: Strict mode, no `any` or `@ts-ignore`
- **Rust**: `cargo clippy` clean, no `unwrap()` in production code
- **Java**: Standard Spring conventions, no raw types
- **CSS**: Global styles in `globals.css`, no CSS-in-JS
- **i18n**: All user-facing strings must use `react-i18next` with keys in both `zh-CN.json` and `en-US.json`

## Pull Request Guidelines

- Keep PRs focused (one feature/fix per PR)
- Update CHANGELOG.md with your changes under [Unreleased]
- Ensure all CI checks pass
- Request review from a maintainer

## Project Structure

See [AGENTS.md](./AGENTS.md) and subdirectory `AGENTS.md` files for detailed project maps.
