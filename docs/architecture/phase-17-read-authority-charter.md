# Phase 17 Read Authority Charter

This charter fixes the contract layer for Global Project Memory on read paths.
It does not change write authority, promotion flow, or benchmark policy.

Implementation anchors:

- `packages/core/spec-core/src/read-authority.js`
- `packages/core/contract-engine/src/index.js`
- `packages/core/spec-core/schemas/context-explanation.schema.yaml`
- `packages/tools/cli/src/bin/pairslash.js`
- `packages/core/spec-core/tests/project-memory.test.js`
- `packages/tools/cli/tests/cli.test.js`
- `tests/contracts/contract-engine.contracts.test.js`

## Precedence Contract

Official precedence rule:

`global-project-memory > task-memory > session > staging > audit-log`

Contract rules:

- `Global Project Memory` is the only authoritative project-memory layer on read.
- `task-memory`, `session`, `staging`, and `audit-log` are supporting layers only.
- Lower layers may fill a missing claim only when Global has no matching claim key.
- Lower layers must not silently override a Global claim with the same claim key.
- Shared layer order is owned by `packages/core/spec-core/src/read-authority.js`.
- A workflow may omit lower layers, but it may not reorder the layers it uses.

## Explain-Context Contract

`explain-context` must distinguish between the files that were read and the
resolved context that won after precedence was applied.

Minimum required fields:

- `memory_reads.global_project_memory`
- `memory_reads.task_memory`
- `memory_reads.session_artifacts`
- `memory_resolution.profile_id`
- `memory_resolution.uses_shared_loader`
- `memory_resolution.authoritative_sources`
- `memory_resolution.missing_paths`
- `memory_resolution.warnings`
- `memory_resolution.layers[]`
- `memory_resolution.record_resolution.precedence_rule`
- `memory_resolution.record_resolution.resolved_claims[]`
- `memory_resolution.record_resolution.conflicts[]`
- `memory_resolution.record_resolution.gap_fills[]`

Contract rules:

- `memory_reads` is an artifact list only.
- `memory_resolution` is the resolved context view.
- A Phase 17-complete read path must surface both views.
- A lower-layer selection without a Global match must remain
  `supporting-gap-fill`, never authoritative.

## Conflict Taxonomy

Conflict types:

1. `shadowed-by-authoritative`
   Same claim key, no semantic contradiction, lower layer loses to Global.
   This is visible shadowing, not a hard conflict.
2. `shadowed-by-authoritative-conflict`
   Same claim key, contradictory statement, lower layer loses to Global.
   This is a hard signal and must appear in `record_resolution.conflicts`.
3. `shadowed-by-lower-authority-fill`
   No Global claim exists; a higher supporting layer beats a lower supporting
   layer without contradiction.
   This is visible shadowing, not a hard conflict.
4. `shadowed-by-lower-authority-fill-conflict`
   No Global claim exists; supporting layers contradict on the same claim key.
   This is a hard signal and must appear in `record_resolution.conflicts`.

Signal rules:

- Warning-level visibility stays in `shadowed[]`, `warnings[]`, or
  `missing_paths[]`.
- Hard signals must appear in `record_resolution.conflicts[]`.
- Hard signals do not authorize a lower layer to win.

## Policy Notes for Global / Task / Session / Staging

| Layer | Allowed Role | Cannot Do | Visibility in explain-context | Conflict Behavior |
| --- | --- | --- | --- | --- |
| Global Project Memory | Authoritative project truth on read | Cannot be silently replaced by any lower layer | Must appear as an authoritative layer and source set | Wins same-claim resolution; lower-layer contradiction is hard-signaled |
| Task Memory | Supporting task or initiative context | Cannot override or reclassify Global truth | Must appear as supporting and may appear in `gap_fills` | Contradiction with Global is hard-signaled; otherwise it only shadows or gap-fills |
| Session | Supporting session evidence | Cannot become durable truth or outrank task/global | Must appear as supporting when loaded | Same rule as task; fills gaps only |
| Staging | Supporting pre-authoritative preview or candidate evidence | Cannot imply promotion or authority | Must appear as supporting when loaded | Same rule as session; never authoritative |

`audit-log` is supporting provenance only. It can explain prior write history,
but it cannot define current authoritative truth.

## Acceptance Matrix

Required Phase 17 workflows:

| Workflow | Must Use Shared Loader? | Why | Phase 17 Required? | Acceptance Needed? |
| --- | --- | --- | --- | --- |
| `explain-context` | Yes | It is the audit surface for resolved read context | Yes | Yes |
| `pairslash-plan` | Yes | It is the current public read-path proof workflow | Yes | Yes |
| `pairslash-memory-candidate` | Yes | Candidate reconciliation depends on authoritative-vs-supporting resolution | Yes | Yes |
| `pairslash-memory-audit` | Yes | Audit output must use the same resolution model as the loader | Yes | Yes |
| `pairslash-review` | Yes, if profiled | It reads memory, but it is not part of the Phase 17 exit gate | No | No |
| `pairslash-onboard-repo` | Yes, if profiled | It reads memory, but it is not part of the Phase 17 exit gate | No | No |
| `pairslash-command-suggest` | Yes, if profiled | It reads constraints, but it is not part of the Phase 17 exit gate | No | No |
| `doctor` | No direct claim resolution required | It diagnoses runtime and install posture, not resolved project-memory claims | No | No |

Phase 17 acceptance must prove:

- shared precedence is `global > task > session > staging > audit-log`
- lower layers only fill missing claims and do not gain authority
- `contract-engine` read paths come from the shared loader
- `explain-context` shows resolved precedence and conflict metadata, not only
  an artifact list
- write-global preview/apply behavior remains unchanged

## Out-of-Scope Decisions

- No change to `pairslash-memory-write-global` authority semantics
- No promotion-system design
- No benchmark-system design
- No new runtime
- No claim that every read-oriented workflow now has live canonical proof
- No claim that lower layers became authoritative
- No claim that read workflows can write or promote memory implicitly

Authoritative statement: Global Project Memory is authoritative on read only
when required workflows resolve claims through the shared loader and surface
lower-layer shadowing instead of silently overriding Global.

Anti-overclaim statement: Phase 17 does not mean every read-oriented workflow
has live canonical proof or that supporting layers became authoritative.

Exit gate sentence: Phase 17 exits only when `explain-context`,
`pairslash-plan`, `pairslash-memory-candidate`, and `pairslash-memory-audit`
all use the shared loader, emit auditable precedence and conflict metadata, and
preserve Global-as-authoritative with lower layers limited to explicit
supporting gap-fills.
