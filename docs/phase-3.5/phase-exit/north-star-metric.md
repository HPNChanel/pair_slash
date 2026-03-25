# PairSlash North-Star Metric

Date: 2026-03-25
Status: proposed operating metric for the next validation round

## North-Star Metric

`Trusted Weekly Reuse Rate`

## Definition

This is the share of valid PairSlash wedge runs where the workflow:

- succeeds without manual rescue
- stays inside the trust boundary
- earns a weekly reuse score of `>= 2`

## Formula

`Trusted Weekly Reuse Rate = trusted_reusable_runs / valid_pairslash_wedge_runs`

Count a run as `trusted_reusable` only if all are true:

- the run completes the task successfully
- no hidden durable write or other trust-boundary violation occurs
- manual rescue count is `0`
- the weekly-return answer maps to `likely reuse next week` or stronger

## Why This Is The North-Star

PairSlash does not win by getting one polished output. It wins only if a user
trusts a workflow enough to reuse it the next time the same trigger appears.

This metric forces three conditions to be true at the same time:

- the workflow worked
- the trust layer mattered
- the user would come back

## Leading Indicators

- `B3` and `B4` trust-delta scores
- task success without manual rescue
- manual rescue count
- reprompt count
- time-to-first-success delta versus raw CLI or manual baseline
- quality of the exact weekly-return quote

## Lagging Indicators

- `B5` success rate on next-week resume tasks
- repeated weekly use rate by wedge workflow
- share of workflows that become the user's default path for the same job
- evidence that durable project truth is consulted in later sessions

## Anti-Metrics

Do not use these as the primary operating metric:

- installs
- doctor pass count by itself
- package or skill count
- README quality
- demo smoothness
- positive reactions without a recurring trigger
- runtime breadth beyond the two supported lanes

## Why This Metric Is Not Vanity

It is not enough for a metric to move. It has to move for the right reason.

`Trusted Weekly Reuse Rate` is hard to fake because it requires:

- a real task
- a successful outcome
- no trust-boundary failure
- a credible next-week return signal

That makes it much harder to game than installs, praise, documentation volume,
or technical readiness.

## Current State

Current value: unmeasured.

Reason: the official evidence log contains no recorded benchmark runs yet.
