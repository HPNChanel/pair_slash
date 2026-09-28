# Track T3 — Distribution: plugins & marketplaces

**Status:** Done (2026-09-28) | **Priority:** P2 | **Depends on:** T2
**Goal:** Give PairSlash packs a second distribution form — runtime-native plugin bundles and marketplace manifests — while preserving `/skills` as the canonical *invocation* path and the existing direct skill install as the default.

## Context

Both runtimes now ship plugin ecosystems:
- **Codex**: `codex plugin` + `codex plugin marketplace` commands, `/plugins` browser, marketplace sources via GitHub shorthand/URLs/local dirs.
- **Copilot**: `plugin.json` manifest bundling `agents/`, `skills/`, `hooks.json`, `.mcp.json`, `lsp.json`; default marketplaces `copilot-plugins` + `awesome-copilot`; declarative `enabledPlugins` in settings.json; `gh skill` publishes spec-valid skills via GitHub releases.

This changes *distribution*, not *invocation* (C.2). It also opens a path where PairSlash's own packs could be published as a marketplace — a gated decision, not a done deal.

## Entry gate

- T2 done (emitters produce spec-valid artifacts — plugin bundles wrap those artifacts).

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T3-01 | Design `plugin.json` emission contract (schema + mapping from pack.manifest) | — |
| T3-02 | Copilot plugin bundle compiler output (`--emit plugin`) | T3-01 |
| T3-03 | Codex plugin bundle format + marketplace manifest emission | T3-01 |
| T3-04 | `gh skill publish` readiness gate (spec validation + release packaging) | T3-02 |
| T3-05 | PairSlash marketplace strategy decision record | T3-02, T3-03 |
| T3-06 | Legal/packaging docs update for plugin distribution | T3-05 |
| T3-07 | Installer `--emit plugin` integration + preview support | T3-02, T3-03 |

## Exit gate

- A core pack compiles to a valid Copilot `plugin.json` bundle and a Codex plugin layout — verified by deterministic tests + goldens (no live install claim without evidence).
- `gh skill publish --dry-run` (or equivalent validation) passes for emitted skills where the toolchain is available.
- Marketplace strategy documented as ADR/decision record — `adopt`, `defer`, or `reject` with reasons.
- CONSTRAINTS C.2 preserved: docs clearly label plugins as distribution; `/skills` canonical language untouched.

## Risks

- Bundle formats drift between runtime versions → emitters must pin the *verified* format version and fail closed on mismatch.
- Marketplace submission implies public-claim surface — stays behind T7 publish gating; T3 produces *capability*, not publication.
- Ownership/uninstall semantics differ for plugin installs vs file installs — installer must track `install_mode` in receipts.
