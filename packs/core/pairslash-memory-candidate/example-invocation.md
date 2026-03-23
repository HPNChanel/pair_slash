# pairslash-memory-candidate -- Example Invocations

This document shows representative invocation patterns for the candidate
extractor workflow.

---

## Codex CLI (canonical flow)

```text
/skills
```

Select `pairslash-memory-candidate`, then provide:

```text
task_scope: Phase 2 candidate extraction from current session
strictness: strict-gate-fail-fast
evidence_sources:
  - .pairslash/task-memory/
  - .pairslash/sessions/
  - .pairslash/audit-log/
```

---

## Codex CLI (direct)

```text
$pairslash-memory-candidate
```

Prompt content:

```text
Extract durable memory candidates from this session.
Use strict-gate-fail-fast.
Reconcile against .pairslash/project-memory before classification.
```

---

## GitHub Copilot CLI (direct prompt)

```text
Use /pairslash-memory-candidate to extract candidate facts from task artifacts.
Do not write to project-memory. Output PLAN, CANDIDATES, RECONCILIATION, NEXT_ACTION.
```

---

## Expected behavior checks

- Output has exactly 4 required sections.
- Every candidate has concrete evidence source anchors.
- Duplicate facts are labeled `duplicate-existing`.
- Conflicts are labeled `needs-supersede-review`.
- Weak claims are labeled `too-weak-do-not-promote`.
- No write occurs in `.pairslash/project-memory/`.
