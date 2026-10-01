# Conflict-Detection Fuzz Harness (Nightly-Only)

Scope: `packages/core/memory-engine/src/conflict.ts` only. The harness lives
at `tests/fuzz/run-fuzz.mjs` and runs in the `compat-lab-nightly` workflow
(`nightly-fuzz` job, `--runs 500`), which uploads
`artifacts/fuzz-memory-conflict.json` plus the corpus directory.

The harness uses `fast-check` (property-based testing) to generate hostile
record/entry inputs — null-prototype objects, wrong types, huge strings,
missing fields — and asserts the conflict-detection invariants:

- `detectors-never-throw` — every detector returns fail-closed output on
  arbitrary input; a thrown exception is a finding.
- `identical-record-is-duplicate` — an exact copy of an authoritative record
  is always reported by `detectDuplicates` (record equality is `===`-based,
  so `NaN`-valued `kind`/`scope` fields are excluded).
- `detectors-are-deterministic` — the same corpus and input always produce
  the same result.
- `supersede-target-never-orphans` — `findSupersedeTarget` returns a member
  of the existing set with layer `global-project-memory`, or `undefined`.

## Running locally

```bash
npm run test:fuzz                            # default seed, 200 runs/property
node tests/fuzz/run-fuzz.mjs --seed 1234 --runs 500
node tests/fuzz/run-fuzz.mjs --corpus-only   # replay committed corpus only
node --test tests/fuzz/run-fuzz.test.js      # bounded smoke (report shape + corpus replay)
```

`tests/fuzz/run-fuzz.test.js` is intentionally **not** registered in
`scripts/run-compat-lab-tests.mjs` — the task constraint keeps all fuzz work
out of `npm test` and PR gates. Run it manually when touching the harness.

## Findings and corpus

Every failing property persists a corpus file under `tests/fuzz/corpus/`
(`<property>-<seed>-<digest>.json`). The seed is the replay mechanism — the
stored counterexample is a human-readable approximation (JSON cannot encode
`undefined`/`NaN`). Committed corpus seeds are replayed on every run before
new exploration, so a past failure becomes a permanent regression check.

A finding fails the nightly job and must not be silently absorbed: fix the
detector (preferred), or if the invariant is genuinely out of scope, narrow
the generator with `fc.pre` and record the reasoning in the finding.

The 2026-10 pilot found and fixed a real defect class: `normalizeText`,
`buildRecordId`, and `summarizeEntry` threw `TypeError` on null-prototype
objects and non-string `file` values (`String()` / `.replace` on values with
no primitive conversion). Those paths are now hardened via
`safeScalarString`, and regression tests cover them.

## Boundaries

- Nightly-only — never part of `npm test` or PR gates.
- The harness never mutates memory-engine source or writes outside
  `tests/fuzz/corpus/` and the report artifact.
- Detectors' semantics are not weakened to make properties pass.
