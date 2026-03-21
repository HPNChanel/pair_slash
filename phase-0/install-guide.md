# PairSlash Phase 0 -- Manual Install Guide

This guide explains how to install PairSlash Phase 0 demo skills into
Codex CLI and GitHub Copilot CLI.

Phase 0 does not include an automated installer. That is a Phase 1 deliverable.

---

## Prerequisites

- A repository with the `.pairslash/` directory structure present at the repo root.
- At least one of the supported runtimes installed:
  - **Codex CLI** (OpenAI) -- see https://developers.openai.com/codex/cli
  - **GitHub Copilot CLI** -- see https://docs.github.com/copilot

---

## Skill inventory

| Skill | Type | Source path |
|-------|------|-------------|
| `pairslash-plan` | read-oriented | `phase-0/skills/pairslash-plan/` |
| `pairslash-memory-write-global` | write-authority | `phase-0/skills/pairslash-memory-write-global/` |

---

## Install for Codex CLI

Codex CLI reads skills from `.agents/skills/` relative to the repo root
(or any directory from CWD up to repo root).

```bash
# From the repository root:
mkdir -p .agents/skills
cp -r phase-0/skills/pairslash-plan .agents/skills/
cp -r phase-0/skills/pairslash-memory-write-global .agents/skills/
```

Verify installation:

1. Launch Codex CLI in the repository directory.
2. Type `$pairslash-plan` or use `/skills` to browse.
3. The skill should appear in the skill list.

User-level install (applies to all repos):

```bash
mkdir -p ~/.agents/skills
cp -r phase-0/skills/pairslash-plan ~/.agents/skills/
cp -r phase-0/skills/pairslash-memory-write-global ~/.agents/skills/
```

---

## Install for GitHub Copilot CLI

Copilot CLI reads skills from `.github/skills/` relative to the repo root.

```bash
# From the repository root:
mkdir -p .github/skills
cp -r phase-0/skills/pairslash-plan .github/skills/
cp -r phase-0/skills/pairslash-memory-write-global .github/skills/
```

Verify installation:

1. Launch Copilot CLI in the repository directory.
2. Run `/skills list` to see available skills.
3. Both skills should appear.

User-level install (applies to all repos):

```bash
mkdir -p ~/.copilot/skills
cp -r phase-0/skills/pairslash-plan ~/.copilot/skills/
cp -r phase-0/skills/pairslash-memory-write-global ~/.copilot/skills/
```

---

## Verify the memory filesystem

After installation, confirm the `.pairslash/` directory exists at the repo root:

```
.pairslash/
  project-memory/
    00-project-charter.yaml
    10-stack-profile.yaml
    90-memory-index.yaml
  task-memory/
  sessions/
  audit-log/
  staging/
```

Both skills expect this directory structure. `pairslash-plan` reads from it;
`pairslash-memory-write-global` reads from and writes to it.

---

## Known limitations (Phase 0)

- No automated installer or doctor utility.
- Skills must be manually copied to each runtime's expected path.
- If skill changes are made, re-copy and restart the CLI session
  (or use `/skills reload` on Copilot CLI).
- Script-based validation is optional and marked "verify in Phase 0."
