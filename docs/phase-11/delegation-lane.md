# Delegation Lane

Status: scaffold-only (advanced optional, non-core)
Phase: 11
Public release label: experimental
Runtime support expectation: design-only
Core install impact: none
Risk boundary: caller control must remain intact; no hidden spawn or memory write

## Problem Framing

Delegation exists to reduce bounded analysis load inside a caller-controlled
workflow.

It is allowed to split a task into a smaller explicit subtask.
It is not allowed to turn PairSlash into a general orchestration platform.

The repo already has strong contracts for:

- read-oriented workflows
- candidate-producing read paths
- write-authority preview and approval boundaries
- policy verdicts and runtime enforcement

The repo does not yet have:

- delegation-native core schema
- worker runtime substrate
- live runtime evidence for subagent support
- safe hook points in CLI, installer, doctor, or runtime adapters

That means the first safe slice is contract-only and scaffold-only.

## Delegation Operating Model

Delegation is allowed only as an explicit parent-to-child handoff.

Required parent inputs:

- `task_id`
- `workflow_id`
- `workflow_class`
- `worker_class`
- `caller_capabilities`
- `delegated_capabilities`
- `caller_allowed_paths`
- `worker_allowed_paths`
- expected result envelope
- abort conditions

Safe-MVP workflow allowlist:

- `pairslash-plan`
- `pairslash-onboard-repo`
- `pairslash-review`
- `pairslash-memory-audit`
- `pairslash-memory-candidate`

Safe-MVP workflow denylist:

- `pairslash-memory-write-global`
- `pairslash-backend`
- `pairslash-frontend`
- `pairslash-devops`
- `pairslash-release`

Interpretation:

- `write-authority` workflows are always blocked
- `dual-mode` workflows are blocked in the safe MVP
- unknown workflows are blocked until explicitly added to an allowlist

Worker read scope:

- only paths already granted to the caller
- only memory/files/docs already inside caller read contract
- no expansion outside caller path roots

Worker write scope:

- none in the safe MVP
- no repo writes
- no runtime-root writes
- no task-memory writes
- no staging writes
- no Global Project Memory writes

Caller approval is required for:

- creating the delegated worker
- choosing the worker class
- granting delegated capabilities
- widening path scope
- accepting any patch proposal or candidate artifact
- acting on any escalation returned by the worker

Safe-MVP fan-out bound:

- `max_fan_out = 1`
- any unbounded or multi-worker fan-out attempt is denied

## Authority Ladder

- `caller`
  Holds the full authority of the current workflow contract.
- `delegated read-only worker`
  Reads declared scope only and returns source-linked observations.
- `delegated analysis worker`
  Reads declared scope only and returns analysis findings in a result envelope.
- `delegated patch-proposal worker`
  Defined in policy but disabled by default in this slice.
  It may only ever return proposal artifacts, never apply changes.
- `delegated write-candidate worker`
  Defined but deferred.
  It is blocked by default and cannot write memory or repo state.

Forbidden worker classes:

- autonomous chain spawner
- repo commit worker
- repo merge worker
- Global Memory writer
- front-door bootstrap worker

## Result Contract

Every delegated result must include:

- `task_id`
- `parent_task_id`
- `worker_class`
- `workflow_id`
- `workflow_class`
- `scope`
- `files_inspected`
- `changes_proposed`
- `confidence`
- `evidence`
- `policy_verdict`
- `escalation_flags`
- `requires_caller_approval`
- `aborted`
- `authoritative: false`
- `truth_tier: supplemental`

`scope` must encode:

- caller capabilities
- delegated capabilities
- caller allowed paths
- worker allowed paths
- denied paths
- `max_depth: 1`
- `max_fan_out: 1`

## No Silent Delegation Rules

- no delegation without explicit invocation
- no automatic worker creation because a task is “large”
- no worker-to-worker spawning
- no unbounded multi-worker fan-out
- no hidden merge of worker output into caller output
- no automatic patch application
- no automatic memory promotion
- no new front door beside `/skills`

## Failure Modes

### Authority drift

Worker asks for capabilities or paths the caller does not have.
Verdict: deny.

### Review-path loss

Delegation tries to move from report into mutation without a separate caller
approval step.
Verdict: deny.

### Silent chain spawning

One worker tries to create another worker or deepen execution depth.
Verdict: deny.

### Unbounded fan-out

A caller tries to fork many delegated workers without explicit bounded review.
Verdict: deny.

### Memory boundary confusion

Delegated output is mistaken for project truth.
Mitigation: output stays non-authoritative and source-labeled.

### False support claim

Docs or package behavior imply runtime-native subagent support that the repo
has not verified live.
Mitigation: mark the lane scaffold-only and design-only for runtime support.

## Abort Rules

Delegation must abort when:

- invocation is not explicit
- lane is not explicitly enabled
- workflow is `write-authority`
- workflow is `dual-mode`
- workflow is outside the safe-MVP allowlist
- requested depth is greater than `1`
- requested fan-out is greater than `1`
- worker class is forbidden
- delegated capability set exceeds caller capability set
- delegated path scope exceeds caller path scope
- request attempts task-memory write, Global Memory write, or new front door
- request attempts hidden chain spawning

Abort output must still return a structured result envelope with:

- `aborted: true`
- policy verdict
- decisive escalation flags

## Interaction With Global Memory

In the safe MVP, delegated output is report-only.

Allowed:

- source-linked report output
- non-authoritative findings

Deferred:

- proposal-only patch artifacts
- candidate-only memory artifacts after a later isolation decision

Absolutely forbidden:

- direct writes to `.pairslash/project-memory/`
- direct writes to `.pairslash/task-memory/`
- direct call path into `pairslash-memory-write-global`
- implicit promotion from delegated output into authoritative memory

The only valid future path from delegated output to authoritative memory is:

`delegated result -> caller review -> pairslash-memory-candidate -> pairslash-memory-write-global preview -> explicit approval`

## Safe MVP

Smallest shippable slice that stays truthful to PairSlash:

- lane-local package under `packages/advanced/delegation-engine`
- lane-local pack manifest under `packs/advanced/delegation`
- capability defaults and policy contract
- result-envelope generator
- tests proving boundaries
- docs that do not over-claim runtime support

Not included:

- runtime spawning
- CLI integration
- installer integration
- doctor integration
- lint-bridge integration
- compat-lab live delegation lane

## Go/No-Go Recommendation

Current recommendation: `scaffold only`.

Go for this slice:

- package-local policy and envelope scaffold
- manifest and docs outside core discovery
- tests proving “disabled by default” and “no authority expansion”

No-go for now:

- anything that touches core discovery or install path
- any claim of broad runtime-native delegation support
- any write-capable worker lane
