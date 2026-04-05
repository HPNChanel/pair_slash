# PairSlash Live Runtime Evidence Index

This directory is the checked-in lane evidence index for PairSlash support
claims.

Use these files when updating `docs/compatibility/runtime-surface-matrix.yaml`
or any public support wording.

Each lane has:

- a Markdown summary record (`<lane>.md`) for human review
- a YAML sidecar (`<lane>.yaml`) for machine-readable policy fields, freshness,
  host profiles, evidence classes, and negative evidence

## Evidence classes

- Deterministic evidence: repeatable tests, release gates, and generated
  artifacts that prove implementation and regression control.
- Fake/shim evidence: compat-lab coverage that uses fake runtime binaries or
  host overrides. Useful for regression control, never sufficient for live
  support promotion.
- Live evidence: exact runtime, target, OS, and version observations from real
  `/skills` interaction or live install behavior.

## Lane records

- `codex-cli-repo-macos.md`
- `codex-cli-repo-macos.yaml`
- `copilot-cli-user-linux.md`
- `copilot-cli-user-linux.yaml`
- `codex-cli-repo-windows.md`
- `codex-cli-repo-windows.yaml`
- `copilot-cli-user-windows.md`
- `copilot-cli-user-windows.yaml`

## Update rule

- Keep deterministic, fake/shim, and live evidence separated inside each lane
  record.
- Keep `current_public_support_level`, `required_evidence_class`,
  `best_live_evidence_class`, `freshness_state`, and `surface_verdicts`
  synchronized between the YAML sidecar and the compatibility matrix.
- Do not widen a lane claim from doctor, preview, compat-lab, or release
  checklists alone.
- If no live evidence exists, record that absence explicitly and keep the lane
  label conservative.
