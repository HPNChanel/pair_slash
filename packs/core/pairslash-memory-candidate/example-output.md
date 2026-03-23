# pairslash-memory-candidate -- Example Output

This sample demonstrates strict extraction behavior with deterministic sections.

---

## PLAN

- task_scope: Phase 2 candidate extraction from current session findings
- evidence_sources:
  - .pairslash/project-memory/90-memory-index.yaml
  - .pairslash/audit-log/
  - docs/compatibility/acceptance-gates.yaml
- candidate_count_estimate: 3
- risk_notes:
  - Session artifacts are sparse; confidence may be capped at medium.
  - Some findings may duplicate existing authoritative records.

## CANDIDATES

- id: C1
- kind: pattern
- title: Candidate extraction must reconcile with authoritative memory first
- statement: Candidate extraction should reconcile every claim against active project-memory records before proposing promotion.
- scope: subsystem
- evidence:
  - CLAUDE.md section 6.2 hard memory ordering
  - .pairslash/project-memory/90-memory-index.yaml active record check
- confidence: high
- novelty: new
- classification: keep-as-candidate
- reason_to_promote: Reusable workflow guardrail across candidate-producing flows.
- reason_not_to_promote_yet: Needs repeated validation on additional sessions.
- target_file_hint: .pairslash/project-memory/70-known-good-patterns/

- id: C2
- kind: constraint
- title: Global memory is authoritative and must not be silently overridden
- statement: Session and task facts cannot override Global Project Memory without explicit write-authority flow.
- scope: whole-project
- evidence:
  - CLAUDE.md section 6.2
  - .pairslash/project-memory/00-project-charter.yaml
- confidence: high
- novelty: duplicate
- classification: duplicate-existing
- reason_to_promote: None.
- reason_not_to_promote_yet: Already represented in authoritative memory.
- target_file_hint: .pairslash/project-memory/50-constraints.yaml

- id: C3
- kind: decision
- title: Output format from one ad hoc prompt should become global policy
- statement: The exact four-section output template from this prompt should be mandatory project-wide.
- scope: subsystem
- evidence:
  - Current session prompt only
- confidence: low
- novelty: new
- classification: too-weak-do-not-promote
- reason_to_promote: Could improve consistency.
- reason_not_to_promote_yet: Single-source prompt-local evidence only.
- target_file_hint: .pairslash/staging/

## RECONCILIATION

- existing_records_checked:
  - .pairslash/project-memory/90-memory-index.yaml
  - .pairslash/project-memory/50-constraints.yaml
  - .pairslash/project-memory/70-known-good-patterns/codex-exec-as-non-interactive-skill-testing-surface.yaml
- duplicates_found:
  - C2 duplicates whole-project memory ordering constraints
- supersede_review_needed:
  - None
- missing_evidence:
  - C3 has only prompt-local evidence and no cross-source support

## NEXT_ACTION

- KEEP_IN_TASK_MEMORY
