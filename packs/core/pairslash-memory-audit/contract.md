# pairslash-memory-audit -- Workflow Contract

**Version:** 0.1.0  
**Phase:** 2  
**Class:** audit (read-oriented default)

## Purpose

Audit Global Project Memory quality and maintainability with explicit findings.

## Input contract

Required:

- `audit_scope` (`full|project-memory-only|index-only`)

Optional:

- `mode` (`report-only` default, `fix-proposal`)
- `focus` (list of check categories)

## Output contract

Required sections:

1. PLAN
2. FINDINGS
3. SUMMARY
4. REMEDIATION_ORDER
5. NEXT_ACTION

Finding fields:

- id
- severity
- type
- file_or_record
- explanation
- evidence
- recommended_fix
- write_workflow_needed

## Failure contract

- Unreadable memory paths -> partial report with explicit missing evidence.
- Schema uncertainty -> emit schema-drift finding; do not fabricate pass.
- report-only mode -> no mutating steps.

## Memory contract

- Reads project-memory, task-memory, audit-log.
- Writes none by default.
- Mutation requires explicit handoff to `pairslash-memory-write-global`.

## Side-effect contract

- Filesystem writes: none (report-only)
- Git mutation: none (report-only)
- Network calls: none

