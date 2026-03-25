# PairSlash Phase 3.5 Problem-Solution Validation Gate

This gate exists between architecture confidence and any claim that PairSlash
deserves broader Phase 4 distribution work.

Do not treat installability, runtime packaging, or internal test pass rates as
proof of problem-solution fit. Phase 4 is blocked until this gate produces a
written `GO` verdict with mixed evidence.

## Fixed boundary

- PairSlash is a trust layer for terminal-native AI workflows.
- PairSlash is not a generic agent framework.
- PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- `/skills` is the canonical user entrypoint.
- Global Project Memory is the authoritative project truth.
- Important memory writes must stay explicit, previewable, and auditable.
- No third runtime may be introduced to rescue weak validation.

## Primary question

Would the target user come back next week?

Every benchmark run, message draft, and Phase 4 claim must answer that
question directly. If the evidence does not support a credible "yes", the gate
stays closed.

## Locked validation target

- ICP: solo builders using Codex CLI or GitHub Copilot CLI in a terminal on a
  real repository with recurring project context.
- JTBD: when working across terminal-native AI sessions on a real repo, the
  user wants project truth updates to be explicit, previewable, and auditable
  so they can trust what becomes durable memory and resume work later.
- Primary painpoint: distrust of durable AI writes into project context.
- Secondary pain: context drift between sessions.
- Secondary pain: uncertainty about which workflow to use first.
- Secondary pain: fear that a convenience feature hides unsafe side effects.

## Wedge workflows

The gate validates only these workflows. Any new feature idea must map back to
one of them or it is out of scope.

1. Plan from authoritative truth without mutating memory.
2. Extract a memory candidate from real repo evidence and reconcile it against
   authoritative memory.
3. Promote a validated candidate through an explicit preview and acceptance
   path with audit semantics.

## Required artifacts

- `problem-statement.md`
- `benchmark-tasks.md`
- `scoring-rubric.md`
- `runbook.md`
- `evidence-log.md`
- `messaging-narrative.md`
- `verdict.md`

## Evidence standard

This gate uses mixed evidence. No single signal is enough.

- Benchmark evidence: reproducible tasks on real repo work.
- Qualitative evidence: direct notes or quotes about pain, trust, and repeat
  intent.
- Runtime evidence: record which runtime was used for each run and do not
  generalize beyond validated lanes.

## Exit criteria

The gate may flip to `GO` only when all are true:

- All benchmark tasks are executed and scored with the rubric.
- The primary safe-memory-write wedge has at least one end-to-end successful run
  on Codex CLI and one on GitHub Copilot CLI.
- The rubric thresholds in `scoring-rubric.md` are met.
- The narrative in `messaging-narrative.md` stays traceable to the validated
  painpoint and does not overclaim runtime scope.
- `verdict.md` is updated to `Gate status: GO` with evidence notes and claimed
  runtime scope.

## Current state

Default status is `NO-GO`. Keep it that way until the evidence is strong enough
to justify broader Phase 4 claims.
