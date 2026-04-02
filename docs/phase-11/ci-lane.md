# CI Lane

Status: prototype-slice (advanced optional, non-core)
Phase: 11
Public release label: experimental
Runtime support expectation: design-only
Core install impact: none
Risk boundary: report-first and artifact-first only; no direct write authority

## Problem Framing

CI lane exists to increase verification throughput without weakening local
trust boundaries.

This lane may produce report artifacts and patch proposals.
This lane may not become a backdoor for commit, merge, or memory authority.

## Non-Negotiable Invariants

- explicit opt-in only
- report-first and artifact-first
- no direct commit or merge by default
- no direct Global Project Memory write
- no hidden write and no implicit promote
- no change to `/skills` as core front door
- no change to core install/discovery path

## Safe Operating Model

- lane package lives under `packages/advanced/ci-engine`
- lane pack lives under `packs/advanced/ci`
- both are excluded from core discovery and workspace defaults
- invocation must be explicit and repo policy must be explicit
- output defaults to report and optional patch artifact proposal

## Capability Model

- `ci_lane_enabled`: hard off by default
- `ci_plan_only`: true by default
- `ci_generate_patch_artifact`: false by default
- `ci_no_direct_memory_write`: true and enforced
- `ci_no_direct_repo_commit_default`: true and enforced
- `ci_requires_explicit_repo_policy`: true and enforced

## Policy Matrix (Default)

| Action | Verdict |
| --- | --- |
| `ci.read_repo` | allow |
| `ci.run_checks` | allow |
| `ci.generate_diff` | allow |
| `ci.attach_artifact` | allow |
| `ci.open_pr_comment` | ask |
| `ci.commit` | deny |
| `ci.merge` | deny |
| `ci.write_task_memory_candidate` | require-preview |
| `ci.write_global_memory` | deny |

## Provenance and Evidence Tier

Every CI output must include:

- `ci_run_id`
- `repo_snapshot_ref`
- `runtime`
- `execution_context`
- `source_pack_id`
- `lane_package_version`
- `policy_verdict`
- `capability_flags`
- `trigger_type`
- `shim_status`
- `live_evidence`
- `evidence_tier`

Fake-vs-live distinction:

- `evidence_tier: deterministic-simulated` for shim/unknown runtime evidence
- `evidence_tier: live-disposable` only when live evidence is explicitly
  declared and no shim is involved

Until live runtime evidence is strong enough, CI lane must not over-claim broad
runtime support.

## Deferred Scope

- no CI vendor integration
- no direct PR comment posting by default
- no direct repo mutation
- no direct memory authority
- no public broad support claims
