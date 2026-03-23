# PairSlash Phase 2 -- Runtime Verification

Run this checklist manually in live CLI sessions to verify runtime surface parity.

This page is for live runtime evidence after install. Do not use it as the
primary install guide; use `docs/workflows/install-guide.md` first.

## Before you start

- Complete the target runtime path in `docs/workflows/install-guide.md`
- Launch the CLI from repo root
- Keep `docs/compatibility/compatibility-matrix.md` open so support claims stay aligned with recorded evidence
- If a surface is unverified or blocked, record that honestly instead of upgrading documentation claims

## Codex CLI

1. Install all 7 skills to `.agents/skills/`.
2. Launch Codex CLI in repo root.
3. Use `/skills` and verify all 7 skills appear.
4. Invoke:
   - `$pairslash-plan`
   - `$pairslash-memory-candidate`
   - `$pairslash-memory-write-global`
   - `$pairslash-memory-audit`
5. Confirm:
   - read workflows do not write `.pairslash/project-memory/`
   - write-global shows preview patch before any write
   - write-global requires explicit acceptance
6. Record outcomes before editing any support statement elsewhere in docs.

## GitHub Copilot CLI

1. Install all 7 skills to `.github/skills/`.
2. Launch Copilot CLI in repo root.
3. Run `/skills list` and verify all 7 skills appear.
4. Invoke:
   - `/pairslash-plan`
   - `/pairslash-memory-candidate`
   - `/pairslash-memory-write-global`
   - `/pairslash-memory-audit`
5. Confirm same memory-safety semantics as Codex CLI.
6. Record outcomes before editing any support statement elsewhere in docs.

## Record results

Update:

- `docs/compatibility/acceptance-gates.yaml`
- `docs/compatibility/runtime-surface-matrix.yaml`
- `docs/compatibility/compatibility-matrix.md` only if the recorded support level actually changed
