# pairslash-command-suggest -- Example Output

## INTENT_SUMMARY
- intent: Run all Phase 2 validation checks
- platform: windows

## SUGGESTED_COMMANDS
- command: `npm run lint`
  rationale: Runs doctor, lint, schema checks, fixture checks, and golden checks.
  source_memory: .pairslash/project-memory/50-constraints.yaml
  confidence: high
- command: `npm run test`
  rationale: Executes deterministic local regression tests.
  source_memory: maintainer-local operations workflow notes
  confidence: high

## SAFETY_NOTES
- Avoid destructive git operations during validation.
- Run commands from repository root.

## NEXT_WORKFLOW
- pairslash-review
