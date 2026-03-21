# Copilot Instructions for PairSlash

## What is PairSlash

PairSlash is an open-source slash-triggered workflow kit for **Codex CLI** and **GitHub Copilot CLI**. It provides disciplined workflows backed by file-based, schema-first **Global Project Memory** as the durable source of truth for project context.

**Current status:** Phase 0 (Compatibility Spike) — artifact-complete, no executable code or build tooling yet. All artifacts are YAML specs, Markdown skill definitions, and documentation.

## Constitutional authority

`CLAUDE.md` is the **project constitution** and the highest-precedence document in the repo. When any document conflicts with `CLAUDE.md`, `CLAUDE.md` wins. Always read it before proposing architectural changes.

Precedence order: `CLAUDE.md` → Accepted ADRs → Updated blueprint → Earlier blueprint → Notes/explorations → Ad hoc conclusions.

## Architecture

### Two runtimes only

PairSlash targets exactly two runtimes. Do not introduce a third.

| | Codex CLI | Copilot CLI |
|---|---|---|
| Skill storage (repo) | `.agents/skills/` | `.github/skills/` |
| Skill storage (user) | `~/.agents/skills/` | `~/.copilot/skills/` |
| Direct invocation | `$skill-name` | `/skill-name` |
| Canonical browse | `/skills` | `/skills` |

### Memory model (three tiers)

1. **Global Project Memory** (`.pairslash/project-memory/`) — Authoritative, cross-session, schema-first YAML. The only tier that represents durable project truth.
2. **Task Memory** (`.pairslash/task-memory/`) — Structured but non-authoritative. Staging ground for knowledge that may be promoted to Global.
3. **Session Context** (`.pairslash/sessions/`) — Disposable working state. Never authoritative.

When tiers conflict: Global wins → Task may extend but not override → Session is lowest priority.

### Memory filesystem layout

```
.pairslash/
  project-memory/          # Authoritative records (numbered YAML files)
    00-project-charter.yaml
    10-stack-profile.yaml
    20-commands.yaml        # (future)
    30-glossary.yaml        # (future)
    50-constraints.yaml     # (future)
    60-architecture-decisions/
    70-known-good-patterns/
    80-incidents-and-lessons/
    90-memory-index.yaml
  task-memory/
  sessions/
  audit-log/               # Durable write history
  staging/                 # Pre-authoritative validation area
```

### Workflow taxonomy

Every workflow must declare its class. The three classes have hard permission boundaries:

- **Read-oriented** — May read Global Memory, MUST NOT write to it. Examples: `pairslash-plan`, `pairslash-review`.
- **Write-authority** — The ONLY class allowed to mutate Global Memory. Must follow the 11-step pipeline. Example: `pairslash-memory-write-global`.
- **Audit** — Inspects memory health. Must not silently rewrite Global.

### Write-authority pipeline (mandatory 11 steps)

Any write to Global Memory must follow this sequence — no steps may be skipped:

1. Parse & validate structured input (7 required fields: kind, title, statement, evidence, scope, confidence, action)
2. Reject incomplete input before any write
3. Load existing records from project-memory, task-memory, staging
4. Duplicate detection (halt on kind+title collision)
5. Conflict detection (halt on contradictory statements)
6. Scope validation
7. Generate preview patch (exact YAML shown to user)
8. Require explicit acceptance ("yes" only — hedging = no)
9. Write the record
10. Update `90-memory-index.yaml`
11. Append audit log entry

### Memory record schema

All authoritative records must conform to `phase-0/schemas/memory-record.schema.yaml` with these required fields: `kind`, `title`, `statement`, `evidence`, `scope`, `confidence`, `action`, `tags`, `source_refs`, `updated_by`, `timestamp`.

## Key conventions

### Slash-first interaction

`/skills` is the canonical entrypoint on both runtimes. Direct invocation (`$name` or `/name`) is allowed only when verified. Never assume direct invocation works — fall back to `/skills` guidance.

### No silent writes

There must be no hidden memory mutation. Every change to Global Project Memory requires: explicit intent → structured input → validation → preview → acceptance → audit trail. Read workflows must never produce memory writes as a side effect.

### File-based and Git-reviewable

All memory, specs, and configs are plain files (YAML/Markdown). No opaque databases, no vendor-locked storage. Humans must be able to review changes with `git diff`.

### Workflow contracts

Every workflow must declare four contracts: **input** (required/optional fields), **output** (structure and promises), **failure** (honest behavior on bad input), **memory** (what layers are readable/writable).

### Skill file structure

Each skill lives in its own directory under `phase-0/skills/` with:
- `SKILL.md` — Main definition (YAML frontmatter + Markdown instructions)
- `contract.md` — Formal workflow contract
- `example-invocation.md` — Usage examples
- `example-output.md` — Realistic output samples
- `validation-checklist.md` — Acceptance criteria

### Phase discipline

This repo is in **Phase 0** (compatibility spike). Do not introduce Phase 1+ concerns (compilers, installers, MCP integration, scripts-based validation) unless explicitly asked. Phase 0 proves architecture direction only.

## Hard anti-goals

Do not propose or implement any of these:
- A third runtime in the core product
- Background daemons or autonomous agents
- Silent or implicit Global Memory mutation
- Freeform markdown as authoritative memory (must be schema-normalized YAML)
- Dependency on undocumented vendor internals
- Vector databases or heavy retrieval as prerequisites
- Write flows without preview and acceptance gates
- Session summaries treated as authoritative truth
