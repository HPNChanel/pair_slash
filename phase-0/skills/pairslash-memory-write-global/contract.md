# pairslash-memory-write-global -- Workflow Contract

**Version:** 0.1.0
**Phase:** 0
**Class:** write-authority
**Status:** Phase 0 demo

---

## Purpose

`pairslash-memory-write-global` is the **sole authorized path** for writing
durable project truth to Global Project Memory.

It exists to ensure that every change to `.pairslash/project-memory/` is
explicit, schema-first, previewable, conflict-aware, and auditable.

**What it does:**
- Records decisions, commands, constraints, patterns, glossary entries,
  ownership rules, and incident lessons.
- Validates input against the memory record schema.
- Detects duplicates and conflicts before writing.
- Shows a preview patch and requires explicit user acceptance.
- Updates the memory index and appends an audit log entry.

**What it is not:**
- It is not a planner, reviewer, or code writer.
- It is not invocable as a side effect of any read-oriented workflow.
- It is not a batch import tool.
- It does not auto-commit. Every write requires human acceptance.

---

## Activation

**Canonical path (both runtimes):**

```
/skills
```

Select `pairslash-memory-write-global` from the skill picker.

**Direct invocation (when runtime surface allows):**

| Runtime | Syntax | Status |
|---------|--------|--------|
| Codex CLI | `$pairslash-memory-write-global` | Supported if runtime surface allows; fallback is `/skills` |
| GitHub Copilot CLI | `/pairslash-memory-write-global` in prompt | Supported in interactive mode; known to fail in `-p`/`--prompt` mode |

**Implicit invocation:**
Both runtimes may match this skill by description. However, because this is a
write-authority workflow, implicit invocation is discouraged. Users should
invoke explicitly to signal clear intent.

---

## Input contract

**Required fields (user must provide or confirm):**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `kind` | enum | decision, command, glossary, constraint, ownership, incident-lesson, pattern | Category of knowledge |
| `title` | string | 3-200 characters, unique within kind | Human-readable identifier |
| `statement` | string | min 10 characters | The durable fact being recorded |
| `evidence` | string | min 5 characters | What supports this statement |
| `scope` | enum | whole-project, subsystem, path-prefix | Where this applies |
| `confidence` | enum | low, medium, high | Author's confidence level |
| `action` | enum | append, supersede, reject-candidate-if-conflict | Write action type |

**Optional fields:**

| Field | Type | Notes |
|-------|------|-------|
| `scope_detail` | string | **Required** when scope is subsystem or path-prefix |
| `tags` | array of strings | Freeform categorization; defaults to `[]` |
| `source_refs` | array of strings | File paths, URLs, commit SHAs; defaults to `[]`; medium/high confidence SHOULD provide at least one |
| `supersedes` | string | **Required** when action is supersede; format: `kind/title` |

**Auto-generated fields:**

| Field | Value |
|-------|-------|
| `updated_by` | Ask user or default to `session-user` |
| `timestamp` | Current ISO 8601 timestamp |

**Natural language input:** If the user describes the record in prose instead of
structured fields, the workflow extracts the fields, presents them for
confirmation, and only proceeds after the user approves the extraction.

**Schema reference:** `phase-0/schemas/memory-record.schema.yaml`

---

## Output contract

The workflow produces up to four artifacts, in sequence:

| Artifact | When produced | Format |
|----------|---------------|--------|
| **Preview patch** | Always (Step 7) | Structured YAML block showing target file, action, and full record |
| **Written record** | After user accepts (Step 9) | YAML file in `.pairslash/project-memory/` |
| **Index update** | After successful write (Step 10) | Entry in `90-memory-index.yaml` |
| **Audit log entry** | Always, even on rejection (Step 11) | YAML file in `.pairslash/audit-log/` |

**Preview patch format:**

```
--- preview patch ---
target_file: .pairslash/project-memory/60-architecture-decisions/use-yaml-for-memory.yaml
action: append
content:
  kind: decision
  title: "Use YAML for all memory records"
  statement: "All Global Project Memory records use YAML format."
  evidence: "CLAUDE.md Section 8 defines YAML as the canonical memory format."
  scope: whole-project
  confidence: high
  action: append
  tags: [memory, format]
  source_refs: [CLAUDE.md]
  updated_by: "session-user"
  timestamp: "2026-03-21T12:00:00Z"
--- end preview ---
```

**Determinism promise:** The preview patch format is fixed. Every invocation that
reaches Step 7 produces a preview in this exact structure.

---

## Failure contract

| Failure condition | Step | Behavior |
|-------------------|------|----------|
| Required field missing or malformed | 2 | **REJECT.** List every missing/invalid field. Do not guess values. |
| `confidence` is `low` | 2 | **WARN.** Suggest redirecting to `staging/` or `task-memory/`. Proceed if user insists; log override in audit. |
| Duplicate: existing record matches `kind` + `title` | 4 | **HALT.** Show existing and proposed side by side. Ask: supersede, amend, or cancel. |
| Conflict: contradictory statement in same scope | 5 | **HALT.** Show conflicting records. Explain conflict. User must resolve: supersede, amend, or cancel. |
| `action=supersede` but no matching record exists | 5 | **HALT.** "No record found matching 'kind/title' to supersede." |
| `scope` is subsystem/path-prefix but `scope_detail` missing | 6 | **ASK** for scope_detail before proceeding. |
| Scope shadowing: proposed record may shadow a broader existing record | 6 | **WARN** but do not block. Log warning. |
| File write fails (permissions, path) | 9 | **REPORT** error honestly. Do not pretend write succeeded. Do not retry silently. |
| Index update fails | 10 | **WARN** that index is out of sync. Record was written but index needs manual fix. |
| Audit log write fails | 11 | **WARN** that audit trail is incomplete. Record was written. |

**Anti-patterns this contract prohibits:**
- Guessing values for missing fields.
- Silently resolving conflicts by picking one side.
- Pretending a write succeeded when validation failed.
- Producing a confident "done" message when a partial failure occurred.

---

## Memory contract

| Layer | Permission | Paths | Purpose |
|-------|------------|-------|---------|
| Global Project Memory | **read** | `.pairslash/project-memory/` | Load existing records for duplicate/conflict detection |
| Task Memory | read | `.pairslash/task-memory/` | Check for related task-level records |
| Staging | read | `.pairslash/staging/` | Check for pending candidates that overlap |
| Global Project Memory | **write** | `.pairslash/project-memory/{target}` | Write accepted record (after Step 8) |
| Memory Index | **write** | `.pairslash/project-memory/90-memory-index.yaml` | Update index (after Step 9) |
| Audit Log | **write** | `.pairslash/audit-log/{timestamp}-{kind}-{action}.yaml` | Always, even on rejection |

**Invariant:**
This workflow is the ONLY authorized path for writing to `.pairslash/project-memory/`.
No other workflow -- including `pairslash-plan`, `pairslash-review`, or any future
read-oriented workflow -- may write to Global Project Memory as a side effect.

**Session memory cannot override Global Project Memory.** If session context
contradicts a record in `project-memory/`, the workflow surfaces the conflict
and requires an explicit decision.

---

## Approval posture

This workflow requires **explicit user acceptance** at Step 8.

- The preview patch MUST be shown before any file write.
- The user MUST say "yes" (or clear equivalent) to proceed.
- Hedging, partial agreement, or conditional responses are treated as "no."
- Rejection is logged in the audit log; no files are written to `project-memory/`.
- There is **no auto-commit mode** in Phase 0.

---

## Runtime mapping notes

### Codex CLI

- Install skill to: `.agents/skills/pairslash-memory-write-global/`
- Activation: `/skills` picker, or `$pairslash-memory-write-global` in prompt
- File read: Codex file reading tools read `.pairslash/` files for duplicate/conflict detection
- File write: Codex file writing tools write the accepted record
- `/skills` availability: **verify in Phase 0** (mentioned in skills docs but absent
  from CLI slash commands table)

### GitHub Copilot CLI

- Install skill to: `.github/skills/pairslash-memory-write-global/`
- Activation: `/skills list` to confirm presence, then `/pairslash-memory-write-global` in prompt
- File read/write: Copilot file tools used for both
- Known issue: does not work in `-p`/`--prompt` mode (github/copilot-cli#2040)
- `/skills reload` can pick up newly installed skills without restarting

---

## Phase boundary notes

Phase 0 is instruction-simulated. Every pipeline step is executed by the LLM
following SKILL.md instructions rather than deterministic code.

See `phase-boundary.md` in this directory for the full breakdown of what
Phase 0 simulates vs what Phase 2 hardens with scripts and hooks.
