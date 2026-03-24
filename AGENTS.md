# Repository Guidelines

## Project Structure & Module Organization
PairSlash is a Node workspace monorepo with Phase 4 runtime-native installability work in `packages/`. Core packages include `cli`, `spec-core`, `compiler-codex`, `compiler-copilot`, `installer`, `doctor`, `compat-lab`, and runtime adapters. Source packs live in `packs/`. Shared docs live in `docs/`. Root `tests/` contains Python regression checks and golden fixtures; package-level tests live beside each package in `packages/*/tests`. Authoritative project memory and audit records live under `.pairslash/`.

## Build, Test, and Development Commands
Use Node `>=24.0.0` and `npm@11.7.0`.

- `npm install` installs workspace dependencies.
- `npm run pairslash -- doctor --runtime auto --target repo` runs the local CLI entrypoint.
- `npm run lint:phase4` runs the Phase 4 bridge lint gate.
- `npm run test:phase4` runs the Phase 4 JS test suite.
- `python scripts/phase2_checks.py --all` runs legacy Phase 2 repository checks.
- `python -m unittest discover -s tests -p "test_*.py"` runs Python regression tests.

## Coding Style & Naming Conventions
Use ESM JavaScript with named exports and small focused modules. Follow the existing style: double quotes, semicolons, and 2-space indentation. Keep package names under `@pairslash/*`. Name tests `*.test.js`; name Python tests `test_*.py`. Preserve deterministic output ordering in compiler, installer, lint, and doctor code. Do not introduce a third runtime or a non-canonical slash entrypoint; `/skills` remains the primary workflow surface.

## Testing Guidelines
Every behavior change should add or update tests in the touched package and, when relevant, a golden or fixture case. For install/update/uninstall/doctor work, cover both Codex and Copilot lanes when behavior diverges. Prefer smoke-sized tests that assert receipts, preview plans, ownership handling, and verdicts rather than only status codes.

## Commit & Pull Request Guidelines
Use concise Conventional Commit style already present in history: `feat(scope): ...`, `fix: ...`, `refactor: ...`, `chore: ...`. Keep each commit single-purpose. PRs should state the affected runtime lane (`codex`, `copilot`, or `shared`), scope (`repo` or `user`), commands run, and any preview/doctor/install output that proves behavior. Link the driving issue and call out risks to later phases if a Phase 4 contract changes.

## Safety & Architecture Notes
PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI. Global Project Memory is authoritative-first; read workflows must not write it. Environment-changing commands must support preview or dry-run, preserve valid local overrides, and remove only PairSlash-managed footprint on uninstall.
