# PairSlash Phase 2 -- Manual Install Guide

Install PairSlash core workflows into Codex CLI or GitHub Copilot CLI.

This page is for getting a local skill install working from repo source.
Use `/skills` as the canonical entrypoint after install. If you need support
status rather than install steps, use
`docs/compatibility/compatibility-matrix.md`.

## Before you start

- Repository root contains `.pairslash/`, `packs/core/`, `packages/spec-core/`.
- Runtime installed:
  - Codex CLI: https://developers.openai.com/codex/cli
  - Copilot CLI: https://docs.github.com/copilot
- Choose one runtime path below.
- `packs/core/` is the source of truth. `.agents/skills/` and `.github/skills/`
  are derived install targets.

## Skill inventory

| Skill | Class | Source path |
|---|---|---|
| `pairslash-plan` | read-oriented | `packs/core/pairslash-plan/` |
| `pairslash-review` | read-oriented | `packs/core/pairslash-review/` |
| `pairslash-onboard-repo` | read-oriented | `packs/core/pairslash-onboard-repo/` |
| `pairslash-command-suggest` | read-oriented | `packs/core/pairslash-command-suggest/` |
| `pairslash-memory-candidate` | candidate-producing | `packs/core/pairslash-memory-candidate/` |
| `pairslash-memory-write-global` | write-authority | `packs/core/pairslash-memory-write-global/` |
| `pairslash-memory-audit` | audit | `packs/core/pairslash-memory-audit/` |

## Codex CLI path

Use this path when installing PairSlash into Codex CLI.

### Bash / macOS / Linux

```bash
mkdir -p .agents/skills
cp -r packs/core/pairslash-plan .agents/skills/
cp -r packs/core/pairslash-review .agents/skills/
cp -r packs/core/pairslash-onboard-repo .agents/skills/
cp -r packs/core/pairslash-command-suggest .agents/skills/
cp -r packs/core/pairslash-memory-candidate .agents/skills/
cp -r packs/core/pairslash-memory-write-global .agents/skills/
cp -r packs/core/pairslash-memory-audit .agents/skills/
```

### PowerShell / Windows

```powershell
New-Item -ItemType Directory -Force -Path .agents\skills
Copy-Item -Recurse packs\core\pairslash-plan .agents\skills\
Copy-Item -Recurse packs\core\pairslash-review .agents\skills\
Copy-Item -Recurse packs\core\pairslash-onboard-repo .agents\skills\
Copy-Item -Recurse packs\core\pairslash-command-suggest .agents\skills\
Copy-Item -Recurse packs\core\pairslash-memory-candidate .agents\skills\
Copy-Item -Recurse packs\core\pairslash-memory-write-global .agents\skills\
Copy-Item -Recurse packs\core\pairslash-memory-audit .agents\skills\
```

### Verify in Codex CLI

1. Launch Codex CLI from repo root.
2. Use `/skills`.
3. Confirm all 7 skills appear.
4. Continue to `docs/workflows/phase-2-operations.md` for validation and safety gates.

## GitHub Copilot CLI path

Use this path when installing PairSlash into GitHub Copilot CLI.

### Bash / macOS / Linux

```bash
mkdir -p .github/skills
cp -r packs/core/pairslash-plan .github/skills/
cp -r packs/core/pairslash-review .github/skills/
cp -r packs/core/pairslash-onboard-repo .github/skills/
cp -r packs/core/pairslash-command-suggest .github/skills/
cp -r packs/core/pairslash-memory-candidate .github/skills/
cp -r packs/core/pairslash-memory-write-global .github/skills/
cp -r packs/core/pairslash-memory-audit .github/skills/
```

### PowerShell / Windows

```powershell
New-Item -ItemType Directory -Force -Path .github\skills
Copy-Item -Recurse packs\core\pairslash-plan .github\skills\
Copy-Item -Recurse packs\core\pairslash-review .github\skills\
Copy-Item -Recurse packs\core\pairslash-onboard-repo .github\skills\
Copy-Item -Recurse packs\core\pairslash-command-suggest .github\skills\
Copy-Item -Recurse packs\core\pairslash-memory-candidate .github\skills\
Copy-Item -Recurse packs\core\pairslash-memory-write-global .github\skills\
Copy-Item -Recurse packs\core\pairslash-memory-audit .github\skills\
```

### Verify in GitHub Copilot CLI

1. Launch Copilot CLI from repo root.
2. Run `/skills list`.
3. Confirm all 7 skills appear.
4. Continue to `docs/workflows/phase-2-operations.md` for validation and safety gates.

## Required filesystem

Ensure:

```text
.pairslash/project-memory/
.pairslash/task-memory/
.pairslash/sessions/
.pairslash/audit-log/
.pairslash/staging/
```

## Post-install validation

Run these from repo root after either runtime path:

```bash
python scripts/phase2_checks.py --all
python -m unittest discover -s tests -p "test_*.py"
```

If you are claiming runtime support rather than just installing locally, continue
to `docs/compatibility/runtime-verification.md` and record the outcome in the
compatibility artifacts.
