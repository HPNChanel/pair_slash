# pairslash-memory-write-global -- Example Invocations

These examples show how to activate the skill and provide input.

---

## 1. Structured input (all fields explicit)

### Via /skills (canonical path, both runtimes)

```
> /skills
[skill picker opens]
> select pairslash-memory-write-global

> Record this:
  kind: decision
  title: Use YAML for all memory records
  statement: All Global Project Memory records must use YAML format with schema validation.
  evidence: CLAUDE.md Section 8 defines YAML as the canonical memory format. Phase 0 schema is memory-record.schema.yaml.
  scope: whole-project
  confidence: high
  action: append
  tags: [memory, format, schema]
  source_refs: [CLAUDE.md, packages/spec-core/schemas/memory-record.schema.yaml]
```

### Via direct invocation on Codex CLI

```
> $pairslash-memory-write-global

  kind: decision
  title: Use YAML for all memory records
  statement: All Global Project Memory records must use YAML format with schema validation.
  evidence: CLAUDE.md Section 8 defines YAML as the canonical memory format.
  scope: whole-project
  confidence: high
  action: append
```

*Fallback to /skills if `$pairslash-memory-write-global` is not available.*

### Via direct invocation on Copilot CLI (interactive mode only)

```
> Use the /pairslash-memory-write-global skill to record a decision:
  kind: decision
  title: Use YAML for all memory records
  statement: All Global Project Memory records must use YAML format with schema validation.
  evidence: CLAUDE.md Section 8 defines YAML as the canonical memory format.
  scope: whole-project
  confidence: high
  action: append
```

*Note: Does not work in `-p`/`--prompt` mode due to a known Copilot CLI bug.*

---

## 2. Natural language input (workflow extracts fields)

The user describes the record in prose. The workflow extracts the structured
fields and asks for confirmation before proceeding.

```
> /skills
> select pairslash-memory-write-global

> We decided today that all API endpoints must require authentication.
  This came from the security review in PR #42. It applies to the
  whole project and we're confident about it.
```

The workflow should respond with something like:

```
I extracted these fields from your input. Please confirm or correct:

  kind: decision
  title: All API endpoints require authentication
  statement: All API endpoints must require authentication. No unauthenticated public endpoints.
  evidence: Security review in PR #42.
  scope: whole-project
  confidence: high
  action: append
  tags: [security, api, authentication]
  source_refs: [PR #42]

Is this correct? (yes / no / let me adjust)
```

Only after the user confirms does the workflow proceed to duplicate/conflict detection.

---

## 3. Supersede flow (replacing an existing record)

The user wants to replace a previously recorded decision.

```
> /skills
> select pairslash-memory-write-global

> Record this, superseding the old decision:
  kind: decision
  title: Use YAML for all memory records
  statement: All Global Project Memory records must use YAML format. JSON is no longer accepted.
  evidence: Team discussion 2026-03-20. JSON caused parsing issues in Phase 0 testing.
  scope: whole-project
  confidence: high
  action: supersede
  supersedes: decision/Use YAML for all memory records
  tags: [memory, format]
  source_refs: [team-discussion-2026-03-20]
```

The workflow will:
1. Validate all fields (Step 1-2).
2. Search existing records and find the original "Use YAML for all memory records" record (Step 3).
3. Skip duplicate halt because `action=supersede` signals intentional replacement (Step 4).
4. Verify the `supersedes` target exists. If it does not, halt and ask the user (Step 5).
5. Generate a preview patch showing the new record and noting the superseded one (Step 7).
6. Require explicit acceptance (Step 8).
7. Write the new record, mark the old index entry as `status: superseded` (Steps 9-10).
8. Log the supersede action in the audit log (Step 11).

---

## What happens with missing fields

If the user omits a required field:

```
> /skills
> select pairslash-memory-write-global

> kind: command
  title: Run tests before push
  statement: Always run the test suite before pushing to main.
```

The workflow rejects immediately:

```
STOP. The following required fields are missing:

  - evidence (what supports this statement?)
  - scope (whole-project, subsystem, or path-prefix?)
  - confidence (low, medium, or high?)
  - action (append, supersede, or reject-candidate-if-conflict?)

Please provide the missing fields.
```

No search, no write, no preview until all required fields are present.
