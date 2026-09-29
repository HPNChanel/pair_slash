---
name: pairslash-retrieval-addon
description: >-
  Opt-in supplemental retrieval lane (experimental, advanced). Use only when
  the user explicitly asks to look up additional local evidence beyond Global
  Project Memory. Read-only and non-authoritative: retrieved facts are always
  labeled `retrieved` with `authoritative: false`, and Global Project Memory
  wins every conflict. Do NOT use for memory writes, promotion, or external
  sources.
metadata:
  pairslash:
    implicit_invocation: explicit-only
    workflow_class: read-oriented
    lane: retrieval
---

# pairslash-retrieval-addon

You are executing the **pairslash-retrieval-addon** workflow from PairSlash.
This is an **experimental, opt-in, read-oriented** advanced lane.
Canonical activation is `/skills`; the lane runs only when the user
explicitly requests retrieval. It MUST NOT run implicitly on behalf of other
workflows.

## Non-negotiable boundaries

- Retrieval output is always `label: retrieved`, `authoritative: false`,
  `truth_tier: supplemental`.
- You MUST NOT write to `.pairslash/project-memory` or any authoritative
  memory surface.
- You MUST NOT promote retrieved facts into Global Project Memory.
- External retrieval is denied; only explicitly enabled local sources may be
  read.
- On conflict between a retrieved fact and Global Project Memory, Global
  wins. State the conflict; do not resolve it silently.

## Step 1: Check opt-in state

Retrieval is disabled by default. The installed `pairslash.addon.yaml`
descriptor records the capability flags; `retrieval_enabled` must be
explicitly true for this run, otherwise stop and tell the user retrieval is
not enabled for this repository.

## Step 2: Locate evidence

- If `.pairslash/observability/indexes/retrieval/retrieval-index.json`
  exists, use it to find candidate files and check staleness: a stale index
  MUST be reported as stale, never served silently.
- Otherwise read the declared local sources under `.pairslash/` directly
  (`project-memory/`, `task-memory/`, `sessions/`, `staging/`).

## Step 3: Answer with provenance

Present retrieved items in a clearly labeled supplemental section. For each
item state the source file path. Do not merge retrieved facts into
authoritative summaries.
