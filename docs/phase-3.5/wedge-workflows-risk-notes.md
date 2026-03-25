# PairSlash Wedge Workflow Risk Notes

Date: 2026-03-25
Status: pre-benchmark risk framing

These risks assume the current decision set:

1. `onboard-repo`
2. `memory-candidate -> memory-write-global`
3. `review/fix loop`

## Product Risks

| Risk | Why it matters | Mitigation | Leading signal |
|---|---|---|---|
| `onboard-repo` becomes a generic repo summary | It wins first use but does not create durable category value | Benchmark against correctness and time-to-orientation, not summary polish | User says "helpful" but would not change habit |
| Memory lane over-dominates roadmap | The product starts serving architecture investment instead of adoption proof | Keep memory as wedge 2, not wedge 1, until weekly use is shown | Roadmap discussion keeps defaulting to memory before acquisition evidence |
| `review/fix loop` pulls PairSlash toward generic coding assistant territory | Trust-layer differentiation gets diluted | Keep the loop evidence-first and explicit about review before fix | Messaging starts sounding like general code generation |
| Three wedges feel disconnected | Users may not see one coherent product | Message them as one path: orient, store durable truth, reduce repeated rework | Users can explain one wedge but not the product |

## Adoption Risks

| Risk | Why it matters | Mitigation | Leading signal |
|---|---|---|---|
| `onboard-repo` has high trial but weak repeat | Acquisition without retention is not a wedge | Ask the weekly-return question in every onboarding run | Strong initial feedback, weak next-week intent |
| Memory write feels too heavyweight | Users may stay with ad hoc notes and manual review | Keep candidate triage concise and preview flow obvious | User says the workflow is "safe but too much work" |
| `review/fix loop` is used, but not because of PairSlash trust features | The product gains usage without validating the thesis | Measure whether guardrails and evidence actually change behavior | Users use it for speed only and ignore trust posture |
| Deferred workflows create distraction | Users pull toward breadth before wedge proof exists | Keep messaging and demo order narrow | Requests for backend or devops packs outrun wedge evidence |

## Measurement Risks

| Risk | Why it matters | Mitigation | Leading signal |
|---|---|---|---|
| Internal scoring looks more certain than the evidence really is | Teams may mistake prioritization for validation | Mark all scores as pre-benchmark working scores | Weighted table gets cited as proof of demand |
| Demo success is mistaken for benchmark success | Green-path demos can inflate confidence | Use real repos, real prompts, and real manual baselines | Demos look strong but evidence log stays thin |
| Weekly return question is asked but not interpreted consistently | Retention signal becomes noisy | Capture exact quote or close paraphrase in each run | Similar user statements are logged in conflicting ways |
| Benchmarks overweight trust and underweight ROI, or the reverse | Decision swings based on framing instead of observed behavior | Keep both trust delta and measurable ROI in the scorecard | A workflow scores well on one and clearly fails on the other |

## Implementation Risks

| Risk | Why it matters | Mitigation | Leading signal |
|---|---|---|---|
| `review/fix loop` lacks a single dedicated pack today | The wedge may be conceptually strong but operationally fuzzy | Treat it as `pairslash-review` plus explicit fix handoff for now | Teams disagree on what the loop actually is |
| `onboard-repo` is less formalized than `pairslash-plan` | Packaging maturity may lag adoption intent | Judge it by user value first and formalize later if it wins | Internal push to replace it with `pairslash-plan` for cleanliness |
| Memory write path still carries historical implementation risk | Trust breaks hard if preview and actual write diverge | Keep post-write validation and guardrail checks non-negotiable | Any new drift between preview patch and written file |
| Runtime documentation is uneven across workflows | Readiness can be misread from docs shape alone | Keep compatibility claims evidence-bound | Sales or release language outruns runtime verification |

## False-Positive Risks

| Risk | Why it matters | Mitigation | Leading signal |
|---|---|---|---|
| Architecture maturity is mistaken for user pull | Memory lane can look inevitable before it is habit-forming | Separate moat from entry wedge in the decision | The team says "we already built it, so it must lead" |
| Strong users self-select into trust-heavy workflows | Results may not generalize to the broader ICP | Include users who currently rely on manual notes and repo spelunking | Only highly process-disciplined users respond positively |
| Polished output is mistaken for trust gain | Users may like the artifact without trusting the workflow more | Ask directly what changed in behavior and trust | Positive wording without concrete change in future intent |
| PairSlash breadth creates a halo effect | Users may praise the product generally while the wedge is still weak | Evaluate each workflow separately before bundling claims | Praise attaches to "the system" rather than a repeated job |

## Watchlist For The Next Validation Round

- If `onboard-repo` does not clearly win first-use and next-week return, demote
  it.
- If memory write does not create visible trust gain, reduce its roadmap share
  even if the architecture remains strong.
- If `review/fix loop` produces the strongest repeat intent without collapsing
  the product story, promote it.
- If any deferred workflow shows stronger repeat behavior than wedge 3, reopen
  the shortlist.
