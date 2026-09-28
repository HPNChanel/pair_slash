---
id: T4-01
track: T4
title: Hook emission model — write-authority preflight hooks (both runtimes)
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Design and implement hook emission for write-authority packs: preflight hooks that run verification/lint before the workflow's durable commit step, emitted in each runtime's native hook format.

## Context & sources

- Codex hooks (verified): `hooks.json` next to config layers OR inline `[hooks]` in `config.toml`; 12 lifecycle events (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, Interrupt, …); trust-by-hash review — unmanaged hooks skipped until trusted via `/hooks`; managed hooks via `requirements.toml`; kill switch `[features] hooks = false`.
- Copilot hooks: `hooks.json` in plugin root (plugin-model) — check current standalone `hooks.json` support in user/repo config during implementation.
- PairSlash side: Copilot compiler already emits `hooks/preflight.yaml` for write-authority/MCP packs (docs/runtime-mapping). Generalize into a deliberate model.
- Purpose boundary: hooks are **verify/lint/report** preflights — they may warn/block-before-commit semantics where the runtime supports it, but MUST NOT perform the memory write (C.3 — write authority stays in the workflow's explicit pipeline).

## Files to touch

- `packages/runtimes/codex/compiler/src/` — emit `hooks.json`/`[hooks]` fragment for write-authority packs
- `packages/runtimes/copilot/compiler/src/` — formalize preflight hook emission (plugin `hooks.json`)
- `packs/core/pairslash-memory-write-global/` — manifest `hooks` declaration if schema supports it (schema work may be needed — coordinate with T2-04's schema versioning)
- `tests/` — emission + content tests
- Do NOT touch: hook execution engines (runtimes own execution), managed-hooks/enterprise paths

## Work steps

1. Verify exact hook file schemas for both runtimes at current versions (event names, matcher syntax, command payload shape, timeout fields).
2. Extend manifest schema with optional `hooks` declaration (events, purpose=verify-only) — reuse T2-04's versioning discipline.
3. Emit preflight hook for write-authority packs: e.g., PostToolUse/Stop-time verify or PreToolUse gate — choose events whose semantics fit "check before durable commit" and are advisory where the runtime can't truly block.
4. Document trust-by-hash UX in emitted docs: unmanaged hooks appear for review; user must trust them (Codex `/hooks`).
5. Goldens + tests: emitted hook parses (schema-shape), event names valid, command references are repo-relative and safe.
6. Gates.

## Constraints (STRICT)

- MUST emit verify/report hooks only — NEVER a hook that writes `.pairslash/project-memory/` or auto-approves a preview (C.3).
- MUST document that Codex unmanaged hooks are skipped until trusted — emitted artifacts include a trust-review note; PairSlash must not try to pre-trust its own hooks (trust bypass = security violation).
- MUST handle `[features] hooks = false` / missing hook support — doctor surfaces "hooks unavailable" state (T4-06), emitted hooks degrade to documentation, not silent success.
- MUST NOT emit hooks that phone home, mutate git state, or run destructive commands — hook command allowlist: read, lint, report only.
- Hook commands MUST be deterministic, quoted-safe, and repo-relative.

## Acceptance gates

- [ ] Write-authority pack emits valid hook config on both runtimes
- [ ] Event names verified against current runtime schemas
- [ ] Lint/doctor awareness consistent (T4-06 coordination note)
- [ ] Gates green

## Evidence to record

- Emitted hook examples per runtime; verified event-name list with sources.

## Rollback

`git revert` — emission is additive; packs without `hooks` field unaffected.
