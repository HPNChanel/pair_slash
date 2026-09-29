---
id: T6-03
track: T6
title: R3 — live /skills evidence capture on ≥1 lane
status: blocked
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-09-29
completed_at:
evidence: >-
  Scripted steps completed live on the codex-cli-repo-windows lane
  (codex-cli 0.153.4): doctor (support_verdict=degraded,
  install_blocked=false), preview install (can_apply=true,
  needs-explicit-approval), and install --apply on a scratch-repo mirror
  (9 managed files + journal + repo-codex_cli.json state). Records written
  to docs/evidence/live-runtime/codex-cli-repo-windows.{md,yaml};
  runtime-surface-matrix.yaml updated (install_apply: pass, last_verified_at
  2026-09-29T12:46:57.000Z, support stays prep); compatibility-matrix.md
  regenerated; npm run sync:compat-lab -- --check green. README support
  table mirrored to the matrix wording. Lane deliberately NOT promoted —
  canonical_picker remains unrecorded per runbook policy.
blocked_reason: >-
  Manual-required steps (canonical_skills_listing,
  workflow_selection_from_skills, workflow_prompt_and_response_capture,
  memory_write_preview_observation) need a human in an interactive Codex
  session on the lane — scripted substitution is forbidden by the evidence
  policy. Run-sheet for the codex-cli-repo-windows lane: (1) open an
  interactive codex session in a repo where pairslash packs are installed;
  (2) run /skills, capture the picker listing pairslash skills (note the
  surface variant: picker vs dashboard); (3) select pairslash-plan from the
  picker and capture the prompt + response; (4) run
  pairslash-memory-write-global far enough to observe the write-preview
  step; (5) write the captures into the lane .yaml/.md records with artifact
  paths and timestamps; (6) only then may the matrix move canonical_picker
  to pass and the lane toward preview. macOS lane (the recommended target)
  could not be used — this session runs on Windows.
---

## Objective

Capture canonical `/skills` live evidence on at least one runtime lane (recommend `codex-cli-repo-macos` — closest to ready) and promote it from `prep`/`degraded` to `preview` via a schema-valid lane record.

## Context & sources

- Runbook policy (runtime-surface-matrix.yaml): scripted-allowed steps (`host_profile_capture`, `runtime_version_capture`, `doctor`, `preview_install`, `install_apply`); manual-required steps (`canonical_skills_listing`, `workflow_selection_from_skills`, `workflow_prompt_and_response_capture`, `memory_write_preview_observation`).
- **New wrinkle:** Copilot's `/skills` is now a dashboard (CP-05); Codex `/skills` is a picker with `$`-mention. The lane record schema may need a `surface_variant` field to honestly describe which interaction was captured — extend schema minimally if absent.
- Windows promotion gate requires `install_apply`, `canonical_picker`, `workflow_execution` — extra requirements on Windows lanes.
- This is human-in-loop: a real interactive runtime session on the target lane.

## Files to touch

- `docs/evidence/live-runtime/<lane>.{md,yaml}` — new/updated records per `schema.live-runtime-lane-record.yaml`
- `docs/compatibility/runtime-surface-matrix.yaml` — `actual_evidence_class: live_verification`, `support_level: preview`, `last_verified_at`, `surface_verdicts.*` updates
- `docs/compatibility/runtime-verification.md` — promotion note
- Regenerated `compatibility-matrix.md`
- Possibly lane-record schema file — only to add `surface_variant` if needed
- Do NOT touch: other lanes (one lane at a time), workflow maturity labels (they derive via catalog — verify the demotion machinery computes honestly)

## Work steps

1. Choose lane (recommend codex-cli-repo-macos); read the lane's runbook_policy row.
2. Perform scripted steps on the lane: host capture, `codex --version`, `pairslash doctor`, `preview install`, `install --apply`.
3. Perform manual-required steps in the live session: open `/skills`, verify pack listed, select workflow (e.g., pairslash-plan), capture prompt+response, observe memory-write preview path.
4. Write lane records (`.yaml` per schema + `.md` narrative) with artifact paths.
5. Update matrix lane: `support_level: preview`, evidence class, timestamps, surface verdicts.
6. Regenerate matrix docs; verify catalog maturity machinery reflects honestly (likely still `canary` — expected, don't overclaim).
7. Gates incl. `sync:compat-lab -- --check`, test:release.

## Constraints (STRICT)

- MUST follow the scripted-vs-manual boundary exactly — scripted steps can't substitute manual ones (evidence policy).
- MUST NOT claim `stable-tested` — that needs repeated verification across hosts; this task targets `preview` only.
- MUST record the actual `/skills` surface variant observed (picker vs dashboard) — evidence must describe reality.
- MUST NOT fabricate any capture — absence of runtime access → `blocked` with the exact capture protocol for a human.
- Lane record MUST validate against the schema.

## Acceptance gates

- [ ] ≥1 lane at `preview` with schema-valid record, OR blocked with precise run-sheet
- [ ] `sync:compat-lab -- --check` green; matrix regenerated
- [ ] Catalog maturity labels computed correctly (no accidental promotion)
- [ ] Gates green

## Evidence to record

- Lane record paths; captured artifacts list; matrix diff.

## Rollback

Revert matrix + lane record edits in one commit; evidence captures retained (negative/positive history is valuable).
