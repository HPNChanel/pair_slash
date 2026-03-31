# PairSlash Wedge Workflows Decision

Date: 2026-03-31
Status: active product-validation decision

## Summary

PairSlash should keep the same three wedge workflows, in this order:

1. `pairslash-onboard-repo`
2. `pairslash-memory-candidate -> pairslash-memory-write-global`
3. `review/fix loop`

The sequence is intentional:

- onboarding is the lowest-friction acquisition wedge
- memory is the trust-memory moat
- review/fix is recurring utility, but it must not redefine the thesis

`review/fix loop` stays in the benchmark set because the pain is real, not
because it should become the lead story.

## Why these three stay in scope

| Workflow | User pain | Measurable outcome | Business value | Implementation readiness | Risk of fake win | Decision |
|---|---|---|---|---|---|---|
| `pairslash-onboard-repo` | Cold-start repo re-entry and context rebuild | Time-to-first-success delta, orientation accuracy, reuse intent | Best first-session acquisition path | Contracted and spec-defined, but not yet proven in benchmark evidence | Easy to fake with polished summaries or evaluator familiarity | Keep as wedge 1 |
| `pairslash-memory-candidate -> pairslash-memory-write-global` | Distrust of durable AI writes and memory drift | Trust-boundary pass rate, preview fidelity, reuse intent | Strongest moat if it changes behavior | Strongest implementation and test surface in the repo | Easy to over-credit because docs and tests are already mature | Keep as wedge 2 |
| `review/fix loop` | Almost-right AI output and repeated cleanup burden | Issue reproducibility, rework reduction, task success, reuse intent | Strong recurring utility if explicit and evidence-first | Review surface exists; fix handoff still needs tight benchmark framing | Can collapse into a generic coding benchmark if task shape is loose | Keep as wedge 3 |

## Why the sequence matters

### Wedge 1: `pairslash-onboard-repo`

- Wins the first session.
- Gives the clearest business-facing speed and correctness signal.
- Must prove it is more than a nicer repo summary.

### Wedge 2: `memory-candidate -> memory-write-global`

- Proves PairSlash changes durable behavior, not just output phrasing.
- Must pass both happy-path and rejection-path evidence on both runtimes.
- Does not get to lead just because it is the most formally implemented lane.

### Wedge 3: `review/fix loop`

- Measures repeated utility on a real recurring pain.
- Must remain review-first and explicit about the fix handoff.
- Cannot independently justify phase movement if onboarding or memory has not
  won.

## Benchmark consequences

The official benchmark order should be:

1. paired onboarding benchmark
2. memory happy path
3. memory rejection path
4. paired review/fix benchmark
5. delayed follow-up notes on at least two official runs

This order keeps PairSlash anchored in acquisition plus trust before recurring
utility is allowed to influence the narrative too much.

## Anti-drift rules

- No broader domain packs belong in the primary wedge set.
- No third runtime, team lane, or generic agent framing may be used to rescue
  weak wedge evidence.
- `review/fix loop` can raise confidence in daily utility, but it cannot become
  the product claim by itself.
- Installability, doctor, and release-readiness evidence are supporting
  technical proof, not wedge proof.

## What would invalidate this choice

- onboarding fails to beat raw CLI on speed or correctness
- memory preview and rejection do not create a clear trust advantage
- review/fix shows strong utility only on overly easy tasks
- a new workflow records stronger repeated-use evidence without blurring the
  thesis
