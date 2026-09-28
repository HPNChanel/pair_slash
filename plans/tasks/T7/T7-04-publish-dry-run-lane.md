---
id: T7-04
track: T7
title: npm publish --dry-run CI lane + publication-readiness checklist
status: todo
depends_on: [T7-02, T7-03]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Add a `publish --dry-run` smoke step to the release-trust-candidate lane and write `docs/releases/publication-readiness-checklist.md` recording the exact conditions under which posture may flip.

## Context & sources

- `release-trust-candidate.yml` is the right lane (protected, evidence-producing).
- Checklist must encode the gate chain: T6 R1+R2+R3 GO + legal sign-off + scoped-release GO + T7 infra green — flipping `private` is one commit after that, never before.
- Dry-run verifies manifest publishability (files, bin, pack contents) without touching the registry.

## Files to touch

- `.github/workflows/release-trust-candidate.yml` — dry-run step (env-gated so it only runs where publish context exists; must not require secrets)
- `docs/releases/publication-readiness-checklist.md` — new
- Do NOT touch: `private` flags, actual publish commands (none exist — dry-run only)

## Work steps

1. Add the dry-run step: `npm publish --dry-run` (with `PAIRSLASH_PUBLISH_READY` gate per T7-01 design — decide: the dry-run should run WITHOUT the env flag to validate the artifact, or behind it to validate the gate? Prefer without — dry-run is harmless and tests the artifact; the env gate protects real `publish` only).
2. Write the checklist: gate conditions, flip procedure (single commit flipping `private`+`publishConfig.access`), rollback notes.
3. Gates; commit.

## Constraints (STRICT)

- MUST be dry-run only — no credential-dependent publish step anywhere.
- MUST NOT weaken REQUIRE_SIGNED or add soft-skip paths to the lane.
- Checklist MUST name the exact evidence each flip condition requires (files, not vibes).
- MUST NOT add npm tokens/secrets references beyond naming the secret slot that would be used later.

## Acceptance gates

- [ ] Dry-run step green on a candidate run (or verified locally if lane needs protected secrets)
- [ ] Checklist written + referenced from legal-packaging doc
- [ ] Gates green

## Evidence to record

- Dry-run output; checklist path.

## Rollback

`git revert`.
