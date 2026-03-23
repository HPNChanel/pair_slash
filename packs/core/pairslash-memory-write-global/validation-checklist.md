# pairslash-memory-write-global -- Validation Checklist

Use this checklist to verify that `pairslash-memory-write-global` is working
correctly. Each item maps to an acceptance gate in
`docs/compatibility/acceptance-gates.yaml`.

---

## Structural checks (no CLI required)

These can be verified from Cursor or any text editor.

- [ ] `packs/core/pairslash-memory-write-global/SKILL.md` exists
- [ ] `SKILL.md` has valid YAML frontmatter with `name` and `description` fields
- [ ] `SKILL.md` body begins with "write-authority" declaration
- [ ] `SKILL.md` contains 6 CRITICAL SAFETY RULES at the top
- [ ] `SKILL.md` contains all 11 pipeline steps in order (Step 1 through Step 11)
- [ ] Step 7 defines the preview patch format
- [ ] Step 8 requires explicit "yes/no" acceptance
- [ ] Step 9 defines file routing rules for all 7 `kind` values
- [ ] Step 11 defines the audit log entry format
- [ ] `SKILL.md` ends with "What this workflow MUST NOT do" section
- [ ] `packages/spec-core/specs/pairslash-memory-write-global.spec.yaml` exists and parses as valid YAML
- [ ] `packages/spec-core/schemas/memory-record.schema.yaml` exists and parses as valid YAML
- [ ] Schema lists all 11 required fields: kind, title, statement, evidence, scope, confidence, action, tags, source_refs, updated_by, timestamp
- [ ] Schema `source_refs.minItems` is `0` (not `1`)
- [ ] `contract.md` exists with all 8 contract sections
- [ ] `example-invocation.md` exists with 3 invocation patterns
- [ ] `example-output.md` exists with 6 scenarios (A through F)
- [ ] `phase-boundary.md` exists

---

## Installation checks (require a terminal)

- [ ] `cp -r packs/core/pairslash-memory-write-global .agents/skills/` succeeds (Codex CLI)
  OR
  `cp -r packs/core/pairslash-memory-write-global .github/skills/` succeeds (Copilot CLI)
- [ ] Installed directory contains `SKILL.md`
- [ ] `.pairslash/project-memory/` exists with at least `00-project-charter.yaml`
- [ ] `.pairslash/audit-log/` directory exists

---

## Runtime checks (require a live CLI session)

Record pass/fail and evidence for each.

### G2 -- Skill appears in /skills listing

- [ ] Launch CLI from the repo root
- [ ] Use `/skills` (or equivalent) to list available skills
- [ ] `pairslash-memory-write-global` appears in the list
- Evidence: _______________

### G5 -- Preview patch appears before any file write

- [ ] Invoke the skill with valid structured input (all 7 required fields)
- [ ] Verify a preview patch in the documented format appears
- [ ] Verify no files in `.pairslash/project-memory/` are created or modified
  before the user says "yes"
- [ ] Check with `git status` or `ls -la` that no new files appeared prematurely
- Evidence: _______________

### G6 -- "No" stops the write; rejection is logged

- [ ] Invoke the skill with valid input
- [ ] When preview patch appears, say "no"
- [ ] Verify no new file was written to `.pairslash/project-memory/`
- [ ] Verify `90-memory-index.yaml` was not modified
- [ ] Check `.pairslash/audit-log/` for a rejection entry with `result: rejected`
- Evidence: _______________

### G7 -- Written record contains all 11 semantic fields

- [ ] Invoke the skill with valid input and accept the write ("yes")
- [ ] Read the written YAML file in `.pairslash/project-memory/`
- [ ] Verify all 11 fields are present:
  - [ ] `kind`
  - [ ] `title`
  - [ ] `statement`
  - [ ] `evidence`
  - [ ] `scope`
  - [ ] `confidence`
  - [ ] `action`
  - [ ] `tags`
  - [ ] `source_refs`
  - [ ] `updated_by`
  - [ ] `timestamp`
- [ ] Verify the written YAML parses without errors
- Evidence: _______________

### G12 -- Duplicate detection fires on kind+title collision (SHOULD gate)

- [ ] Write a record successfully (Scenario A from example-output.md)
- [ ] Attempt to write another record with the same `kind` and `title`
- [ ] Verify the workflow halts with a duplicate warning
- [ ] Verify the user is offered: supersede, amend, or cancel
- [ ] Verify no file is written until the user resolves the duplicate
- Evidence: _______________

### G13 -- Audit log entry created after write (SHOULD gate)

- [ ] Complete a successful write (accept the preview)
- [ ] Check `.pairslash/audit-log/` for a new file
- [ ] Verify the audit file contains: timestamp, action, kind, title,
  target_file, updated_by, confidence, result
- [ ] Verify `result` is `success`
- Evidence: _______________

---

## Behavioral quality checks (subjective, reviewer judgment)

- [ ] When incomplete input is provided, the skill rejects immediately and
  lists all missing fields (not one at a time)
- [ ] When `confidence=low`, the skill warns and offers to redirect to staging
- [ ] When `action=supersede` and target does not exist, the skill halts
  and asks the user
- [ ] The preview patch uses the documented format (delimited by
  `--- preview patch ---` and `--- end preview ---`)
- [ ] The skill does not write any files if the user says "no" or anything ambiguous
- [ ] The file routing matches the rules: decisions to `60-architecture-decisions/`,
  patterns to `70-known-good-patterns/`, etc.

---

## Scope containment checks (G15-G18)

- [ ] Output contains no references to Cursor, Claude Code, or other runtimes
  as product targets
- [ ] No code path writes to project-memory without the 11-step pipeline
- [ ] No code path writes to project-memory as a side effect of another workflow
- [ ] All memory path references point to `.pairslash/`, not external stores

---

## What to record after testing

Update these files with evidence:

1. `docs/compatibility/runtime-surface-matrix.yaml`
   - V2: did the skill read `.pairslash/` files for duplicate/conflict detection?
   - V3: did the skill produce a YAML-formatted preview patch?
   - V6: did scripts in `scripts/` execute (if any were added)?

2. `docs/compatibility/acceptance-gates.yaml`
   - G2, G5, G6, G7: update `status` to `pass` or `fail` with `evidence`
   - G12, G13: update `status` (SHOULD gates, non-blocking)

3. If a MUST gate fails, open a new issue or task before claiming Phase 2 done.
