# PairSlash Phase 4 Entry Gates

Date: 2026-03-25
Status: recommended pre-entry gate for broader Phase 4 claims

This document defines what must be true before PairSlash should be treated as
ready to move beyond Phase 3.5 validation.

Important distinction:

- Phase 4 code already exists in the repo.
- These gates are about whether broader Phase 4 product and distribution claims
  are justified.

## What Must Be True Before Phase 4 Starts

All of the following must be true:

1. `docs/validation/phase-3-5/verdict.md` no longer remains `Gate status: NO-GO`.
2. `docs/validation/phase-3-5/evidence-log.md` contains recorded benchmark
   runs, not just a template.
3. All official benchmark tasks `B1-B5` are executed and scored.
4. `B3` explicit memory write preview succeeds on Codex CLI and GitHub Copilot
   CLI.
5. `B4` guardrail rejection under weak or conflicting evidence succeeds on both
   runtimes.
6. The benchmark pass rule in `docs/validation/phase-3-5/scoring-rubric.md`
   is met.
7. At least two runs record a credible positive answer to "Would you come back
   next week for the same job?"
8. One winning wedge is clear enough to guide the next stage.
9. Messaging remains scoped to validated pain, validated runtime lanes, and
   the trust-layer thesis.

## What Can Remain Imperfect

These do not need to be perfect before the gate flips:

- P2 and P3 segment evidence can lag behind P1 if P1 is strongly validated.
- Supporting workflows can remain unvalidated if the core wedge is proven.
- Install and doctor polish can keep improving after the wedge is validated.
- Demo scripting can keep evolving after the core evidence is in place.
- Sample size can still be modest if the evidence is mixed, concrete, and
  consistent.

## What Is Dangerous To Ignore

These are phase-entry killers even if the docs look strong:

- no manual baseline for comparison
- no repeat-intent proof
- empty or selective benchmark logging
- memory preview or rejection flows that do not materially increase trust
- architecture maturity mistaken for demand
- runtime or release-readiness claims outrunning recorded evidence
- any drift toward generic framework, autopilot, or third-runtime positioning

## Current Status

Current status on 2026-03-25: gates not met.

Main blockers:

- official verdict still `NO-GO`
- official evidence log still empty
- no scored benchmark set
- no two-runtime proof for the safe-memory-write wedge
- no credible repeated-weekly-use evidence
