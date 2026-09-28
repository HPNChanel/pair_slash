---
id: T9-04
track: T9
title: Fuzz harness for memory-engine conflict detection (nightly)
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Add a property-based fuzz harness over memory-engine's conflict/duplicate detection — generating adversarial record inputs nightly to find cases hand-written tests missed.

## Context & sources

- Conflict detection decides whether a write collides (append/supersede/reject) — edge cases (unicode, huge statements, malformed scope, near-duplicate records) are exactly where property testing shines.
- Tooling: `fast-check` (standard JS property-testing lib) or equivalent; G9 review applies.
- Invariants to fuzz: (a) conflict detection never throws on arbitrary input (fail-closed error instead), (b) identical records → duplicate detected deterministically, (c) detection result is deterministic across runs (same corpus → same verdict), (d) supersede chains don't produce orphan states.

## Files to touch

- `tests/fuzz/` or `packages/core/memory-engine/tests/fuzz/` — harness + corpus
- `package.json` devDeps — fast-check (G9)
- `.github/workflows/compat-lab-nightly.yml` — fuzz job
- Do NOT touch: conflict-detection implementation (bugs found → separate fix tasks per X3), PR gates

## Work steps

1. Add fast-check; write property tests for the invariants above.
2. Deterministic seeding for reproducibility + corpus persistence for interesting failures.
3. Nightly job; failure → report artifact + issue-worthy finding (not silent).
4. If pilot immediately finds a real bug → file as its own task; don't ship the fix inside this task unless trivial (X3).
5. Gates (`npm run test` must not include the fuzz suite — nightly only).

## Constraints (STRICT)

- MUST be nightly-only — fuzz timing is unbounded by nature; never in PR gates.
- MUST use seeded/deterministic replay — a fuzz failure without a reproducible seed is useless.
- MUST treat detector-throws as failures — graceful-error paths exist for a reason; an unhandled throw is a real finding.
- MUST NOT weaken conflict-detection semantics to pass the fuzzer.
- Property invariants must be TRUE invariants — write only assertions that must always hold.

## Acceptance gates

- [ ] Harness runs nightly with seed persistence
- [ ] Property tests green (or real bugs filed as separate tasks)
- [ ] `npm run test` unaffected

## Evidence to record

- Invariant list; first-run results; corpus location.

## Rollback

`git revert` — additive suite.
