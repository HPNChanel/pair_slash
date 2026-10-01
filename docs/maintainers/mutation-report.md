# Mutation Testing Pilot (Report-Only)

Scope: `packages/core/memory-engine/src/**` only. The runner lives at
`tests/mutation/run-mutation.mjs` and runs in the `compat-lab-nightly`
workflow (`nightly-mutation` job), which uploads
`artifacts/mutation-memory-engine.json`.

This pilot is **report-only**. The mutation score is a review signal and
never gates CI, and mutants are never committed — each one is applied in
place, the package test file runs against it, and the pristine source is
restored immediately (also on crash via an exit hook).

## Reading the report

- `site_count` — total deterministic mutation sites found.
- `mutants_run` / `truncated_sites` — how many ran vs the `--max-mutants` cap.
- `totals.killed` — the suite failed the mutant: the behavior is covered.
- `totals.survived` — the suite passed with the mutation: a test gap worth a
  follow-up hardening task.
- `totals.timeout` — suite did not finish in time; counted as killed in the
  score (the suite did terminate the mutant).
- `totals.error` — mutant did not parse/run; excluded from the score
  denominator (honest accounting, not silently counted either way).
- `score` — `(killed + timeout) / (mutants_run - error)`.

## Interpreting survivors

A survivor is not automatically a bug — it means no existing test would fail
if that condition flipped. Useful follow-ups: pin an assertion for the branch,
or record the line as accepted risk if it is genuinely unobservable (for
example a defensive `|| true` on an already-guarded path). Do not weaken a
test to kill a mutant; that games the score, which is expressly disallowed
(project rule C.10).

## Running locally

```bash
npm run test:mutation                      # full pilot (bounded by --max-mutants)
node tests/mutation/run-mutation.mjs --list            # enumerate sites only
node tests/mutation/run-mutation.mjs --max-mutants 25  # bounded run
node tests/mutation/run-mutation.mjs --report-out artifacts/mutation.json
```

## Why not Stryker

Stryker was evaluated first. This repo runs `.ts` via Node type-stripping and
links workspaces with `file:` deps, so a Stryker sandbox would need either a
node_modules copy or `npm ci` per sandbox — disproportionately heavy for a
report-only pilot — and Stryker has no first-class `node:test` runner for
this layout. The in-repo runner is the minimal viable alternative. Revisit
Stryker if the pilot graduates to a real gate.
