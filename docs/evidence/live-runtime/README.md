# PairSlash Live Runtime Evidence Index

This directory is the checked-in lane evidence index for PairSlash support
claims.

Use these files when updating `docs/compatibility/runtime-surface-matrix.yaml`
or any public support wording.

The authoritative maintainer runbook for collecting new live proof is
`docs/compatibility/runtime-verification.md`.
This directory holds the checked-in evidence registry, not a competing support
story.

Each lane has:

- a Markdown summary record (`<lane>.md`) for human review
- a YAML sidecar (`<lane>.yaml`) for machine-readable policy fields, freshness,
  host profiles, evidence classes, and negative evidence
- a schema contract (`schema.live-runtime-lane-record.yaml`) that defines
  required lane-level and per-run fields

## Evidence classes

- Deterministic evidence: repeatable tests, release gates, and generated
  artifacts that prove implementation and regression control.
- Fake acceptance evidence: deterministic compat-lab scenario outputs from
  `packages/tools/compat-lab/src/acceptance.js`.
- Shim acceptance evidence: fake runtime binaries and host overrides from
  `packages/tools/compat-lab/src/runtime-fixtures.js`.
- Fake acceptance and shim acceptance are regression confidence only. They are
  never sufficient for live support promotion.
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
- `schema.live-runtime-lane-record.yaml`

## Update rule

- Keep deterministic, fake acceptance, shim acceptance, and live evidence
  separated inside each lane record.
- Keep scripted host checks separate from manual canonical `/skills` proof.
- Do not treat compat-lab, fake runtimes, shim acceptance, or `codex exec`
  picker gaps as interchangeable with canonical live verification.
- Keep run-level records explicit about `runtime_id`, `os_lane`, `target`,
  `pack_scope`, `workflow_scope`, `capability_scope`, `entrypoint_path_used`,
  `command`, `verdict`, and `artifact_paths`.
- Keep `current_public_support_level`, `required_evidence_class`,
  `best_live_evidence_class`, `freshness_state`, and `surface_verdicts`
  synchronized between the YAML sidecar and the compatibility matrix.
- Do not widen a lane claim from doctor, preview, compat-lab, or release
  checklists alone.
- If no live evidence exists, record that absence explicitly and keep the lane
  label conservative.
