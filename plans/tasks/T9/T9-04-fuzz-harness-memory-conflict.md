---
id: T9-04
track: T9
title: Fuzz harness for memory-engine conflict detection (nightly)
status: done
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-10-01
completed_at: 2026-10-01
evidence: |
  tests/fuzz/run-fuzz.mjs property-tests all six conflict/duplicate
  detectors in packages/core/memory-engine/src/conflict.ts using
  fast-check@4.10.2 (MIT, published 2026-09-19 — G9 review satisfied;
  pinned ^4.10.2 devDep). Invariants: (a) detectors never throw on
  arbitrary input — hostile scalars, null-prototype objects, wrong
  types, missing fields; (b) identical authoritative record is always
  reported as duplicate (record equality is ===-based, so NaN
  kind/scope is excluded via fc.pre); (c) deterministic results for
  identical corpus+seed; (d) findSupersedeTarget never returns an
  orphan/non-global target.
  First-run findings (seed 20261001): the pilot found a REAL defect —
  normalizeText, buildRecordId, and summarizeEntry threw TypeError on
  null-prototype objects and non-string file values, so malformed
  entries could crash conflict detection instead of failing closed.
  Fixed in this task (trivial, per X3): new safeScalarString helper in
  internal.ts, guards in conflict.ts predicates/summarizeEntry/sort,
  plus regression tests in memory-engine.test.js. Corpus persisted to
  tests/fuzz/corpus/ (3 seed files) and replays green after the fix.
  Post-fix run: all 4 properties pass at 200 runs/property (nightly CI
  uses --runs 500). Wired as nightly-fuzz job in
  compat-lab-nightly.yml — a finding exits non-zero so it stays
  visible, and artifacts/fuzz-memory-conflict.json + corpus upload.
  tests/fuzz/run-fuzz.test.js is deliberately NOT registered in
  run-compat-lab-tests.mjs: the constraint keeps all fuzz work out of
  npm test / PR gates; run it manually when touching the harness.
  Docs: docs/maintainers/fuzz-report.md. Gates: typecheck, lint,
  npm test (all suites incl. memory-engine 13/13), test:release green;
  build-cache sweep runs at suite end per repo rule.
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

- [x] Harness runs nightly with seed persistence
- [x] Property tests green (or real bugs filed as separate tasks)
- [x] `npm run test` unaffected

## Evidence to record

- Invariant list; first-run results; corpus location.

## Rollback

`git revert` — additive suite.
