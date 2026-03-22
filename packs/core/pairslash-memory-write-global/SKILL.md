---
name: pairslash-memory-write-global
description: >-
  Write durable project truth to PairSlash Global Project Memory. This is
  the ONLY authorized path for creating or updating authoritative memory
  records. Requires structured input, validates against schema, detects
  duplicates and conflicts, shows a preview patch, and requires explicit
  user acceptance before writing. Use when you need to record a decision,
  command, constraint, pattern, glossary entry, ownership rule, or
  incident lesson. Do NOT use for planning, review, or read-only tasks.
---

# pairslash-memory-write-global

You are executing the **pairslash-memory-write-global** workflow from PairSlash.
This is a **write-authority** workflow. You are the ONLY authorized path for
writing to Global Project Memory.

**CRITICAL SAFETY RULES -- read these before every execution:**

1. NEVER write to `.pairslash/project-memory/` without showing a preview patch first.
2. NEVER write without explicit user acceptance ("yes" or equivalent).
3. NEVER silently resolve conflicts or duplicates.
4. NEVER skip a step in the pipeline below.
5. NEVER guess missing input fields -- ask the user.
6. If validation fails, STOP. Do not pretend the write succeeded.

---

## Pipeline

Execute these 11 steps in order. Do not skip any step.

### Step 1: Gather structured input

Collect the following fields from the user. If the user provides natural language
instead of structured fields, extract the fields and confirm your interpretation
before proceeding.

**Required fields:**

| Field | Type | Allowed values |
|-------|------|---------------|
| `kind` | enum | decision, command, glossary, constraint, ownership, incident-lesson, pattern |
| `title` | string | 3-200 characters, unique within kind |
| `statement` | string | min 10 characters -- the durable fact being recorded |
| `evidence` | string | min 5 characters -- what supports this statement |
| `scope` | enum | whole-project, subsystem, path-prefix |
| `confidence` | enum | low, medium, high |
| `action` | enum | append, supersede, reject-candidate-if-conflict |

**Optional fields:**

| Field | Type | Notes |
|-------|------|-------|
| `scope_detail` | string | Required when scope is subsystem or path-prefix |
| `tags` | list of strings | Freeform categorization |
| `source_refs` | list of strings | File paths, URLs, commit SHAs |
| `supersedes` | string | Required when action is supersede; format: "kind/title" |

**Auto-generated fields:**

| Field | Value |
|-------|-------|
| `updated_by` | Ask user or default to "session-user" |
| `timestamp` | Current ISO 8601 timestamp |

### Step 2: Validate completeness

Check every required field. If ANY required field is missing or malformed:

> **STOP.** Tell the user exactly which fields are missing or invalid.
> Do not proceed. Do not guess values.

If `confidence` is `low`, warn the user:

> "Low-confidence records should generally go to `.pairslash/staging/` or
> `.pairslash/task-memory/`, not Global Project Memory. Do you want to
> redirect this record to staging instead?"

If the user insists on writing low-confidence to project-memory, proceed
but note the override in the audit entry.

### Step 3: Load existing records

Read all YAML files in these directories:

- `.pairslash/project-memory/` (all files)
- `.pairslash/task-memory/` (all files, if directory exists)
- `.pairslash/staging/` (all files, if directory exists)

Build a list of existing records with their `kind`, `title`, `scope`, and `statement`.

If a directory cannot be read, note the failure and continue with what you have.

### Step 4: Duplicate detection

Search existing records for any record where `kind` AND `title` match the
proposed record.

**If a duplicate is found:**

> **HALT.** Show the existing record and the proposed record side by side.
> Ask the user:
> 1. **Supersede** the existing record (change action to `supersede`)
> 2. **Amend** the proposed record (change title or content)
> 3. **Cancel** the write

Do not proceed until the user chooses.

### Step 5: Conflict detection

Search existing records for any record that:
- Has the same `scope` and a contradictory `statement`, OR
- Would be shadowed by the proposed record's scope

Also check: if `action` is `supersede`, verify that a matching record
actually exists. If not:

> **HALT.** "No record found matching 'kind/title' to supersede.
> Did you mean to use action=append instead?"

**If a conflict is found:**

> **HALT.** Show the conflicting records. Explain the nature of the conflict.
> Ask the user to resolve: supersede, amend, or cancel.

### Step 6: Scope validation

- If `scope` is `subsystem` or `path-prefix` and `scope_detail` is missing,
  ask the user to provide it.
- If the proposed record's scope is narrower than an existing record it
  might shadow, warn the user but do not block.

### Step 7: Generate preview patch

Assemble the complete YAML record and determine the target file path:

**File routing rules:**
- `kind: decision` -> `.pairslash/project-memory/60-architecture-decisions/{title-slug}.yaml`
- `kind: pattern` -> `.pairslash/project-memory/70-known-good-patterns/{title-slug}.yaml`
- `kind: incident-lesson` -> `.pairslash/project-memory/80-incidents-and-lessons/{title-slug}.yaml`
- `kind: command` -> append to `.pairslash/project-memory/20-commands.yaml`
- `kind: glossary` -> append to `.pairslash/project-memory/30-glossary.yaml`
- `kind: constraint` -> append to `.pairslash/project-memory/50-constraints.yaml`
- `kind: ownership` -> append to `.pairslash/project-memory/40-ownership.yaml`

For slug generation: lowercase the title, replace spaces with hyphens, remove
special characters, truncate to 60 characters.

**Present the preview patch to the user in this exact format:**

```
--- preview patch ---
target_file: <computed path>
action: <append|supersede>
content:
  kind: <kind>
  title: "<title>"
  statement: "<statement>"
  evidence: "<evidence>"
  scope: <scope>
  scope_detail: <if applicable>
  confidence: <confidence>
  action: <action>
  supersedes: <if applicable>
  tags: [<tags>]
  source_refs: [<source_refs>]
  updated_by: "<updated_by>"
  timestamp: "<timestamp>"
--- end preview ---
```

### Step 8: Require explicit acceptance

Ask the user clearly:

> **"Accept this write to Global Project Memory? (yes/no)"**

- If the user says **yes**: proceed to Step 9.
- If the user says **no** or anything ambiguous: **STOP.**
  Log the rejection in the audit log (Step 11 with result=rejected) and end.

Do NOT interpret partial agreement, hedging, or conditional responses as acceptance.

### Step 9: Write the record

Write the YAML record to the target file determined in Step 7.

- If the target file does not exist, create it with the record as the only content.
- If the target file exists and action is `append`, add the record as a new
  YAML document (separated by `---`).
- If action is `supersede`, replace the matching record in the target file.

If the target directory does not exist, create it.

### Step 10: Update memory index

Add or update an entry in `.pairslash/project-memory/90-memory-index.yaml`:

```yaml
- file: <target_file relative to project-memory/>
  kind: <kind>
  title: <title>
  scope: <scope>
  status: active
```

If action is `supersede`, find the old entry and change its `status` to `superseded`.

Update the `last_updated` and `updated_by` fields at the top of the index file.

### Step 11: Write audit log entry

Create a new file at `.pairslash/audit-log/{timestamp}-{kind}-{action}.yaml`
with this content:

```yaml
timestamp: "<ISO 8601>"
action: <append|supersede>
kind: <kind>
title: "<title>"
target_file: "<path>"
updated_by: "<updated_by>"
confidence: <confidence>
result: <success|rejected|conflict>
notes: "<any relevant notes, e.g. low-confidence override, user comment>"
```

Use a filename-safe timestamp format: `YYYYMMDD-HHMMSS`.

---

## Error handling

If any step fails, follow this protocol:

1. **State clearly which step failed and why.**
2. **Do not proceed past the failed step.**
3. **Do not pretend the write succeeded.**
4. If the failure is in Steps 9-11 (partial write), state exactly what was
   written and what was not, so the user can manually fix the inconsistency.

---

## What this workflow MUST NOT do

- Write without preview
- Write without user acceptance
- Silently resolve conflicts
- Accept freeform blobs as authoritative memory
- Operate as a side effect of planning, review, or other read workflows
- Skip any pipeline step
- Auto-commit without explicit acceptance
