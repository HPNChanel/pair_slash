---
title: Core PairSlash vs Advanced Optional Lanes
phase: 11
status: experimental-docs
owner_file: docs/phase-11/core-vs-advanced.md
baseline_source: docs/phase-11/advanced-optional-lane-charter.md
---

# Core PairSlash vs Advanced Optional Lanes

## Core PairSlash

Core PairSlash is the story every new user should see first.

Core scope:

- exactly two runtimes: Codex CLI and GitHub Copilot CLI
- `/skills` as the canonical front door
- wedge workflows in `packs/core/*`
- explicit-write-only Global Project Memory
- doctor, preview, install, support, and compatibility flows

Core docs:

- [README](../../README.md)
- [Phase 9 Public Docs Index](../phase-9/README.md)
- [Onboarding Path](../phase-9/onboarding-path.md)
- [Compatibility Matrix](../compatibility/compatibility-matrix.md)
- [Workflow Docs](../workflows/)

What core docs must do:

- explain why install
- show the first 90 seconds
- show wedge workflow order
- show support reality and failure/support path

## Advanced Optional Lanes

Advanced Optional Lanes are a separate doc surface for non-core, explicit,
capability-gated experiments.

Advanced scope:

- Retrieval
- CI Agents / Runners
- Delegation / Subagents

Advanced docs:

- [Phase 11 Index](README.md)
- [Advanced Optional Lane Charter](advanced-optional-lane-charter.md)
- [Retrieval Lane](retrieval-lane.md)
- [CI Lane](ci-lane.md)
- [Delegation Lane](delegation-lane.md)

What advanced docs must do:

- say `experimental` immediately
- say `opt-in` immediately
- say `outside core install/discovery path`
- state support level, prerequisites, and risk explicitly
- keep trust-boundary rules visible

## Public Docs Rules

- The root README may link to Phase 11 once as an advanced side path, but it
  must not add advanced install or usage steps.
- `docs/phase-9/*` stays core-only and must not lead with advanced lanes.
- Advanced lanes must not appear in the first-run onboarding path.
- Advanced lanes must not redefine the wedge workflow story.
- Advanced lanes must not create a new front door beside `/skills`.
- Advanced docs must not imply broad support beyond live evidence in
  compatibility and runtime-verification docs.

## Review Checklist

Use this checklist before merging public-doc changes:

- Would a new user still understand PairSlash without reading Phase 11?
- Does the first-run path still mention only core workflows?
- Is every advanced page labeled `experimental`, `opt-in`, and `non-core`?
- Is every runtime/support claim backed by live evidence?
- Does any sentence make advanced lanes sound like the default product path?

If the answer to the last question is yes, cut or rewrite the sentence.
