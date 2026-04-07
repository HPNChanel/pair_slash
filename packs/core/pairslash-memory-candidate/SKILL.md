---
name: pairslash-memory-candidate
description: >-
  Extract durable fact candidates from task/session/repo evidence for possible
  promotion into PairSlash Global Project Memory. This workflow is read-oriented
  and must reconcile candidates against existing project-memory records before
  classification. Use when you need candidate triage with strict gates and
  deterministic output. Do NOT use this workflow to write authoritative memory.
---

# pairslash-memory-candidate

You are executing the **pairslash-memory-candidate** workflow from PairSlash.
This is a **candidate-producing** workflow with **read-only memory behavior**.

## Hard rules

1. NEVER write to `.pairslash/project-memory/`.
2. NEVER promote candidates implicitly.
3. NEVER create a candidate without concrete evidence.
4. ALWAYS reconcile against `.pairslash/project-memory/` before classification.
5. If evidence or reconciliation is insufficient, fail fast.

---

## Step 1: Resolve extraction scope

Read the user request and define `task_scope`.
If no concrete scope exists, ask for it and stop.

## Step 2: Load evidence sources

Resolve memory context in this precedence order:

1. `.pairslash/project-memory/90-memory-index.yaml`
2. Active authoritative records in `.pairslash/project-memory/`
3. `.pairslash/task-memory/`
4. `.pairslash/sessions/`
5. `.pairslash/staging/`
6. `.pairslash/audit-log/`
7. Relevant docs/specs/logs mentioned by the task

Track each evidence item with a concrete source anchor
(file path plus line/section identifier when available).

Resolution rules:

- Global Project Memory is authoritative on read.
- `.pairslash/task-memory/`, `.pairslash/sessions/`, `.pairslash/staging/`,
  and `.pairslash/audit-log/` are supporting layers only.
- Lower layers may fill missing context when no matching Global claim exists.
- Lower layers must not silently override Global Project Memory.
- If a lower-layer claim contradicts an active Global claim, surface that
  contradiction in `RECONCILIATION` and classify it as
  `needs-supersede-review` or `duplicate-existing`, never as an authoritative
  override.

## Step 3: Derive fact claims

Extract only claims that are:

- explicit in evidence,
- stable enough to be reused,
- relevant to project-level memory categories.

Do not infer missing facts. Do not paraphrase into stronger claims than the source.

## Step 4: Reconcile each claim with authoritative memory

For each claim, compare against active project-memory records and classify:

- `keep-as-candidate`
- `duplicate-existing`
- `needs-supersede-review`
- `too-weak-do-not-promote`

Also assign:

- `novelty`: `new | duplicate | supersede-candidate`
- `confidence`: `low | medium | high`

## Step 5: Apply strict gates

Enforce all gates below:

- Missing evidence -> `too-weak-do-not-promote`
- Reconciliation not performed -> no `keep-as-candidate` allowed
- Contradiction with active memory -> `needs-supersede-review`
- Semantic match with active memory -> `duplicate-existing`

If most claims are weak or unreconciled, choose `REJECT_CANDIDATES` as next action.

## Step 6: Produce deterministic report

Output exactly four sections in this order:

1. `## PLAN`
2. `## CANDIDATES`
3. `## RECONCILIATION`
4. `## NEXT_ACTION`

Each candidate must include all fields:

- `id`
- `kind`
- `title`
- `statement`
- `scope`
- `evidence`
- `confidence`
- `novelty`
- `classification`
- `reason_to_promote`
- `reason_not_to_promote_yet`
- `target_file_hint`

`NEXT_ACTION` must be exactly one of:

- `USE_PAIRSLASH_MEMORY_WRITE_GLOBAL`
- `KEEP_IN_TASK_MEMORY`
- `REJECT_CANDIDATES`

## Step 7: Final consistency check

Before returning output, verify:

- each candidate has at least one concrete evidence entry,
- classification matches novelty/reconciliation,
- duplicates and supersede candidates are listed in RECONCILIATION,
- NEXT_ACTION is consistent with candidate quality.

If any check fails, report the failure explicitly instead of returning partial success.
