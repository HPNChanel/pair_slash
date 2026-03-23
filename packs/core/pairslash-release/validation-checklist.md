# pairslash-release Validation Checklist

- `pack.yaml` contains explicit `codex.plan_on_model` and `codex.plan_off_model`.
- `memory_access` is read-only and does not imply Global Project Memory writes.
- `required_inputs`, `output_contract`, and `failure_contract` match the spec.
- Runtime targets and surface statuses match `docs/compatibility/runtime-surface-matrix.yaml`.
- `SKILL.md` frontmatter name matches the pack id.
