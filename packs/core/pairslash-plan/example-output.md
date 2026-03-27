# pairslash-plan -- Example Output

## Goal
Harden Phase 2 memory workflows with deterministic validation gates.

## Constraints
- [from memory: 00-project-charter.yaml] PairSlash supports only Codex CLI and GitHub Copilot CLI.
- [from memory: 00-project-charter.yaml] Canonical entrypoint is `/skills`.
- [from memory: 50-constraints.yaml] Avoid complex PowerShell command patterns in Codex read-only context.

## Relevant project memory
- 00-project-charter.yaml
- 10-stack-profile.yaml
- 50-constraints.yaml
- 90-memory-index.yaml

## Proposed steps
1. Add missing workflow specs and packs for review/onboard/command-suggest/memory-audit.
2. Add dual-schema handling for system records and mutable records.
3. Implement doctor/lint/schema/fixture/golden checks in Node.js.
4. Add regression tests and CI gate.
5. Update docs and acceptance gates.

## Files likely affected
- packs/core/
- packages/core/spec-core/
- scripts/
- docs/
- .pairslash/project-memory/

## Tests and checks
- npm run lint
- npm run test

## Risks
- Drift between source packs and installed runtime copies.
- Historical Phase 0 docs can mislead if not marked archived.

## Rollback
1. Revert changed files in git.
2. Re-run checks to confirm baseline state.
3. Reinstall skills from packs/core after rollback if needed.

## Open questions
- [I assumed] Runtime-specific direct invocation syntax remains secondary to `/skills`.
