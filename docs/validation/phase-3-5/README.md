# PairSlash Product-Validation Gate

This folder tracks the current product-validation benchmark system for
PairSlash. The directory path is legacy. The benchmark logic here is current.

Important distinction:

- these benchmark docs answer the business-validation question
- `verdict.md` in this folder is the product-validation verdict
- `docs/releases/scoped-release-verdict.md` is the separate release/installability verdict
- a release-facing `GO` does not satisfy the product-validation gate by itself

## Fixed boundary

- PairSlash is a trust layer for terminal-native AI workflows.
- PairSlash is not a generic agent framework.
- PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- `/skills` is the canonical user entrypoint.
- Global Project Memory is the authoritative project truth.
- Important memory writes must stay explicit, previewable, and auditable.
- No third runtime may be introduced to rescue weak validation.

## Primary question

Would the target user come back next week for one of the must-win jobs because
PairSlash solved the pain and kept the trust boundary obvious?

If the evidence does not support a credible `yes`, the product-validation gate
stays closed even if release/installability surfaces look mature.

## Official wedge workflows

The current product-validation gate measures only these workflows:

1. `pairslash-onboard-repo`
2. `pairslash-memory-candidate -> pairslash-memory-write-global`
3. `review/fix loop` using `pairslash-review` plus an explicit fix handoff

## Required artifacts

- `benchmark-tasks.md`
- `scoring-rubric.md`
- `runbook.md`
- `evidence-log.md`
- `docs/phase-3.5/phase-exit/north-star-metric.md`
- `docs/phase-3.5/phase-exit/adoption-scorecard.md`
- `verdict.md` for product-validation only
- `docs/releases/scoped-release-verdict.md` for scoped release/installability only

## Evidence standard

This gate uses mixed evidence. No single signal is enough.

- Benchmark evidence: paired runs on real repo work against a raw CLI baseline
- Qualitative evidence: direct notes or quotes about pain, trust, and repeat
  intent
- Runtime evidence: claims stay scoped to the runtime lanes actually benchmarked
- Technical evidence: installability and doctor runs remain supporting proof,
  not wedge proof

## Exit criteria

The product-validation gate remains closed unless all are true:

- official onboarding, memory, and review/fix runs are logged using the
  current schema
- `Trusted Weekly Reuse Rate >= 60%` overall
- onboarding and memory each reach at least a `50%` trusted weekly reuse floor
- task success without manual rescue is `>= 70%`
- memory trust-boundary integrity is `100%`
- preview-to-write fidelity is `100%`
- evidence completeness is `100%`
- `review/fix loop` is not the only workflow showing a win

## Current state

Default status: product-validation gate closed.

The current benchmark method deliberately excludes the historical
installability-only runs that were previously logged as `B3/B4 scoped`.
