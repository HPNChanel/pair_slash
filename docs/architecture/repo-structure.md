# Repo Structure

PairSlash keeps one logical product surface while using a layered physical workspace:

- `packages/core/*`
  core contracts, schemas, policy, memory, and shared domain logic
- `packages/runtimes/codex/*`
  Codex-specific compiler and adapter surfaces
- `packages/runtimes/copilot/*`
  Copilot-specific compiler and adapter surfaces
- `packages/tools/*`
  CLI, installer, doctor, lint bridge, and compat lab
- `packs/core/*`
  canonical slash-first workflow source packs
- `tests/fixtures/phase5/*`
  runtime/policy/preview/contract fixtures for JS regression coverage
- `docs/examples/*`
  user-facing starter repos and walkthroughs
- `docs/archive/research/phase-3.5/*`
  archived research, benchmark, interview, and synthesis material kept for rationale

## Dependency rules

- `core/*` must not import `runtimes/*` or `tools/*`
- Codex runtime packages must not import Copilot runtime packages
- Copilot runtime packages must not import Codex runtime packages
- `tools/*` may depend on `core/*` and runtime packages when operationally required
- Cross-package relative imports are forbidden from `src/`; use declared package `exports` boundaries instead

These rules are enforced in `packages/tools/lint-bridge/`.

## Migration notes

- Physical package paths changed, but package names stay stable under `@pairslash/*`
- Root `schemas/`, `fixtures/`, `examples/`, `templates/`, and `research/` are no longer active source roots
- Phase 4 script aliases remain temporarily available:
  - `lint:phase4`
  - `test:phase4`
  - `test:phase4:acceptance`
  - `test:phase4:release`
- Canonical root commands are now:
  - `npm run lint`
  - `npm run test`
  - `npm run test:acceptance`
  - `npm run test:release`

## Node-only cleanup

- Removed the legacy Phase 2 validation scripts and their dedicated regression suite
- Ported or retained in Node:
  - project-memory structure and index validation in `packages/core/spec-core/src/project-memory.js`
  - dependency boundary enforcement in `packages/tools/lint-bridge/`
  - memory-write golden/preview/audit behavior in existing JS memory-engine and Phase 5 tests
