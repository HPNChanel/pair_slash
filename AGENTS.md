# Repository Guidelines

## Project Structure & Module Organization
PairSlash is a Node workspace monorepo with layered packages under `packages/`. Core logic lives in `packages/core/*`, runtime-specific packages live in `packages/runtimes/codex/*` and `packages/runtimes/copilot/*`, and operational surfaces live in `packages/tools/*`. Source packs live in `packs/`. Shared docs live in `docs/`. Root `tests/` contains JS regression checks, fixtures, and goldens; package-level tests live beside each package in `packages/*/*/tests`. Authoritative project memory and audit records live under `.pairslash/`.

## Build, Test, and Development Commands
Use Node `>=24.0.0` and `npm@11.7.0`.

- `npm install` installs workspace dependencies.
- `npm run pairslash -- doctor --runtime auto --target repo` runs the local CLI entrypoint.
- `npm run lint` runs the repo lint gate, including package boundary checks.
- `npm run test` runs the JS test suite.
- `npm run test:acceptance` runs acceptance-oriented checks.
- `npm run test:release` runs release-readiness validation.
- `npm run lint:phase4` / `npm run test:phase4` / related `phase4` aliases remain temporarily for migration-safe compatibility.

## Coding Style & Naming Conventions
Use ESM JavaScript with named exports and small focused modules. Follow the existing style: double quotes, semicolons, and 2-space indentation. Keep package names under `@pairslash/*`. Name tests `*.test.js`. Preserve deterministic output ordering in compiler, installer, lint, and doctor code. Do not introduce a third runtime or a non-canonical slash entrypoint; `/skills` remains the primary workflow surface.

## Testing Guidelines
Every behavior change should add or update tests in the touched package and, when relevant, a golden or fixture case. For install/update/uninstall/doctor work, cover both Codex and Copilot lanes when behavior diverges. Prefer smoke-sized tests that assert receipts, preview plans, ownership handling, and verdicts rather than only status codes.

## Commit & Pull Request Guidelines
Use concise Conventional Commit style already present in history: `feat(scope): ...`, `fix: ...`, `refactor: ...`, `chore: ...`. Keep each commit single-purpose. PRs should state the affected runtime lane (`codex`, `copilot`, or `shared`), scope (`repo` or `user`), commands run, and any preview/doctor/install output that proves behavior. Link the driving issue and call out risks to later phases if a Phase 4 contract changes.

## Safety & Architecture Notes
PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI. Global Project Memory is authoritative-first; read workflows must not write it. Environment-changing commands must support preview or dry-run, preserve valid local overrides, and remove only PairSlash-managed footprint on uninstall.
