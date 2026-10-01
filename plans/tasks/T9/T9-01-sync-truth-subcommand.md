---
id: T9-01
track: T9
title: pairslash sync-truth subcommand — preview-first multi-file promotion
status: done
depends_on: []
est_size: L
claimed_by: devin
claimed_at: 2026-10-01
completed_at: 2026-10-01
evidence: |
  Implemented in packages/tools/compat-lab/src/truth-sync.ts (planTruthSync /
  applyTruthSync) wired through the CLI as `pairslash sync-truth` with preview
  as the default and `--apply` requiring confirmation (or --yes).
  - Multi-file op set: lane record (surgical YAML patch preserving hand
    formatting), runtime-surface-matrix.yaml regen, compatibility-matrix.md
    regen via matrix.ts snapshot override, pack manifest live_workflow_refs,
    runtime-verification.md promotion log, audit entry, transaction journal.
  - Fail-closed: invalid evidence class, evidence downgrade, lane identity
    mismatch, ladder skips, and promotion-rule violations all produce
    non-ok plans with reason strings; apply revalidates via
    loadPublicSupportSnapshot and rolls back every write on failure
    (including deleting newly created files on rollback).
  - Tests: packages/tools/compat-lab/tests/truth-sync.test.js (9/9) and
    packages/tools/cli/tests/cli.test.js sync-truth cases (4) covering
    preview-only, apply+commit+journal+audit, confirmation refusal,
    ladder-skip, policy gate, and full rollback.
  - Gates: npm run typecheck (strict) green, npm run lint green, npm test
    green, npm run test:release green.
  - Docs: CONTRIBUTING.md documents the sync-truth vs sync:compat-lab
    boundary and the build-cache cleanup commands.
---

## Objective

Implement `pairslash sync-truth --lane <id> --bump-evidence <class>` — one command that computes the multi-file truth update (matrix YAML, lane record, regenerated matrix.md, affected pack manifest evidence refs) and applies it only through preview → accept, eliminating the manual 5–7-file sync.

## Context & sources

- Every evidence promotion currently hand-edits ~5 files — error-prone, and T1 just experienced it.
- Preview-first per charter (C.4); atomic apply per installer journal conventions.
- Files in the sync set: `runtime-surface-matrix.yaml`, `docs/compatibility/compatibility-matrix.md` (regen), `docs/evidence/live-runtime/<lane>.{md,yaml}`, `packs/core/*/pack.manifest.yaml` `workflow_evidence.live_workflow_refs` where affected, `runtime-verification.md` notes.
- Naming check from July plan: `sync-truth` must not collide with `sync:compat-lab` semantics — `sync:compat-lab` regenerates artifacts; `sync-truth` promotes evidence + regenerates. Distinct verbs, document the boundary.

## Files to touch

- `packages/tools/cli/src/` — subcommand + handler
- Possibly `packages/tools/installer/src/` or a new `packages/tools/truth-sync/` if the logic is substantial (prefer existing package boundary rules — check where multi-file truth edits belong; compat-lab already knows the sync set)
- `tests/` — sync preview/apply coverage incl. partial-failure rollback
- `docs/` — command documentation
- Do NOT touch: the truth files' semantics, evidence policy rules

## Work steps

1. Design the operation model: inputs (lane id, new evidence class/level, evidence refs) → computed file edits (structured ops, not freeform) → preview patch (unified diff) → accept → journaled apply.
2. Validation: refuse invalid promotions (e.g., skipping claim-ladder levels: `prep`→`stable-tested` must fail closed); enforce evidence-policy rules (e.g., `live_verification` requires lane record refs present).
3. Implement preview renderer producing real diffs of every touched file.
4. Implement apply with journal + rollback on partial failure (all-or-nothing).
5. Tests: valid promotion, invalid ladder-skip (deny), missing evidence refs (fail closed), atomic rollback, regeneration consistency.
6. Docs + gates + test:release (truth-touching).

## Constraints (STRICT)

- MUST preview before apply — no direct-write mode (C.4 absolute).
- MUST enforce the claim ladder — a requested promotion that skips levels fails closed with reason.
- MUST be atomic — partial truth updates are worse than none (a matrix saying `preview` while the lane record says `prep` is a truth violation).
- MUST regenerate derived artifacts as part of the same operation — never leave stale renderings.
- MUST append an audit/trail entry recording what was promoted, by whom, evidence refs (C.9).
- MUST NOT bypass evidence-policy rules — the tool enforces them, it can't override them.

## Acceptance gates

- [ ] `--preview` produces correct multi-file diff for a fixture lane bump
- [ ] `--apply` writes atomically + journals + regenerates
- [ ] Ladder-skip attempt fails closed
- [ ] Gates green incl. test:release

## Evidence to record

- Preview/apply transcript on fixture; command docs path.

## Rollback

`git revert` — new subcommand is additive.
