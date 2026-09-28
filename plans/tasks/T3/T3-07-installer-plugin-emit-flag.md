---
id: T3-07
track: T3
title: Installer --emit plugin integration + preview support
status: done
depends_on: [T3-02, T3-03]
est_size: M
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: >-
  installer.test.js 47/47 incl. plugin emit copilot/codex repo dirs, user-scope
  fail-closed, uninstall isolation, foreign-content preservation, invalid emit
  rejection; cli.test.js 55/55 incl. --emit plugin preview (plugin dir paths +
  emit field + manual-activation warning) and unsupported --emit rejection;
  doctor.test.js 35/35 incl. plugin state lane + null install_root user-scope
  unsupported verdict; docs/workflows/install-guide.md emit-modes section;
  typecheck + lint + npm test + test:release green.
---

## Objective

Let the installer plan/apply plugin-bundle installs: `pairslash install <pack> --runtime X --emit plugin` produces a preview of plugin-layout file placement — preview-first as always.

**Superseded scope note:** the original objective also mentioned Copilot `enabledPlugins` settings merge. T3-01's accepted plugin-emission contract (decision: "settings writes / marketplace registration are out of scope — the installer must not edit runtime settings files; plugin install is previewed as a directory emission, never a silent settings mutation") supersedes that portion. No `settings.json`/`enabledPlugins` mutation is implemented; acceptance gates below were updated to match the contract.

## Context & sources

- Emitters produce plugin bundles after T3-02/T3-03; installer handles file-install targets (`.agents/skills`, `.github/skills`, `~/.copilot/skills`).
- Plugin placement: repo-scope runtime plugin dirs (`plugins/<pack-id>/`), per verified Codex (`plugins/<id>/.codex-plugin/plugin.json`) and Copilot (`plugin.json` at plugin root) layouts; see T3-01 research + `docs/architecture/plugin-emission-contract.md`.
- User-scope plugin activation stays with runtime commands (`codex plugin add`, Copilot plugin install flows) — PairSlash never executes them.

## Files touched

- `packages/core/spec-core/src/plugin-ir.ts` + `constants.ts` + `validate.ts` — `EMIT_MODES`, `normalizeEmitMode`, doctor-report validator relaxed for null `install_root` (plugin+user scope)
- `packages/runtimes/codex/adapter` + `packages/runtimes/copilot/adapter` — `resolvePluginRoot`/`resolvePluginInstallDir`
- `packages/tools/installer/src/index.ts` + `state.ts` — emit threading through plan/apply/uninstall, plugin install dirs, null-root fail-closed user scope, separate `*-plugin.json` state lane
- `packages/tools/cli/src/options.ts` + `internals.ts` + `bin/pairslash.ts` — `--emit skill|plugin` flag, handlers, help text
- `packages/tools/doctor/src/index.ts` — emit-aware probes, plugin state lane, unsupported verdict for user-scope plugin, null-root-safe checks
- `tests`: installer 47, cli 55, doctor 35 — plugin-mode coverage both lanes
- `docs/workflows/install-guide.md` — emit modes section

## Work steps (completed)

1. Wired `--emit plugin` through CLI → installer plan/apply/uninstall → doctor.
2. Plugin-mode plan places compiled bundle under runtime repo plugin dir (`plugins/<pack-id>/`); deterministic ops via existing preview/apply lifecycle.
3. User-scope plugin: `resolveInstallRootForEmit` returns `null`, probes mark `scope.user.plugin_scope` unsupported/blocking — fails closed, no runtime commands.
4. Uninstall removes PairSlash-owned plugin files + plugin state lane independently; foreign content preserved (coexist, never clobber).
5. Tests incl. foreign-file preservation, invalid emit rejection, default skill lane unchanged.
6. Docs + gates + test:release.

## Constraints (STRICT)

- MUST NOT execute runtime plugin commands (`codex plugin add`, `copilot plugin install`) — file-level operations only.
- MUST NOT mutate runtime settings (`settings.json`, `enabledPlugins`) — superseded by T3-01 contract; activation is the user's runtime command path, documented in install guide.
- MUST fail closed on unsupported emit values and unsupported user-scope plugin installs.
- Journal + rollback reuse existing mechanism; ownership preserved per-file.

## Acceptance gates

- [x] `--emit plugin` preview shows plugin-layout file placement (`plugins/<pack-id>/...`, `emit` field, manual-activation warning)
- [x] Apply installs plugin bundle under runtime plugin dir without touching settings files
- [x] Uninstall removes owned plugin footprint only (separate state lane; foreign files preserved)
- [x] Foreign-content coexistence + no clobber; user-scope plugin fails closed; invalid emit fails closed
- [x] Gates + test:release green

## Evidence recorded

- Preview JSON: `emit: "plugin"`, `state_path` `repo-codex_cli-plugin.json`, ops under `plugins/` (cli.test.js).
- Doctor: `install_root` = repo plugin dir (repo target) / `null` + `unsupported` verdict (user target).
- Round-trip install→uninstall tests both lanes.

## Rollback

`git revert` — flag-gated; `--emit` defaults to `skill`, unchanged default path.
