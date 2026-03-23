# pairslash-command-suggest -- Example Output

## INTENT_SUMMARY
- intent: Run all Phase 2 validation checks
- platform: windows

## SUGGESTED_COMMANDS
- command: `python scripts/phase2_checks.py --all`
  rationale: Runs doctor, lint, schema checks, fixture checks, and golden checks.
  source_memory: .pairslash/project-memory/50-constraints.yaml
  confidence: high
- command: `python -m unittest discover -s tests -p \"test_*.py\"`
  rationale: Executes deterministic local regression tests.
  source_memory: docs/workflows/phase-2-operations.md
  confidence: high

## SAFETY_NOTES
- Avoid destructive git operations during validation.
- Run commands from repository root.

## NEXT_WORKFLOW
- pairslash-review

