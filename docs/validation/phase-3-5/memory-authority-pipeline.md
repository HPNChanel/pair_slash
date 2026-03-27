# Memory Authority Pipeline

`pairslash-memory-write-global` is the only supported path for authoritative writes into `.pairslash/project-memory/`.

## Pipeline

1. Parse the structured request and reject unknown/freeform fields.
2. Read related records from:
   - `.pairslash/project-memory/`
   - `.pairslash/task-memory/`
   - `.pairslash/sessions/`
   - `.pairslash/staging/`
3. Detect duplicates and conflicts.
4. Validate scope and supersede/reject-candidate semantics.
5. Generate the preview patch.
6. Persist a deterministic staging artifact in `.pairslash/staging/`.
7. Require explicit user confirmation for apply.
8. Commit from the staging artifact only.
9. Append a human-readable audit log entry.
10. Update `90-memory-index.yaml` deterministically.

## CLI flow

Preview first:

```bash
node packages/tools/cli/src/bin/pairslash.js preview memory-write-global \
  --runtime codex \
  --target repo \
  --kind constraint \
  --title "Preview required before memory commit" \
  --statement "Preview must be shown before authoritative memory commit." \
  --evidence "docs/validation/phase-3-5/memory-authority-pipeline.md" \
  --scope whole-project \
  --confidence high \
  --action append
```

Apply only after preview exists:

```bash
node packages/tools/cli/src/bin/pairslash.js memory write-global \
  --runtime codex \
  --target repo \
  --kind constraint \
  --title "Preview required before memory commit" \
  --statement "Preview must be shown before authoritative memory commit." \
  --evidence "docs/validation/phase-3-5/memory-authority-pipeline.md" \
  --scope whole-project \
  --confidence high \
  --action append \
  --apply --yes
```

## Encoded invariants

- No hidden writes.
- No silent commit on `--apply`; preview artifact must already exist.
- No freeform authoritative memory fields.
- No authoritative write from read-only workflow context.
- No implicit promotion from task/session memory into global memory.
- Duplicate/conflict checks run before every commit.
- Project-memory writes are verified against the staged preview payload before success is reported.
