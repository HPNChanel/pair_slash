# PairSlash Phase 2 Operations

This page is for maintainers validating a local PairSlash checkout after
install. Use it for the done bar, validation commands, memory-write safety
gates, and common operational failures.

## If you are trying to...

- Install or reinstall skills: use `docs/workflows/install-guide.md`
- Check whether a runtime surface is actually supported: use `docs/compatibility/compatibility-matrix.md`
- Run live CLI verification and record evidence: use `docs/compatibility/runtime-verification.md`
- Understand why `charter` and `stack-profile` are separate: use `docs/architecture/adr-0001-legacy-project-memory-system-records.md`

## Done bar checklist

Use this checklist after install to decide if local Phase 2 is operationally complete.

- [ ] Architecture boundaries enforced (authoritative-first, explicit-write-only).
- [ ] Seven core workflows exist and have contracts.
- [ ] Memory model contains canonical directories and files.
- [ ] `pairslash-memory-write-global` path supports preview, acceptance, audit, index update.
- [ ] Doctor/lint/schema/fixture/golden checks pass.
- [ ] Docs align with shipped workflows and runtime boundary.

## Local validation commands

```bash
python scripts/phase2_checks.py --all
python -m unittest discover -s tests -p "test_*.py"
```

Both commands should pass before treating the local checkout as operationally ready.

## Memory-write safety gates

`pairslash-memory-write-global` is considered safe only when all are true:

1. Input contract complete.
2. Request is for a mutable record kind, not `charter` / `stack-profile`.
3. Duplicate/conflict/scope checks run.
4. Preview patch shown before write.
5. Explicit acceptance captured.
6. Authoritative file write occurs after acceptance only.
7. Index updated.
8. Audit log appended.

Treat any missing gate as a hard stop, not a warning.

## Common failure modes

- **Schema drift** (`charter` / `stack-profile`):
  validate these with `system-record.schema.yaml`, not mutable schema, and keep
  their index entries marked `record_family: system` with
  `schema_version: pre-0.1.0`.
- **System record write request**:
  reject from `pairslash-memory-write-global`; system records stay outside the
  mutable write-authority path.
- **Missing commands/glossary/ownership files**:
  ensure `20-commands.yaml`, `30-glossary.yaml`, `40-ownership.yaml` exist.
- **Source/derived drift**:
  treat `packs/core/` as source-of-truth; reinstall into runtime paths after updates.
- **Weak evidence in candidates**:
  keep in task/session memory; do not promote until evidence is concrete.
- **Unsure which doc is current**:
  use `README.md` for entry, this page for operations, and treat Phase 0 docs as archival only.
