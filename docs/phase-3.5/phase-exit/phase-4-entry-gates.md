# PairSlash Product-Validation Entry Gates

Date: 2026-03-31
Status: active gate for moving beyond the current product-validation phase

Important distinction:

- PairSlash already has broader technical surfaces in the repo.
- These gates are about whether broader product claims are justified.
- A scoped release/installability `GO` does not satisfy these gates by itself.

## What must be true before broader claims

All of the following must be true:

1. `docs/validation/phase-3-5/evidence-log.md` contains official product
   benchmark runs under the current schema.
2. `W1` onboarding has at least one official paired run on Codex CLI and one on
   GitHub Copilot CLI.
3. `W2a` memory happy path passes on both runtimes.
4. `W2b` memory rejection path passes on both runtimes.
5. `W3` review/fix loop has at least one official paired run on the primary
   runtime.
6. `Trusted Weekly Reuse Rate >= 60%` overall.
7. Onboarding and memory each maintain a `>= 50%` trusted reuse floor.
8. Task success without manual rescue is `>= 70%`.
9. Memory trust-boundary integrity is `100%`.
10. Preview-to-write fidelity is `100%`.
11. Evidence completeness is `100%`.
12. `review/fix loop` is not the only workflow showing a win.

## What can remain imperfect

These do not need to be perfect before the gate flips:

- review/fix can still be early as long as it is not driving the thesis
- sample size can remain modest if the evidence is concrete and complete
- install and doctor polish can continue improving after the product wedge is
  proven
- supporting workflows can remain unvalidated if the must-win workflows are
  proven

## What is dangerous to ignore

These are gate killers even if the docs look stronger:

- no raw CLI baseline for comparison
- installability evidence counted as wedge proof
- selective logging or missing negative runs
- memory preview or rejection flows that do not materially increase trust
- architecture maturity mistaken for demand
- `review/fix loop` drifting toward a generic copilot story

## Current status

Current status on 2026-03-31: gates not met.

Main blockers:

- no official runs logged under the new benchmark system
- no onboarding evidence on either runtime
- no official memory happy-path or rejection-path evidence on either runtime
- no measured north-star value
- no workflow-floor evidence for onboarding or memory
