# PairSlash Phase 3.5 Validation Runbook

Use this runbook to execute the gate without inventing process during the run.

## Before each run

- Pick one benchmark from `benchmark-tasks.md`.
- Pick one supported runtime only: `codex-cli` or `github-copilot-cli`.
- Use a real repository and a real user task.
- Open `scoring-rubric.md` and `evidence-log.md`.

## Run loop

1. Capture the starting situation.
   - repo
   - runtime
   - user goal
   - manual alternative the user would otherwise use
2. Run the benchmark task with an actual prompt.
3. Record what PairSlash did.
   - what helped
   - what broke trust
   - where the user hesitated
4. Score the run immediately using the rubric.
5. Ask the weekly-return question:
   - "Would you come back to this next week for the same job? Why or why not?"
6. Append the run to `evidence-log.md`.

## Coverage order

Run the benchmarks in this order:

1. `B3` explicit memory write preview
2. `B4` guardrail rejection under weak or conflicting evidence
3. `B2` candidate extraction from repo reality
4. `B1` fresh-session planning from authoritative truth
5. `B5` resume next week from durable project truth

This order forces the primary wedge to prove itself before broader workflow
stories get airtime.

## Minimum evidence set

Do not update `verdict.md` toward `GO` until you have at least:

- one successful `B3` run on Codex CLI
- one successful `B3` run on GitHub Copilot CLI
- one successful `B4` rejection run on each runtime
- at least two runs with a credible positive weekly-return answer
- no automatic `NO-GO` condition triggered

## After the run set

- Update the scorecard in `verdict.md`.
- Summarize what pain was actually observed.
- State whether the winning workflow was really the safe-memory-write wedge.
- If the answer is still weak, keep `Gate status: NO-GO`.
