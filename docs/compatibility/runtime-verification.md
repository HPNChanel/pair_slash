# PairSlash Runtime Verification

Run this checklist in live CLI sessions to validate runtime support claims.

This page verifies runtime behavior after managed install. Do not use it as the
primary install path. Use `docs/workflows/install-guide.md` first.

## Before you start

- Complete managed install for the target lane.
- Launch the runtime from repo root.
- Keep `docs/compatibility/compatibility-matrix.md` open so support claims stay
  aligned with recorded evidence.
- If a surface is unverified or blocked, record that directly.

## Codex CLI

1. Run `/skills`.
2. Verify target skills are visible.
3. Select `pairslash-plan` and run a basic plan prompt.
4. Select `pairslash-memory-write-global` and verify write-authority flow:
   - preview patch appears before write
   - explicit user acceptance is required
   - no hidden writes occur
5. Confirm read workflows do not write `.pairslash/project-memory/`.

## GitHub Copilot CLI

1. Run `/skills`.
2. Verify target skills are visible.
3. Select `pairslash-plan` and run a basic plan prompt.
4. Select `pairslash-memory-write-global` and verify the same write-authority
   controls as Codex lane.
5. Confirm read workflows do not write `.pairslash/project-memory/`.

## Record results

Update:

- `docs/compatibility/acceptance-gates.yaml`
- `docs/compatibility/runtime-surface-matrix.yaml`
- `docs/compatibility/compatibility-matrix.md` only when evidence supports the change
