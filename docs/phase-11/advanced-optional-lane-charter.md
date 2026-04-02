---
title: Advanced Optional Lane Charter
phase: 11
status: experimental-docs
owner_file: docs/phase-11/advanced-optional-lane-charter.md
baseline_source: docs/phase-11/README.md
---

# Advanced Optional Lane Charter

## Charter

PairSlash core remains the main product story.
Phase 11 exists only to define advanced optional lanes that stay outside the
core install path, outside the default onboarding story, and outside the
authoritative memory boundary.

Allowed problem shape:

- Retrieval lowers context lookup cost without becoming project truth.
- CI lanes increase verification throughput without inheriting write authority.
- Delegation reduces bounded analysis load without losing caller control.

Non-negotiable invariants:

- `/skills` remains the canonical front door.
- Global Project Memory remains authoritative memory.
- No hidden write, no implicit promote, no silent delegation.
- Advanced lanes never become required for core workflows.
- Advanced lanes never rescue weak wedge proof or weak runtime evidence.

## Capability Matrix

| Lane | Default state | Required opt-in point | Read scopes | Write scopes | Memory interaction | Runtime support expectation | Release claim level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Retrieval | disabled | explicit lane invocation plus `retrieval_enabled` | declared local repo roots, local docs snapshots, local artifact indexes | none | supplemental hints only; Global Memory wins every conflict | `design-only` until live evidence exists | `experimental` (`prototype-slice`) |
| CI Agents / Runners | disabled | explicit lane invocation plus `ci_lane_enabled` and explicit repo policy | repo files, manifests, checks, validation inputs | report and proposal artifacts only; no commit/merge by default | no direct Global Memory write; candidate paths stay preview-gated | `design-only` until live evidence exists | `experimental` (`prototype-slice`) |
| Delegation / Subagents | disabled | explicit caller-approved delegation plus `delegation_lane_enabled` | strict subset of caller scope only | none in safe MVP; proposal-only follow-up stays separate from apply | delegated output is non-authoritative; no direct task/global-memory write | `design-only` until live evidence exists | `experimental` (`scaffold-only`) |

## Docs Architecture

### Core PairSlash

Core docs remain the default public surface:

- root `README.md`
- `docs/phase-9/*`
- `docs/workflows/*`
- `docs/compatibility/*`
- `docs/support/*`
- `packs/core/*`

Core docs own:

- first-run onboarding
- wedge workflow narrative
- support reality and runtime claims
- doctor/support escalation path

### Advanced Optional Lanes

Advanced docs stay isolated:

- `docs/phase-11/*`
- `packages/advanced/README.md`
- `packs/advanced/README.md`

Advanced docs must always state:

- this is `experimental`
- this is `opt-in`
- this is `non-core`
- prerequisites and risk
- support level and evidence limit

Public-doc rules:

- Do not let a new user mistake advanced lanes for core PairSlash.
- Do not let the root README or Phase 9 docs lead with advanced lanes.
- Do not add advanced install/use steps to the first-run path.
- Do not present advanced lanes as a competing front door beside `/skills`.

## KPI And Benchmark Plan

KPI set for Phase 11:

- `opt-in activation rate`
  Only a secondary adoption signal.
  It must not justify shipping if core wedge proof is weak.
- `advanced lane failure containment rate`
  Target: failures stay inside the advanced lane and do not break core install,
  core workflows, or authoritative memory.
- `no-core-install-regression`
  Target: no root workspace expansion, no `packs/core` discovery change, no
  core install-path regression.
- `no-hidden-write violation count`
  Target: `0`.
- `false-confidence / fake-success rate`
  Target: `0` unlabeled shim or simulated success claims in public docs.

Benchmark plan:

- Retrieval usefulness without authority confusion
  Run paired baseline vs retrieval-assisted lookup on the same repo snapshot.
  Measure usefulness, time-to-first-useful-context, and authority-confusion
  incidents. Any case where retrieved output is mistaken for project truth is a
  failure.
- CI artifact usefulness without unsafe write
  Run paired baseline vs CI artifact/report generation on the same repo
  snapshot. Measure whether the report or patch proposal is actionable while
  confirming zero direct commit, merge, or global-memory write.
- Delegation utility without control loss
  Run paired baseline vs bounded delegated analysis on the same task. Measure
  time saved, envelope quality, and zero silent chain spawning or authority
  expansion.

## Release Labeling Recommendation

Public release labels should be:

- Core PairSlash:
  supported product story governed by `stable-tested`, `degraded`, `prep`, and
  `known-broken` in the compatibility matrix.
- Advanced Optional Lanes umbrella:
  `experimental`, non-core, opt-in, capability-gated.
- Retrieval:
  `experimental` public label, `prototype-slice` internal maturity.
- CI:
  `experimental` public label, `prototype-slice` internal maturity.
- Delegation:
  `experimental` public label, `scaffold-only` internal maturity.

Labeling rules:

- Do not use advanced lane maturity to imply runtime support.
- Do not use deterministic or shim evidence as a broad public support claim.
- Every advanced page must show risk, prerequisites, and support level near the
  top of the page.

## Experimental/Stable Gating

### When Not To Ship Phase 11

Do not ship Phase 11 if any of the following is true:

- unresolved core gaps remain in wedge workflows or authoritative memory
- memory load order still lacks enough proof
- any hidden-write or implicit-promote violation exists
- any change is required to root workspaces, `packs/core`, or core install flow
- public docs drift makes advanced lanes look like the default story

### When Phase 11 Stays Experimental Only

Keep Phase 11 experimental when:

- runtime evidence is still simulated, shim-based, or incomplete
- compat-lab coverage is deterministic only and not backed by live runtime use
- lane usefulness is visible but failure containment is not yet proven
- a lane still depends on manual interpretation to avoid trust-boundary leaks

### Stable-Candidate Gate

No advanced lane should be considered for stable labeling until:

- live runtime evidence exists for every claimed lane/runtime combination
- failure containment is proven in tests and release checks
- hidden-write and false-confidence counts remain at `0`
- core install and core docs stay unchanged when the lane is absent

## Final Rollout Recommendation

Ship the docs split and the umbrella charter now.
Keep the product narrative core-first.

Recommended current posture:

- Retrieval: `experimental`, prototype slice, outside core install/discovery
- CI: `experimental`, prototype slice, outside core install/discovery
- Delegation: `experimental`, scaffold-only, outside core install/discovery

Do not move any Phase 11 lane into the default install path, default README
story, or broad runtime support claims until the stable-candidate gate passes.
