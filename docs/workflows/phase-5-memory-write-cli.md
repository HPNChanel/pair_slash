# Phase 5 Memory Write CLI

`pairslash memory write-global` is the usable CLI surface for authoritative memory writes.

## Preview only

```bash
node packages/cli/src/bin/pairslash.js preview memory-write-global \
  --runtime codex \
  --target repo \
  --kind constraint \
  --title "Preview required before memory commit" \
  --statement "Preview must be shown before authoritative memory commit." \
  --evidence "docs/architecture/phase-5-contract-policy-engine.md" \
  --scope whole-project \
  --confidence high \
  --action append \
  --format json
```

## Commit with explicit approval

```bash
node packages/cli/src/bin/pairslash.js memory write-global \
  --runtime codex \
  --target repo \
  --kind constraint \
  --title "Preview required before memory commit" \
  --statement "Preview must be shown before authoritative memory commit." \
  --evidence "docs/architecture/phase-5-contract-policy-engine.md" \
  --scope whole-project \
  --confidence high \
  --action append \
  --apply
```

Use `--yes` for explicit non-interactive approval.

## Request files

You can provide the structured payload with `--request <path>` using JSON or YAML.

## Guarantees

- No hidden write
- No silent fallback
- Preview generated before commit
- Explicit confirmation required for commit
- Audit log and memory index updated on successful write
