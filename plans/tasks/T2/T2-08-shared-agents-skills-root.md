---
id: T2-08
track: T2
title: Shared .agents/skills repo-root feasibility + installer flag
status: done
depends_on: [T2-01]
est_size: M
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence: >
  Implemented --skill-root {runtime-default, shared-agents} end-to-end
  (spec-core constants/normalize, both adapters, installer state/plan/apply/
  update/uninstall/journal, CLI flag + usage, doctor check
  install_state.shared_skill_root with fail-closed floor warning).
  Copilot .agents/skills floor verified at >=1.0.11 via github/copilot-cli
  changelog v1.0.11 (2026-03-23: ".agents/skills auto-loading" +
  "~/.agents/skills personal"). Codex floor 0.0.0 (native .agents scan).
  Tests: adapters path resolution + invalid rejection; installer shared-root
  install/uninstall/state separation/foreign-file preservation/invalid root;
  CLI flag parsing + preview plan.skill_root; doctor floor pass/warn +
  state-path separation. Gates: typecheck, lint, npm test (0 fail),
  test:release, test:compat all green; goldens resynced.
---

## Objective

Evaluate and (if sound) implement an opt-in installer path targeting `.agents/skills/` as the shared repo-level skill root for both runtimes — Codex scans it natively, Copilot added project-level scan support (CP-11).

## Context & sources

- Codex: `.agents/skills` scanned from cwd up to repo root (CX-05) — current PairSlash `repo` target for Codex.
- Copilot: `.github/skills`, `.claude/skills`, `.agents/skills` project dirs; `~/.copilot/skills`, `~/.agents/skills` personal (CP-11; `.agents` personal fix v1.0.11) — current PairSlash `user` target is `~/.copilot/skills`.
- Opportunity: a single repo-target root `.agents/skills` serves both runtimes → one install, cross-runtime discovery. Risks: Copilot version floor for `.agents` scan (needs ≥1.0.11), ownership collisions, uninstall footprints differ per runtime.

## Files to touch

- `packages/tools/installer/src/` — install-target resolution (`repo`/`user`), add `--skill-root` or target variant
- `packages/runtimes/*/adapter/src/` — install-root descriptors
- `packages/tools/doctor/src/` — detection for shared-root presence + version-floor checks
- `tests/` — install/preview/uninstall coverage for the new target
- `docs/runtime-mapping/*.md`, install docs — document the opt-in path
- Do NOT touch: default target mapping (opt-in only), lane claims

## Work steps

1. Verify Copilot `.agents/skills` project-scan floor (which version — ≥1.0.11) and Codex behavior; record in findings.
2. Design: `--skill-root shared-agents` (name TBD) as an opt-in install target variant; orthogonality with `repo`/`user` targets resolved explicitly in code + docs.
3. Implement: installer resolves shared root → `.agents/skills/<pack>/` for repo-target on both runtimes; ownership receipts record `skill_root`; uninstall removes only owned footprint.
4. Doctor: detect presence + runtime floor compatibility (warn when Copilot <1.0.11 with shared root installed).
5. Tests: install/preview/uninstall on shared root both runtimes; conflict case (existing non-PairSlash content under `.agents/skills`) must not be clobbered.
6. Docs update; gates.

## Constraints (STRICT)

- MUST be opt-in — the default install target mapping is unchanged.
- MUST NOT clobber non-PairSlash-managed files in `.agents/skills/` — ownership receipts gate all writes/removals (C.4, uninstall boundary).
- MUST NOT change lane support claims — this is an install-path option; claims stay evidence-bound.
- Version floor: doctor MUST warn when the runtime doesn't support the chosen root — fail-closed on ambiguity.
- Preview MUST show the target root clearly.

## Acceptance gates

- [ ] Shared-root install preview/apply/uninstall works on fixtures for both runtimes
- [ ] Conflict case (foreign content) fails safe
- [ ] Doctor floor-warning correct
- [ ] Gates green

## Evidence to record

- Floor versions verified (with source); install-plan diff example in commit body.

## Rollback

`git revert` — flag-gated path; defaults untouched.
