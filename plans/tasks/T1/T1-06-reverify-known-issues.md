---
id: T1-06
track: T1
title: Re-verify known issues K1 (Copilot -p) and K3 (Codex PowerShell sandbox)
status: done
depends_on: [T1-01]
est_size: M
claimed_by: devin-session
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  - K1 retest-protocol-filed: copilot binary absent on verification host (`gh copilot --version` → "! Copilot CLI not installed"); protocol + negative record in copilot-cli-user-windows.{md,yaml}; status stays blocked
  - K3 retest-protocol-filed: codex 0.153.4 present and authenticated, but `codex exec --sandbox read-only` run rejected by host usage quota; attempt recorded as negative record (host_quota_limited); protocol in codex-cli-repo-windows.{md,yaml}; status stays degraded
  - matrix known_issues details updated with dated retest-pending notes; no support_level or status changes
  - npm run test (green), npm run lint (green), npm run sync:compat-lab -- --check (green)
---

## Objective

Re-test the two standing known issues against current runtimes and update their matrix entries with fresh, dated evidence — keeping `blocked`/`degraded` if still true, or recording resolution if upstream fixed them.

## Context & sources

- K1: "Copilot direct invocation with -p/--prompt is blocked" — upstream changelog (v1.0.8x) says plugin-provided agents/skills/MCP no longer drop in non-interactive `-p` runs (CP-07/CP-17). Whether PairSlash's *installed* skills behave the same needs testing.
- K3: "Codex read-only sandbox complex PowerShell" degraded — Codex sandbox hardening happened through the summer (CX-27); needs re-verification on current build.
- Evidence rules: lane-record schema `docs/evidence/live-runtime/schema.live-runtime-lane-record.yaml`; `live_smoke` can't promote beyond prep/degraded; `live_verification` needed for claims.
- This task may be partially human-in-loop — real runtime execution on the affected lanes. If the executor lacks the runtime, produce a *verification protocol* doc and mark those sub-steps deferred-to-T6 rather than fabricating.

## Files to touch

- `docs/evidence/live-runtime/{copilot-cli-*,codex-cli-*}.{md,yaml}` — dated notes/superseding records as appropriate
- `docs/compatibility/runtime-surface-matrix.yaml` — `known_issues` rows only if evidence supports a status change
- Regenerated `compatibility-matrix.md` if matrix touched
- Do NOT touch: `support_level` fields (issue resolution ≠ lane promotion), README known-issues wording (sync only if matrix changes)

## Work steps

1. For K1: locate the original blocking evidence record; identify the test that would prove resolution (`copilot -p` run with plugin-skill visible). If Copilot CLI available: run it, capture output, record as live evidence. If not: write the exact verification protocol into the lane record notes + mark "retest pending — see T6".
2. For K3: same pattern — the complex-PowerShell-in-sandbox scenario; run if Codex available, else defer with protocol.
3. If either issue resolves: update matrix `known_issues` row (status → resolved/superseded with evidence ref + date). If still failing: refresh the evidence date, keep status.
4. Regenerate matrix docs; sync check; gates.

## Constraints (STRICT)

- MUST NOT mark an issue resolved on changelog evidence alone — only live observation or deterministic reproduction resolves (C.6).
- MUST preserve original evidence records — new evidence supersedes, doesn't erase.
- MUST NOT fabricate live runs — absent runtime → defer with protocol, not claims.
- If schema lacks a status for "superseded-but-unverified", extend schema minimally rather than overloading an existing value dishonestly.

## Acceptance gates

- [ ] Each known issue has a dated status: confirmed-still-true / resolved-with-evidence / retest-protocol-filed
- [ ] `npm run sync:compat-lab -- --check` green if matrix edited
- [ ] Gates green
- [ ] No support_level changes

## Evidence to record

- Per-issue evidence record path + status decision + reasoning in commit body.

## Rollback

`git revert` — evidence files are additive; matrix row changes revert cleanly.
