# pairslash-memory-write-global -- Example Output

Six scenarios demonstrating the 11-step pipeline.
Each uses data grounded in the actual `.pairslash/project-memory/` files.

---

## Scenario A: Happy path -- append a new decision

**User input:**

```
kind: decision
title: Use /skills as canonical entrypoint
statement: All PairSlash workflows must be accessible via /skills as the primary activation path. Direct invocation ($name on Codex, /name on Copilot) is allowed when verified but /skills is the fallback-compatible entrypoint.
evidence: CLAUDE.md Section 4.2. Confirmed by Codex and Copilot documentation as of 2026-03-21.
scope: whole-project
confidence: high
action: append
tags: [activation, compatibility, runtime]
source_refs: [CLAUDE.md, https://developers.openai.com/codex/skills, https://docs.github.com/copilot/how-tos/copilot-cli/customize-copilot/create-skills]
```

**Step 1 -- Parse and extract fields:**
All 7 required fields present. `tags` and `source_refs` provided. Auto-generating
`updated_by: session-user` and `timestamp: 2026-03-21T14:30:00Z`.

**Step 2 -- Validate completeness:**
All fields valid. Confidence is `high` -- no low-confidence warning needed.

**Step 3 -- Load existing records:**
Read `.pairslash/project-memory/`:
- `00-project-charter.yaml` (kind: charter, title: PairSlash Project Charter)
- `10-stack-profile.yaml` (kind: stack-profile, title: PairSlash Stack Profile)
- `90-memory-index.yaml` (2 active records)

Read `.pairslash/task-memory/`: empty.
Read `.pairslash/staging/`: empty.

Existing records loaded: 2 active.

**Step 4 -- Duplicate detection:**
Searching for `kind=decision` + `title=Use /skills as canonical entrypoint`.
No match found. No duplicate.

**Step 5 -- Conflict detection:**
No existing record with `kind=decision` in `scope=whole-project` contradicts this
statement. No conflict.

`action=append` -- no supersede target to verify.

**Step 6 -- Scope validation:**
`scope=whole-project` -- no `scope_detail` required. Valid.

**Step 7 -- Generate preview patch:**

```
--- preview patch ---
target_file: .pairslash/project-memory/60-architecture-decisions/use-skills-as-canonical-entrypoint.yaml
action: append
content:
  kind: decision
  title: "Use /skills as canonical entrypoint"
  statement: "All PairSlash workflows must be accessible via /skills as the primary activation path. Direct invocation ($name on Codex, /name on Copilot) is allowed when verified but /skills is the fallback-compatible entrypoint."
  evidence: "CLAUDE.md Section 4.2. Confirmed by Codex and Copilot documentation as of 2026-03-21."
  scope: whole-project
  confidence: high
  action: append
  tags: [activation, compatibility, runtime]
  source_refs: [CLAUDE.md, "https://developers.openai.com/codex/skills", "https://docs.github.com/copilot/how-tos/copilot-cli/customize-copilot/create-skills"]
  updated_by: "session-user"
  timestamp: "2026-03-21T14:30:00Z"
--- end preview ---
```

**Step 8 -- Require acceptance:**

> **Accept this write to Global Project Memory? (yes/no)**

User: **yes**

**Step 9 -- Write the record:**
Created `.pairslash/project-memory/60-architecture-decisions/use-skills-as-canonical-entrypoint.yaml`
with the content shown above.

**Step 10 -- Update memory index:**
Appended to `.pairslash/project-memory/90-memory-index.yaml`:

```yaml
  - file: 60-architecture-decisions/use-skills-as-canonical-entrypoint.yaml
    kind: decision
    title: Use /skills as canonical entrypoint
    scope: whole-project
    status: active
```

Updated `last_updated: 2026-03-21T14:30:00Z` and `updated_by: session-user`.

**Step 11 -- Audit log:**
Created `.pairslash/audit-log/20260321-143000-decision-append.yaml`:

```yaml
timestamp: "2026-03-21T14:30:00Z"
action: append
kind: decision
title: "Use /skills as canonical entrypoint"
target_file: ".pairslash/project-memory/60-architecture-decisions/use-skills-as-canonical-entrypoint.yaml"
updated_by: "session-user"
confidence: high
result: success
notes: ""
```

**Result:** Record is now authoritative in Global Project Memory.

---

## Scenario B: Duplicate detected

**User input:**

```
kind: charter
title: PairSlash Project Charter
statement: PairSlash is an OSS workflow kit for Codex CLI and Copilot CLI.
evidence: Project founding document.
scope: whole-project
confidence: high
action: append
```

**Steps 1-3:** Fields valid. Existing records loaded (2 active).

**Step 4 -- Duplicate detection:**

> **HALT.** A record with `kind=charter` and `title=PairSlash Project Charter`
> already exists.
>
> **Existing record** (from `00-project-charter.yaml`):
> ```yaml
> kind: charter
> title: PairSlash Project Charter
> identity:
>   name: PairSlash
>   tagline: "OSS slash-triggered workflow kit for Codex CLI and GitHub Copilot CLI..."
> ```
>
> **Proposed record:**
> ```yaml
> kind: charter
> title: PairSlash Project Charter
> statement: "PairSlash is an OSS workflow kit for Codex CLI and Copilot CLI."
> ```
>
> Choose:
> 1. **Supersede** -- replace the existing record (changes action to `supersede`)
> 2. **Amend** -- change the title or content of the proposed record to avoid collision
> 3. **Cancel** -- abandon this write

Pipeline halts until the user decides. No write occurs.

---

## Scenario C: Supersede target missing

**User input:**

```
kind: decision
title: Prefer JSON over YAML
statement: All memory records should use JSON format instead of YAML.
evidence: Team discussion 2026-03-20.
scope: whole-project
confidence: medium
action: supersede
supersedes: decision/Prefer JSON over YAML
```

**Steps 1-4:** Fields valid. No duplicate (no existing record with this kind+title).

**Step 5 -- Conflict detection:**

> **HALT.** `action=supersede` but no existing record found matching
> `decision/Prefer JSON over YAML`.
>
> There is no record to supersede. Did you mean:
> 1. **Use `action=append`** to create a new record instead?
> 2. **Correct the `supersedes` field** to reference the actual existing record?
> 3. **Cancel** this write?

Pipeline halts. No write occurs.

---

## Scenario D: User rejects at acceptance gate

**User input:**

```
kind: constraint
title: No external dependencies without review
statement: Any new external dependency must be reviewed by at least two maintainers.
evidence: Team agreement from sprint retrospective 2026-03-18.
scope: whole-project
confidence: high
action: append
```

**Steps 1-6:** All pass. No duplicates, no conflicts.

**Step 7 -- Preview patch:**

```
--- preview patch ---
target_file: .pairslash/project-memory/50-constraints.yaml
action: append
content:
  kind: constraint
  title: "No external dependencies without review"
  statement: "Any new external dependency must be reviewed by at least two maintainers."
  evidence: "Team agreement from sprint retrospective 2026-03-18."
  scope: whole-project
  confidence: high
  action: append
  tags: []
  source_refs: []
  updated_by: "session-user"
  timestamp: "2026-03-21T15:00:00Z"
--- end preview ---
```

**Step 8 -- Require acceptance:**

> **Accept this write to Global Project Memory? (yes/no)**

User: **no, I want to add source_refs first**

**Result:** Write rejected. Pipeline stops.

**Step 11 -- Audit log (rejection):**
Created `.pairslash/audit-log/20260321-150000-constraint-append.yaml`:

```yaml
timestamp: "2026-03-21T15:00:00Z"
action: append
kind: constraint
title: "No external dependencies without review"
target_file: ".pairslash/project-memory/50-constraints.yaml"
updated_by: "session-user"
confidence: high
result: rejected
notes: "User rejected at acceptance gate. Wanted to add source_refs first."
```

No file written to `project-memory/`. No index change. Only audit log records the rejection.

---

## Scenario E: Low-confidence explicit approval

**User input:**

```
kind: pattern
title: Prefer small PRs
statement: Pull requests should be small and focused for easier review.
evidence: General best practice, not yet validated for this project.
scope: whole-project
confidence: low
action: append
```

**Step 1:** Fields parsed.

**Step 2 -- Validate completeness:**

> **Warning:** `confidence=low`. Low-confidence records should generally go to
> `.pairslash/staging/` or `.pairslash/task-memory/`, not Global Project Memory.
> Stop after preview if you do not want an authoritative write.

**If the user stops after preview:** No authoritative write happens.

**If the user proceeds anyway:** The pipeline continues after explicit approval.
The audit log entry includes `notes: "low-confidence-authoritative-write"`

---

## Scenario F: Incomplete input

**User input:**

```
kind: command
title: Run tests before push
```

**Step 2 -- Validate completeness:**

> **STOP.** The following required fields are missing:
>
> | Missing field | What is needed |
> |---------------|---------------|
> | `statement` | The durable fact being recorded (min 10 characters) |
> | `evidence` | What supports this statement (min 5 characters) |
> | `scope` | Where this applies: whole-project, subsystem, or path-prefix |
> | `confidence` | How confident: low, medium, or high |
> | `action` | What to do: append, supersede, or reject-candidate-if-conflict |
>
> Please provide the missing fields before I can proceed.

**Result:** Pipeline stops at Step 2. No search, no preview, no write.
No audit log entry (input was never complete enough to begin processing).
