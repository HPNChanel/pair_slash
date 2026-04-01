# Reality Scan

Phase 9 now has a first-wave proof-asset scaffold in-repo with explicit
separation between measured evidence, anecdotal notes, and not-yet-validated
examples.

No benchmark outcomes were added.
All first-wave case-study assets remain `evidence_status: not-measured`.

# Decisions

## Created files

- `examples/README.md`
- `docs/benchmarks/README.md`
- `docs/case-studies/README.md`
- `docs/case-studies/onboard-repo-before-after.md`
- `docs/case-studies/memory-write-global-trust-event.md`
- `docs/case-studies/failure-mode-runtime-mismatch.md`
- `docs/phase-9/proof-assets-implementation-summary.md`

## Patched files

- `README.md`
- `docs/phase-9/examples-and-benchmarks.md`
- `docs/phase-9/onboarding-path.md`
- `docs/workflows/install-guide.md`
- `docs/workflows/phase-4-quickstart.md`

## Linked entry points

- Root README entry links now include:
  - `docs/phase-9/examples-and-benchmarks.md`
  - `examples/README.md`
  - `docs/benchmarks/README.md`
  - `docs/case-studies/README.md`
- Phase 9 proof plan now links to implemented scaffold paths.
- Onboarding docs now link to benchmark and case-study placeholders.

# File/Path Plan

## Evidence placeholders still empty

The following files are intentionally empty of measured values and keep explicit
slots for future measurement:

- `docs/case-studies/onboard-repo-before-after.md`
  - missing paired run IDs
  - missing TTFS fields
  - missing artifact refs
- `docs/case-studies/memory-write-global-trust-event.md`
  - missing trust-boundary and fidelity results
  - missing preview/write/audit/index artifact refs
- `docs/case-studies/failure-mode-runtime-mismatch.md`
  - missing doctor/support capture metrics
  - missing redaction and shareability results

## Measurement instrumentation still missing

- No official run entries appended yet to
  `docs/validation/phase-3-5/evidence-log.md`.
- No benchmark summary documents yet under a dedicated
  `docs/evidence/benchmarks/` home.
- No live runtime capture index yet under a dedicated
  `docs/evidence/live-runtime/` home.
- No standardized artifact naming convention defined yet for pairing case-study
  refs with support bundle and trace export outputs.

# Risks / Bugs / Drift

- Duplicate examples surface now exists:
  - `docs/examples/` (existing documentation-oriented examples)
  - `examples/README.md` (new Phase 9 public index)
- This is intentional for first-wave discoverability but may become confusing if
  ownership rules are not kept explicit.
- Benchmark and case-study placeholders can be misread as evidence if
  `evidence_status` labels are removed or edited casually.

# Acceptance Checklist

- `examples/README.md` created.
- `docs/benchmarks/README.md` created.
- `docs/case-studies/README.md` created.
- Three first-wave case-study placeholder files created.
- Cross-links added from README, Phase 9 proof plan, and onboarding docs.
- No fabricated benchmark outcomes added.

# Next Handoff

1. Run the first official onboarding paired benchmark and fill
   `docs/case-studies/onboard-repo-before-after.md`.
2. Run memory happy-path benchmark and fill
   `docs/case-studies/memory-write-global-trust-event.md`.
3. Run failure-mode capture benchmark and fill
   `docs/case-studies/failure-mode-runtime-mismatch.md`.
4. Append official run records to
   `docs/validation/phase-3-5/evidence-log.md`.
