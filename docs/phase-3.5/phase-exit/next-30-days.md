# PairSlash Next 30 Days

Date: 2026-03-25
Status: recommended validation-first action plan

## Objective

Answer the Phase 3.5 gate with evidence, not with more narrative or more
architecture.

## Sequence

### Days 1-3: Freeze Claims and Lock the Benchmark Method

1. Keep the official verdict at `NO-GO`.
2. Freeze any broader Phase 4 product or runtime claims.
3. Lock the exact benchmark prompts, repo snapshots, and paired raw CLI versus
   PairSlash comparison method.
4. Align the evidence log format with the benchmark rubric so every run records
   rescue count, trust notes, and weekly-return answer.

Dependencies:

- real repos with repeatable snapshots
- access to both supported runtimes
- one observer or disciplined self-scoring method

### Days 4-10: Run the Gate-Critical Memory Benchmarks

1. Run `B3` on Codex CLI.
2. Run `B4` on Codex CLI.
3. Run `B3` on GitHub Copilot CLI.
4. Run `B4` on GitHub Copilot CLI.
5. Append every run immediately to `docs/validation/phase-3-5/evidence-log.md`.

Dependencies:

- live runtime access on both lanes
- trust-boundary observation during preview, acceptance, and rejection

### Days 11-17: Run the Acquisition and Utility Benchmarks

1. Run paired `B1` onboarding comparisons against manual cold start.
2. Run paired review/fix comparisons on the same repo snapshots.
3. Capture time-to-first-success, rescue count, reprompt count, and exact
   weekly-return language.

Dependencies:

- same task and repo snapshot on both arms
- a real manual alternative for each task

### Days 18-24: Run the Retention Benchmark

1. Run `B5` next-week resume tasks on the primary runtime.
2. Spot-check `B5` on the second runtime before broadening any retention claim.
3. Verify whether durable truth was actually useful later, not just nicely
   formatted at write time.

Dependencies:

- prior durable truth from earlier runs
- enough time gap or simulation discipline to make the resume task realistic

### Days 25-30: Synthesize and Re-decide

1. Score every run using the official rubric.
2. Compute the adoption scorecard and north-star value.
3. Re-rank the wedge workflows using real repeat-intent evidence.
4. Update the official verdict only if the gate criteria are actually met.
5. If the answer is still weak, keep `NO-GO` and narrow the next round instead
   of broadening the roadmap.

Dependencies:

- complete and honest run logs
- no silent exclusion of weak or negative runs

## What Not To Start Yet

Do not start these until the gate evidence exists:

- no third runtime
- no broader enterprise or governance-first product push
- no new pack proliferation justified by theory alone
- no Phase 4 claim expansion based only on tests, installability, or docs
- no memory-lane expansion just because the architecture is already there
- no attempt to relabel `NO-GO` as `CONDITIONAL GO` without real mixed evidence

## Success Condition For The 30-Day Plan

The 30-day plan succeeds only if it produces a verdict change that is grounded
in recorded benchmark evidence, or a much sharper `NO-GO` with concrete reasons
why the wedge still does not win.
