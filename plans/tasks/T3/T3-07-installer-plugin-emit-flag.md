---
id: T3-07
track: T3
title: Installer --emit plugin integration + preview support
status: todo
depends_on: [T3-02, T3-03]
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Let the installer plan/apply plugin-bundle installs: `pairslash install <pack> --runtime X --emit plugin` produces a preview of plugin-layout file placement (and, for Copilot, the `enabledPlugins` settings touch) — preview-first as always.

## Context & sources

- Emitters produce plugin bundles after T3-02/T3-03; installer currently handles file-install targets (`.agents/skills`, `.github/skills`, `~/.copilot/skills`).
- Copilot declarative enablement: `enabledPlugins` in `~/.copilot/settings.json` / `.github/copilot/settings.json` — touching user settings is higher-risk: MUST be previewed and MUST preserve existing settings (merge, not clobber).
- Codex plugins install via `codex plugin add`/marketplace — PairSlash's installer can't assume it manages plugin state through runtime commands; decide whether `--emit plugin` writes files only (repo-target) or wraps runtime commands (riskier). Recommend: file-placement only for repo targets + documented runtime command path for user-scope plugin installs.

## Files to touch

- `packages/tools/installer/src/` — emit-mode plumbing, settings-merge logic
- `packages/tools/cli/src/` — flag wiring (`--emit plugin`)
- `packages/tools/doctor/src/` — awareness of plugin-mode installs
- `tests/` — install/preview/uninstall plugin-mode coverage incl. settings-merge
- `docs/workflows/install-guide.md` — document the mode
- Do NOT touch: default install behavior, runtime command execution (installer MUST NOT shell out to `copilot plugin install` — file ops only)

## Work steps

1. Wire `--emit plugin` through CLI → installer plan.
2. Plugin-mode plan: emit bundle → place under the runtime's plugin discovery path (verify per-runtime repo-scope plugin dirs — likely `.github/plugins/` or the marketplace-installed layout; confirm via T3-01 research notes).
3. Copilot `enabledPlugins` merge: read existing settings.json, produce merged preview; on apply, write merged settings with ownership metadata; refuse to clobber (conflict → preview shows conflict, apply fails closed).
4. Uninstall: remove owned plugin footprint; restore prior `enabledPlugins` state (journaled).
5. Tests incl. merge-conflict fixture (existing enabledPlugins with foreign entries).
6. Docs + gates + test:release (installer surface).

## Constraints (STRICT)

- MUST preview settings edits — `enabledPlugins` merge shown as diff before apply (C.4).
- MUST NOT execute runtime plugin commands (`codex plugin add`, `copilot plugin install`) from the installer — file-level operations only; runtime-command path is documented for the user.
- MUST preserve unrelated user settings keys byte-identically (merge, not rewrite; verify with fixture diff).
- MUST fail closed on settings.json parse errors or ownership conflicts.
- Journal + rollback for settings edits (existing journal mechanism — reuse it).

## Acceptance gates

- [ ] `--emit plugin` preview shows file placement + settings diff
- [ ] Apply installs bundle + merges settings atomically
- [ ] Uninstall restores prior settings state
- [ ] Foreign-content conflict fails safe
- [ ] Gates + test:release green

## Evidence to record

- Preview output sample; settings-merge round-trip test results.

## Rollback

`git revert` — flag-gated.
