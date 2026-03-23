# pairslash-memory-audit -- Example Output

## PLAN
- audit_scope: full
- files_to_check: .pairslash/project-memory/, .pairslash/audit-log/
- audit_focus: duplicate, schema-drift, index-gap
- expected_risks: stale records, orphan refs

## FINDINGS
- id: F-001
  severity: medium
  type: schema-drift
  file_or_record: 00-project-charter.yaml
  explanation: Record uses system schema kind not covered by mutable memory-record schema.
  evidence: packages/spec-core/schemas/memory-record.schema.yaml
  recommended_fix: Validate with dedicated system-record schema.
  write_workflow_needed: no

## SUMMARY
- total_findings: 1
- critical_count: 0
- quick_wins: add dual-schema validator rule
- hard_cases: cross-record semantic conflict detection

## REMEDIATION_ORDER
1. Add/enable system-record schema validation.
2. Re-run audit after schema checks pass.
3. Escalate unresolved semantic conflicts via ADR.

## NEXT_ACTION
- KEEP_AS_REPORT

