# PairSlash Next 30 Days

Date: 2026-03-31
Status: benchmark-execution plan for the current product-validation phase

## Objective

Answer the product-validation gate with recorded wedge evidence, not with more
installability proof, architecture polish, or breadth implementation.

## Sequence

### Days 1-3: Freeze the method

1. Freeze the current benchmark definitions in `benchmark-tasks.md`.
2. Migrate the evidence log to the current schema.
3. Pin repo snapshots, success criteria, and AB/BA order for the first paired
   runs.
4. Keep installability-only evidence out of the product scorecard.

Dependencies:

- access to both supported runtimes
- at least one real repo snapshot for onboarding and one for memory
- one disciplined evaluator or observer

### Days 4-10: Run acquisition plus trust on Codex

1. Run one official `W1` paired onboarding benchmark on Codex CLI.
2. Run one official `W2a` memory happy-path benchmark on Codex CLI.
3. Run one official `W2b` memory rejection benchmark on Codex CLI.
4. Log every run within 24 hours.

Dependencies:

- live runtime access
- authoritative memory available for the memory lane
- frozen success criteria

### Days 11-17: Repeat the must-win set on Copilot

1. Run one official `W1` paired onboarding benchmark on GitHub Copilot CLI.
2. Run one official `W2a` memory happy-path benchmark on GitHub Copilot CLI.
3. Run one official `W2b` memory rejection benchmark on GitHub Copilot CLI.
4. Recompute interim workflow floors after logging.

Dependencies:

- comparable repo snapshots
- explicit trust-boundary observation during preview and rejection

### Days 18-24: Measure recurring utility without drift

1. Run one official `W3` paired review/fix benchmark on the primary runtime.
2. If `W3` looks strong, spot-check it on the second runtime.
3. Add delayed follow-up notes on at least two official onboarding or memory
   runs.

Dependencies:

- pinned diff snapshots
- explicit fix handoff
- test or verification output for the fix path

### Days 25-30: Recompute and decide

1. Recompute `Trusted Weekly Reuse Rate`.
2. Check onboarding floor and memory floor separately.
3. Check memory trust-boundary integrity, preview fidelity, and evidence
   completeness.
4. Keep the gate closed if `review/fix loop` is the only clear winner.
5. Update broader claims only if the product scorecard thresholds are actually
   met.

Dependencies:

- complete evidence log
- no silent exclusion of mixed or failed runs

## What not to start yet

Do not use the next 30 days for:

- third-runtime exploration
- broader enterprise or governance-first claims
- generic coding productivity benchmarks
- installability benchmarking mixed into trust-memory benchmarking
- review/fix expansion into an autonomous copilot thesis

## Success condition

The next 30 days succeed only if they produce either:

- a real wedge win backed by the official scorecard, or
- a sharper `NO-GO` with concrete evidence about which wedge still does not
  win
