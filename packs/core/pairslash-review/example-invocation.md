# pairslash-review -- Example Invocation

## Canonical

```text
/skills
```

Select `pairslash-review`, then provide:

```yaml
review_subject: "Phase 2 memory hardening changes"
diff_source: "working-tree"
scope_hint: ".pairslash/, packs/core/, packages/spec-core/"
strictness: strict
```

## Direct (Codex CLI)

```text
$pairslash-review
Review current working tree in strict mode for memory-authority violations.
```

## Direct (Copilot CLI)

```text
/pairslash-review
Review staged changes for missing tests and contract drift.
```

