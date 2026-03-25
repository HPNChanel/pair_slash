# PairSlash Wedge Workflows Decision

Date: 2026-03-25
Status: decision draft for validation execution

## Summary

PairSlash should keep the current roadmap's three strongest workflow candidates:

1. `onboard-repo`
2. `memory-candidate -> memory-write-global`
3. `review/fix loop`

The set stays the same, but the sequence changes.

The key decision is not "replace memory." The key decision is "do not let
memory lead the whole roadmap before weekly-use evidence exists."

`onboard-repo` should be the first wedge because it is the best acquisition and
habit-entry workflow. `memory-candidate -> memory-write-global` should be the
second wedge because it is still the strongest moat and trust-layer proof.
`review/fix loop` should be the third wedge because it hits severe recurring
pain, but it risks collapsing PairSlash into a generic code assistant if it
leads too early.

These scores are pre-benchmark working scores, not proof of market pull.

## Decision Plan

1. Score only workflows that can plausibly become a repeated weekly habit for
   the current ICP.
2. Weight pain, recurrence, trust gain, ROI, and repeat intent higher than
   packaging maturity.
3. Exclude broad domain packs from primary wedge scoring unless they show real
   user pull.
4. Choose the top 3 by weighted score, then set sequence by adoption logic
   rather than raw score alone.

## Candidate List

### Scored shortlist

- `onboard-repo`
- `memory-candidate -> memory-write-global`
- `review/fix loop`
- `pairslash-plan`
- `pairslash-memory-audit`
- `pairslash-command-suggest`

### Explicitly excluded from primary wedge scoring

- `pairslash-backend`
- `pairslash-frontend`
- `pairslash-devops`
- `pairslash-release`

These were excluded because they are too broad, too implementation-heavy, or
too team and enterprise adjacent for the current validation question. The
compatibility docs also mark their runtime surfaces as `not yet validated`.

## Scoring Criteria

Scores use a `1-5` scale.

- `1` = weak
- `3` = mixed or unclear
- `5` = very strong

Weighted score formula:

`weighted_score = sum((raw_score / 5) * weight)`

### Criteria weights

| Criterion | Weight | Why it matters |
|---|---:|---|
| Pain severity | 20 | If the pain is not strong, the workflow will not earn habit |
| Recurrence | 15 | Wedges need repeated use, not one-off novelty |
| Trust gain | 15 | PairSlash wins only if the trust layer changes behavior |
| Measurable ROI | 15 | The user must feel a visible time or cleanup delta |
| Repeated weekly use potential | 15 | This is the retention question in product form |
| Fit with trust-layer thesis | 10 | The workflow must strengthen the category, not blur it |
| Adjacency to Phase 4/5 | 5 | Good wedges should unlock later phases without faking proof |
| Implementation realism | 5 | Readiness matters, but it cannot dominate the decision |

## Bias To Watch

### Architecture and memory bias

The repo has already invested heavily in explicit memory authority, audit, and
validation. That makes the memory lane easy to over-score because it is more
architecturally mature than some other candidates.

### Validation structure bias

Current validation docs already frame safe memory write as the "primary wedge."
That is useful as a hypothesis, but it is not the same thing as user evidence.

### Formalization bias

`pairslash-plan` and the Phase 3 team packs have cleaner packaging and registry
status than several source packs. That improves readiness, not necessarily
adoption potential.

## Scored Candidate Table

| Workflow | Sev | Rec | Trust | ROI | Weekly | Fit | Adj | Real | Weighted | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `memory-candidate -> memory-write-global` | 5 | 4 | 5 | 4 | 4 | 5 | 5 | 4 | 90 | Top 3 |
| `review/fix loop` | 5 | 5 | 4 | 5 | 5 | 3 | 3 | 3 | 89 | Top 3 |
| `onboard-repo` | 4 | 5 | 4 | 5 | 5 | 4 | 4 | 3 | 88 | Top 3 |
| `pairslash-plan` | 3 | 4 | 3 | 3 | 4 | 3 | 4 | 5 | 69 | Support only |
| `pairslash-memory-audit` | 3 | 2 | 4 | 2 | 2 | 4 | 3 | 3 | 56 | Defer |
| `pairslash-command-suggest` | 2 | 4 | 2 | 3 | 3 | 2 | 2 | 4 | 54 | Defer |

## Evidence Summary

### What the repo supports strongly today

- The product thesis centers on three jobs: understand repos fast, run repeated
  workflows safely, and keep project memory disciplined.
- The pain map already points to repo cold-start, almost-right AI rework, and
  context loss as the strongest pains.
- The problem statement still says the narrow Phase 3.5 claim is safe durable
  memory workflows, not broad autonomy.

### What the repo does not support yet

- `docs/validation/phase-3-5/verdict.md` is still `NO-GO`.
- No benchmark runs are recorded in `docs/validation/phase-3-5/evidence-log.md`.
- No workflow has proven weekly return behavior yet.

### Evidence that shaped realism scores

- `pairslash-memory-write-global` has the strongest explicit trust boundary, but
  the Phase 0 G7 incident shows the write path is not above implementation risk.
- `pairslash-plan` is the cleanest formalized and runtime-documented pack, but
  its value proposition is more generic than the shortlisted wedges.
- `pairslash-onboard-repo` and `pairslash-review` map well to pain but are less
  formalized than `pairslash-plan`.

## Chosen Top 3

### Wedge 1: `onboard-repo`

Why it wins:

- It is the easiest wedge to try on day one with low trust cost.
- It maps directly to the cold-start pain in the thesis, ICP, and JTBD docs.
- It has the clearest measurable ROI: time to first correct orientation versus
  manual repo spelunking.
- It has strong weekly-use potential because returning to a repo is common for
  the target user.

Why it is not enough alone:

- It does not prove the deepest PairSlash moat.
- If it becomes just another repo summary tool, it will not defend the category.

### Wedge 2: `memory-candidate -> memory-write-global`

Why it wins:

- It is still the strongest trust-layer workflow in the entire product.
- It is the clearest proof that PairSlash changes behavior, not just output
  formatting.
- It has the best adjacency to Phase 4 and Phase 5 because the release gate
  already depends on Phase 3.5 validation staying evidence-bound.
- It is the main moat candidate because explicit preview, acceptance, audit,
  and authoritative memory are not generic assistant behavior.

Why it is not wedge 1:

- The current docs over-center it relative to actual usage evidence.
- It carries more trust friction and more implementation risk than onboarding.
- If users do not feel repeated need for durable memory writes, it should not
  lead the roadmap by inertia.

### Wedge 3: `review/fix loop`

Definition:

This is a workflow job, not a single pack. The current base is
`pairslash-review`, followed by an explicit user-approved fix handoff instead of
autonomous auto-fix behavior.

Why it wins:

- It hits severe and recurring pain: almost-right AI output and review churn.
- It has strong measurable ROI in reduced cleanup and fewer repeated prompts.
- It has very strong weekly-use potential because review and correction loops
  happen constantly in terminal-native work.

Why it is third:

- If it leads too early, PairSlash can drift into "generic coding copilot with
  opinions."
- Its trust-layer differentiation is weaker than memory and less crisp than
  onboarding unless the workflow stays tightly evidence-first.

## Why The Other Candidates Lose For Now

### `pairslash-plan`

- Good supporting workflow, weak primary wedge.
- It is useful, but the job is generic and easier to substitute with normal
  agent behavior.
- Packaging maturity should not outweigh weaker trust delta.

### `pairslash-memory-audit`

- Important maintenance workflow, weak habit wedge.
- Strong for trust hygiene after memory exists, but too infrequent for initial
  adoption.

### `pairslash-command-suggest`

- Helpful but too advisory.
- The manual substitute is close, and trust delta is low.
- It does not prove the trust-layer thesis clearly enough.

### `pairslash-backend`, `pairslash-frontend`, `pairslash-devops`, `pairslash-release`

- Too broad or too enterprise-adjacent for the current stage.
- No live runtime validation exists for their pack surfaces.
- They risk producing fake breadth before PairSlash proves a repeatable wedge.

## Sequencing Recommendation

### Product sequence

1. `onboard-repo`
2. `memory-candidate -> memory-write-global`
3. `review/fix loop`

### Why this sequence is stronger than score rank alone

- Start with the lowest-friction workflow that can create a habit quickly.
- Move next to the strongest moat and trust proof.
- Add review and correction once PairSlash already owns a trust narrative.

### Benchmark sequence

Recommended wedge benchmark order:

1. `onboard-repo` baseline against manual cold start
2. `memory-candidate -> memory-write-global` happy path
3. `memory-candidate -> memory-write-global` guardrail rejection
4. `review/fix loop`
5. next-week resume from durable project truth

This does not remove the release-gate need for strong `B3` and `B4` evidence
before broader Phase 4 claims.

## Final Decision

### Final wedge 1/2/3

1. `onboard-repo`
2. `memory-candidate -> memory-write-global`
3. `review/fix loop`

### Why this set is the strongest adoption wedge

Together, these three workflows cover the most credible path from first use to
habit:

- `onboard-repo` wins the first session
- `memory-candidate -> memory-write-global` wins durable trust
- `review/fix loop` wins repeated day-to-day utility

This set is stronger than a memory-only roadmap because it balances acquisition,
moat, and repetition. It is stronger than a review-led roadmap because it keeps
PairSlash inside the trust-layer thesis instead of becoming a generic code tool.

### What would invalidate this choice

- `onboard-repo` does not beat manual cold start on speed or correctness.
- Users see memory preview and acceptance as friction with no trust upside.
- `review/fix loop` shows clearly higher repeat intent than onboarding or memory
  while still preserving trust-layer differentiation.
- Another workflow records at least two stronger weekly-return signals than the
  weakest selected wedge.
- Any chosen wedge depends on breadth, enterprise policy, or runtime claims that
  the current validation evidence does not support.
