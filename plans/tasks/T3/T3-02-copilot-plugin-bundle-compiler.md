---
id: T3-02
track: T3
title: Copilot plugin bundle compiler output
status: todo
depends_on: [T3-01]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Implement Copilot plugin-bundle emission in the Copilot compiler: a pack compiles to a `plugin.json` + `skills/<name>/SKILL.md` (+ hooks.json/.mcp.json when declared) directory layout, selectable via a `--emit plugin` style option.

## Context & sources

- Contract: output of T3-01.
- Copilot plugin layout (verified): `plugin.json` root manifest; `agents/*.agent.md`; `skills/<name>/SKILL.md`; `hooks.json`; `.mcp.json`; `lsp.json`; `extensions/` (not in scope).
- Existing compiler emits `copilot-package-bundle` w/ skill dir + `package/pairslash-bundle.json` + `agents/` + `hooks/` + `mcp/` sidecars + `pairslash.install.json`. The plugin emit is a *bundle variant* — reuse asset generation, change the wrapper.
- `enabledPlugins` declarative enablement (CP-03) — installer integration is T3-07; emitter only produces the bundle.

## Files to touch

- `packages/runtimes/copilot/compiler/src/` — new emit mode
- `tests/golden/` + `tests/contracts/` — plugin-bundle goldens
- Possibly `packages/tools/installer/src/` — only the plan-level awareness of plugin bundles (apply path is T3-07)
- Do NOT touch: codex compiler (T3-03), default emit behavior

## Work steps

1. Add emit-mode selection to the copilot compiler API (default stays current bundle shape; `plugin` opt-in).
2. Emit `plugin.json` from contract mapping; wrap skill output under `skills/<pack>/`; map declared hooks → `hooks.json`; declared MCP → `.mcp.json`; agents only when T4-03 enables them (not this task — emit empty/absent).
3. Keep `pairslash.*` provenance metadata inside plugin.json `metadata` or sidecar per contract.
4. Goldens for: minimal pack, pack-with-hooks, pack-with-mcp, write-authority pack (preflight hook shape per T4-01 if available — else note the ordering dependency).
5. Test: emitted plugin.json validates against the contract schema; deterministic byte-stable output.
6. Gates.

## Constraints (STRICT)

- MUST NOT change default emit output — plugin mode is opt-in.
- MUST NOT emit `agents/` entries for write-authority packs (charter §13.3 hard rule).
- MUST produce deterministic output (G8): sorted keys, stable layout.
- MUST fail closed when the pack declares capabilities without a plugin-shape mapping (e.g., unsupported asset kind → explicit error, not silent drop).
- Emitted bundle MUST be reviewable: human-readable, diffable (C.7).

## Acceptance gates

- [ ] Plugin emit mode works for all core packs in fixture tests
- [ ] plugin.json validates against T3-01 contract schema
- [ ] Golden diffs show expected bundle structure
- [ ] Gates green

## Evidence to record

- Sample emitted bundle tree in commit body; golden files list.

## Rollback

`git revert` — opt-in emit mode is additive.
