# PairSlash Phase 3.5 Painpoint Clusters

Use this file only after normalizing interview notes into evidence units.
Do not create a cluster from praise, abstract opinions, or isolated "would use"
claims.

## Classification Rules

- `Repeated real pain`: recent concrete incident + visible workaround cost +
  recurrence signal, seen in at least 3 interviews or 2 ICP segments.
- `Individual opinion`: one participant view without repeat evidence.
- `Meaningless praise`: positive sentiment with no behavior change or cost.
- `Would use` without commitment: future-tense interest without recurring
  trigger.
- `Contradiction`: same participant or segment gives conflicting signals, or
  belief conflicts with behavior.

## Cluster Table

| Cluster name | Description | ICPs that see it | Frequency | Severity | Current workaround cost | Quote evidence | Confidence | PairSlash fit |
|---|---|---|---|---|---|---|---|---|
| Repo cold-start and wrong assumptions | Re-orienting in a repo takes too long and leads to false starts. | `TBD after ingest` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` | `repo_understanding` |
| Almost-right AI creates review/fix rework | AI gets close enough to be tempting, but cleanup still costs time. | `TBD after ingest` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` | `repeatable_workflow_trust` |
| Workflow reuse is not trusted enough | People repeat manual checklists because reuse feels unsafe. | `TBD after ingest` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` | `repeatable_workflow_trust` |
| Project memory drifts across sessions and people | Important project truth gets lost, duplicated, or contradicted over time. | `TBD after ingest` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` | `memory_continuity` |
| Governance and auditability threshold blocks adoption | Durable AI-assisted actions are blocked until review and traceability exist. | `TBD after ingest` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` | `governance_auditability` |
| Install friction slows trial or rollout | Setup and doctor friction delay first use or consistent reuse. | `TBD after ingest` | `TBD` | `TBD` | `TBD` | `TBD` | `TBD` | `install_friction` |

## Confidence Rules

- `High`: repeated across segments with quote-level evidence and workaround cost.
- `Medium`: repeated, but mostly one segment or missing cost detail.
- `Low`: mostly abstract opinion, weak quotes, or unresolved contradiction.

## PairSlash Fit Rules

- `Strong`: pain maps directly to trust, context continuity, repeatability, or
  measurable ROI.
- `Medium`: pain is real but only indirectly improved by PairSlash.
- `Weak`: pain is real but not wedge-shaping, or better solved elsewhere.

## Wedge Filter

For each cluster, ask:

- Is the pain recurring enough to become a habit loop?
- Is the workaround costly enough to justify behavior change?
- Does PairSlash solve the trust, continuity, or repeatability problem directly?

If the answer is no on any two questions, do not promote the cluster into a top
opportunity.
