# PairSlash Product-Validation Runbook

Use this runbook to execute official benchmark runs without inventing process
mid-stream.

## Before each paired group

- Pick one official workflow from `benchmark-tasks.md`.
- Pick one supported runtime only: `codex-cli` or `github-copilot-cli`.
- Freeze the repo snapshot, task statement, and success criteria before either
  arm starts.
- Decide the arm order: `AB` or `BA`.
- Open `scoring-rubric.md` and `evidence-log.md`.

## Baseline discipline

- Baseline means the raw terminal AI workflow on the same runtime.
- Do not give PairSlash extra repo access or extra hints the baseline arm does
  not get.
- Do not substitute install commands, doctor flows, or technical acceptance
  checks for the required wedge baseline.

## Run loop

1. Capture the starting situation.
   - runtime
   - repo snapshot
   - task statement
   - frozen success criteria
   - chosen arm order
2. Run the baseline arm and record:
   - exact prompt or method
   - time-to-first-success
   - task success
   - rescue count
   - reprompt count
   - rework notes
3. Run the PairSlash arm and record:
   - exact workflow path
   - time-to-first-success
   - task success
   - rescue count
   - reprompt count
   - required workflow artifacts
4. Ask the weekly-return question:
   - "Would you come back to this next week for the same job? Why or why not?"
5. Score the run immediately using the current rubric.
6. Append the entry to `evidence-log.md` within 24 hours.

## Required execution order

Run the official product-validation benchmarks in this order:

1. `W1` paired onboarding benchmark
2. `W2a` memory happy path
3. `W2b` memory rejection path
4. `W3` paired review/fix benchmark
5. delayed follow-up on at least two official runs

This keeps acquisition and trust proof ahead of broad utility claims.

## Minimum evidence set before any broader claim

Do not treat the product-validation gate as passed until you have at least:

- one official `W1` paired run on Codex CLI
- one official `W1` paired run on GitHub Copilot CLI
- one successful `W2a` run on each runtime
- one successful `W2b` run on each runtime
- at least one official `W3` paired run on the primary runtime
- at least two onboarding or memory runs with a credible `likely_yes` or
  `default_path` answer
- no hard fail condition triggered

## After the run set

- Update the product evidence log, not just narrative notes.
- Recompute the 30-day scorecard from `docs/phase-3.5/phase-exit/adoption-scorecard.md`.
- State whether onboarding and memory each crossed their floor.
- State whether `review/fix loop` is helping or trying to become the lead
  thesis.
- If the evidence is weak or mixed, keep the product-validation gate closed.
