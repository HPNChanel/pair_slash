# PairSlash Phase 3.5 Interview Recruiting Plan

## Objective

Recruit enough high-signal participants to confirm or reject PairSlash problem-solution fit for terminal-native AI workflows.

The goal is not praise, concept validation theater, or feature requests. The goal is to uncover repeated pain, current workaround cost, trust threshold, and evidence that a user would come back next week.

## Sample Size

- Target: 16 interviews
- Acceptable range: 12-20 interviews
- Wave 1: 6 interviews for fast signal
- Wave 2: 10 interviews after tightening the guide from Wave 1 findings

## ICP Quota

| Segment | Target | Why this quota |
|---|---:|---|
| P1 power user terminal | 6 | Fastest path to real repo-work pain and repeat-use signal |
| P1 tech lead / maintainer / staff engineer | 4 | Tests trust threshold, review cost, and team-level workflow safety |
| P2 platform / DevEx / internal tooling | 4 | Tests governance, install friction, rollout concerns, and operational trust |
| P3 OSS maintainer / consultant | 2 | Tests multi-repo continuity, client handoff, and lightweight trust needs |

## Screener Criteria

Candidates should meet most of the following:

- Used Codex CLI or GitHub Copilot CLI in the last 30 days, or directly owns how a team uses them
- Works in the terminal on real repos, not only on toy examples
- Revisits the same repo often enough that context rebuild has a cost
- Can describe at least one recent concrete workflow, incident, or cleanup loop
- Has felt pain in at least one target area:
  - repo understanding
  - review / fix-test loop
  - memory continuity
  - trust / governance / auditability
  - install friction
  - repeated use vs novelty effect

## Reject Criteria

Reject or de-prioritize if any of the following are true:

- Mostly uses GUI AI tools and rarely works in terminal-native AI workflows
- Cannot describe a recent concrete incident
- Uses AI only for one-off novelty tasks
- Has no repeated repo context and no repeated workflow pattern
- Mainly wants autonomous orchestration or agent swarms, not trust and control
- Is excited by the concept but has not paid real workflow cost recently

## Outreach Sequencing

### Wave 1

Purpose: find out whether the pain is repeated and strong enough to justify the wedge.

- 4 interviews from P1 power users
- 2 interviews from P1 tech lead / maintainer / staff engineer
- Recruit from warm intros first
- Prioritize people who can talk through a workflow from the last 7-14 days

Wave 1 exit criteria:

- at least 4 participants describe a recent almost-right AI rework incident
- at least 4 participants describe repeated repo context loss or workflow rebuild cost
- at least 3 participants can articulate a concrete trust threshold
- at least 3 participants give a believable reason they would come back next week if the pain were solved

If Wave 1 misses those thresholds, tighten or narrow the ICP before Wave 2.

### Wave 2

Purpose: test whether the problem generalizes across the rest of the ICP and whether the trust-layer framing still holds.

- 2 more interviews from P1 power users
- 2 more interviews from P1 tech lead / maintainer / staff engineer
- 4 interviews from P2 platform / DevEx / internal tooling
- 2 interviews from P3 OSS maintainer / consultant

Wave 2 focus:

- separate primary pain from setup friction
- test whether explicit, reviewable behavior feels like value or like overhead
- test whether repeated use is driven by real workflow recurrence rather than novelty

## Incentives

- External individual contributors, OSS maintainers, and consultants: offer the equivalent of USD 50-100
- Internal or partner interviews: no default incentive unless recruiting stalls
- Do not pay more just to fill quota with weak candidates

## Insight Types Needed

Each interview should try to surface these:

- last real incident, not generic opinion
- frequency of pain
- cost of current workaround
- trust threshold before reuse
- what would make them return next week
- what would make them reject the product even if the concept sounds right

## Bias Risks

### AI enthusiast bias

Risk: participants want the category to exist and overstate need.

Countermeasure: require recent incident detail and current workaround cost.

### Founder-led leading bias

Risk: interviewer steers the participant toward trust, memory, or auditability.

Countermeasure: ask what happened last time before naming any PairSlash framing.

### Demo halo bias

Risk: participants react to the idea, not to recurring pain.

Countermeasure: do not demo in the main interview. If concept testing is needed, do it only after all behavior-first questions.

### Setup-friction distortion

Risk: install pain sounds loud and crowds out core pain.

Countermeasure: record install friction separately from primary workflow pain.

### Role-mix distortion

Risk: platform roles over-index on governance while power users over-index on speed.

Countermeasure: keep quotas separate and synthesize by segment before aggregating.

### Recall bias

Risk: stories become abstract if the incident is too old.

Countermeasure: steer toward the last 7-14 days when possible; reject vague stories.
