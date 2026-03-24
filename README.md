# pair_slash

PairSlash is an OSS slash-triggered workflow kit for exactly two runtimes:

- Codex CLI
- GitHub Copilot CLI

Canonical entrypoint: `/skills`.

## Start here

If you are evaluating or operating PairSlash from this repo, use this order:

1. Install skills for your runtime with the [manual install guide](docs/workflows/install-guide.md).
2. For managed installs, use the [Phase 4 install commands](docs/workflows/phase-4-install-commands.md).
3. Run the local validation commands in [Phase 2 operations](docs/workflows/phase-2-operations.md).
4. Use the [compatibility matrix](docs/compatibility/compatibility-matrix.md) and
   [runtime verification guide](docs/compatibility/runtime-verification.md) before
   claiming runtime support.
5. Use the [legacy system records ADR](docs/architecture/adr-0001-legacy-project-memory-system-records.md)
   for architecture rationale, not the archived Phase 0 docs.

## Current status

- Version: `0.4.0`
- Phase: **Phase 4 runtime-native distribution and installability**
- Focus: one-spec-two-runtimes pack manifests, deterministic compiler v2, managed install/update/uninstall lifecycle, doctor verdicts, and bridge lint/compat-lab coverage

## What ships in this repo

- Constitution: `CLAUDE.md`
- Global memory and audit trail: `.pairslash/`
- Source workflow packs: `packs/core/`
- Source specs/schemas: `packages/spec-core/`
- Phase 4 packages: `packages/cli/`, `packages/compiler-codex/`, `packages/compiler-copilot/`, `packages/installer/`, `packages/doctor/`, `packages/compat-lab/`
- Validation tooling: `scripts/phase2_checks.py`
- Fixtures and regression tests: `tests/`

## Choose your path

- Install or reinstall skills: [docs/workflows/install-guide.md](docs/workflows/install-guide.md)
- Managed Phase 4 install commands: [docs/workflows/phase-4-install-commands.md](docs/workflows/phase-4-install-commands.md)
- Validate a local checkout and memory-write safety gates: [docs/workflows/phase-2-operations.md](docs/workflows/phase-2-operations.md)
- Check what runtime behavior is actually supported: [docs/compatibility/compatibility-matrix.md](docs/compatibility/compatibility-matrix.md)
- Run live CLI verification and record evidence: [docs/compatibility/runtime-verification.md](docs/compatibility/runtime-verification.md)
- Understand dual-schema system-record handling: [docs/architecture/adr-0001-legacy-project-memory-system-records.md](docs/architecture/adr-0001-legacy-project-memory-system-records.md)
- Read archived Phase 0 material only for historical trace: `docs/architecture/phase-0-overview.md`, `docs/compatibility/phase-0-acceptance.md`

## Core rules

- Only two runtimes are in scope: Codex CLI + Copilot CLI.
- `/skills` is canonical; direct invocation is secondary.
- Global Project Memory is authoritative.
- Read workflows must not mutate Global Memory.
- `pairslash-memory-write-global` is the only write-authority workflow.
- Global memory writes require preview patch + explicit acceptance + audit log + index update.
- Legacy system records (`charter`, `stack-profile`) stay outside the mutable
  write-authority path.

## Included workflows (core)

- `pairslash-plan` (read-oriented)
- `pairslash-review` (read-oriented)
- `pairslash-onboard-repo` (read-oriented)
- `pairslash-command-suggest` (read-oriented, advisory)
- `pairslash-memory-candidate` (candidate-producing, read-only)
- `pairslash-memory-write-global` (write-authority)
- `pairslash-memory-audit` (audit, read-oriented default)

## Global memory layout

```text
.pairslash/
  project-memory/
    00-project-charter.yaml
    10-stack-profile.yaml
    20-commands.yaml
    30-glossary.yaml
    40-ownership.yaml
    50-constraints.yaml
    60-architecture-decisions/
    70-known-good-patterns/
    80-incidents-and-lessons/
    90-memory-index.yaml
  task-memory/
  sessions/
  audit-log/
  staging/
```

Notes:

- `project-memory/` is authoritative.
- `task-memory/` and `sessions/` are non-authoritative.
- `audit-log/` is append-only write history.

## Install

- Managed install path (Phase 4): use [docs/workflows/phase-4-install-commands.md](docs/workflows/phase-4-install-commands.md)
- Manual copy fallback: use [docs/workflows/install-guide.md](docs/workflows/install-guide.md)
- Codex CLI install path: copy source packs from `packs/core/` into `.agents/skills/` using the [manual install guide](docs/workflows/install-guide.md).
- GitHub Copilot CLI install path: copy source packs from `packs/core/` into `.github/skills/` using the [manual install guide](docs/workflows/install-guide.md).
- Windows PowerShell examples and post-install verification live in [docs/workflows/install-guide.md](docs/workflows/install-guide.md).

## Validation and done bar

Run from repo root:

```bash
python scripts/phase2_checks.py --all
python -m unittest discover -s tests -p "test_*.py"
npm run lint:phase4
npm run test:phase4
npm run test:phase4:release
```

Both commands must pass for local “Phase 2 done” checks.

After validation passes, continue to [Phase 2 operations](docs/workflows/phase-2-operations.md)
for the operational done bar and memory-write safety gates.

## Docs

- Phase 2 operations: `docs/workflows/phase-2-operations.md`
- Install guide: `docs/workflows/install-guide.md`
- Phase 4 install commands: `docs/workflows/phase-4-install-commands.md`
- Phase 4 doctor troubleshooting: `docs/workflows/phase-4-doctor-troubleshooting.md`
- Compatibility matrix: `docs/compatibility/compatibility-matrix.md`
- Runtime verification: `docs/compatibility/runtime-verification.md`
- Phase 3 team-pack release notes: `docs/releases/phase-3-team-pack-update.md`
- Changelog draft: `docs/releases/changelog-0.2.0.md`
- Upgrade notes: `docs/releases/upgrade-notes-0.2.0.md`
- Release checklist: `docs/releases/release-checklist-0.2.0.md`
- Phase 4 release checklist: `docs/releases/release-checklist-0.4.0.md`
- Acceptance gates: `docs/compatibility/acceptance-gates.yaml`
- ADR (legacy system records): `docs/architecture/adr-0001-legacy-project-memory-system-records.md`
- Phase 4 architecture note: `docs/architecture/phase-4-runtime-native-distribution.md`
- Archived Phase 0 overview: `docs/architecture/phase-0-overview.md`

## Migration notes

- Legacy system records (`charter`, `stack-profile`) are kept under dual-schema handling.
- Mutable authoritative records remain under `memory-record.schema.yaml` and write-authority pipeline.
- `pairslash-memory-write-global` does not write system records.
- Runtime install folders (`.agents/skills/`, `.github/skills/`) are derived artifacts; source-of-truth is `packs/core/`.

## Troubleshooting (common)

- Missing Python dependency errors: run with Python 3.11+ and install required libs listed by `phase2_checks.py`.
- Schema drift findings for `charter`/`stack-profile`: verify `system-record.schema.yaml` and index `record_family`.
- System-record write request: `pairslash-memory-write-global` only accepts mutable kinds; do not route `charter`/`stack-profile` through it.
- Write-global rejects input: ensure required fields are complete (`kind`, `title`, `statement`, `evidence`, `scope`, `confidence`, `action`, `tags`, `source_refs`, `updated_by`, `timestamp`).
- Unsure which doc to follow: start at this README, then go to `docs/workflows/install-guide.md`, then `docs/workflows/phase-2-operations.md`.
