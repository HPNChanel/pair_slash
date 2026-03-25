# PairSlash Phase 3.5 Scoring Rubric

Score each benchmark task on five dimensions from `0` to `3`.

## Dimensions

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Problem relevance | Tangential to the ICP's pain | Useful but not important | Clear recurring pain | Acute recurring pain that obviously deserves a tool |
| Trust delta | No extra trust, or trust goes down | Slight reassurance only | Clear confidence gain | User explicitly trusts the workflow more because of the guardrails |
| Correctness and safety | Wrong, unsafe, or policy-breaking | Partly right but leaky | Correct with minor issues | Correct and inside all trust boundaries |
| Effort and time-to-value | Slower than manual | About the same as manual | Noticeable savings | Material savings with low setup overhead |
| Repeat intent | Would not return | Maybe for niche cases | Likely to reuse next week for the same job | Would make it the default path for this job |

Maximum score per task: `15`.

## Automatic NO-GO conditions

The validation gate fails immediately if any run does any of the following:

- Performs or implies a hidden durable write.
- Claims support beyond Codex CLI and GitHub Copilot CLI.
- Treats `/skills` as non-canonical for the validated workflow surface.
- Uses messaging that presents PairSlash as a vague general agent framework.
- Recommends a feature or message that does not map back to a validated painpoint.

## Benchmark pass rule

- No benchmark task may score below `9/15`.
- Average score across all benchmark tasks must be `>= 11/15`.
- At least `3/5` tasks must score `>= 2` on `Repeat intent`.
- `B3` and `B4` must each score `>= 2` on `Trust delta` and
  `Correctness and safety`.

## Gate rule for moving toward Phase 4

Keep `verdict.md` at `Gate status: NO-GO` unless all are true:

- The benchmark pass rule is satisfied.
- Qualitative notes confirm that the wedge is solving a real trust problem, not
  just producing polished output.
- At least one end-to-end primary-wedge run exists on Codex CLI and one on
  GitHub Copilot CLI.
- At least two benchmark runs include a credible positive answer to
  "Would you come back next week? Why?"
- Messaging remains inside the approved narrative and scoped to validated
  runtimes only.

## Scorecard template

| Benchmark | Runtime | Problem relevance | Trust delta | Correctness and safety | Effort and time-to-value | Repeat intent | Total | Verdict |
|---|---|---|---|---|---|---|---|---|
| B1 | | | | | | | | |
| B2 | | | | | | | | |
| B3 | | | | | | | | |
| B4 | | | | | | | | |
| B5 | | | | | | | | |
