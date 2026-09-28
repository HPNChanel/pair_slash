---
id: T4-05
track: T4
title: Observability notes — /usage skill activity + trace alignment
status: todo
depends_on: [T4-04]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Document how PairSlash workflows surface in the runtimes' new observability surfaces (Codex `/usage` skill activity, Copilot dashboards) and align PairSlash's own trace telemetry vocabulary with them — docs + trace-field review, not new telemetry.

## Context & sources

- Codex `/usage` shows account usage, token totals, **plugin and skill activity** (CX-15) — PairSlash-installed skills will appear there; workflow authors should know.
- PairSlash trace: `packages/tools/trace` (events, telemetry_eligible flags, redaction_tags) — verify field semantics still map cleanly onto what runtimes now expose.
- Privacy posture: `telemetry_eligible` + redaction discipline already exists; confirm nothing about new runtime observability surfaces leaks more than intended.

## Files to touch

- `docs/workflows/` or `docs/support/` — observability notes doc (new or existing file per convention)
- `packages/tools/trace/src/` — only if a field/vocab adjustment is genuinely needed (prefer none)
- `packs/core/*/SKILL.md` or docs — a "workflow authors: skill activity is visible in /usage" note where appropriate
- Do NOT touch: telemetry emission defaults, redaction lists (separate concern), any live telemetry plumbing

## Work steps

1. Write the observability notes doc: what `/usage` shows for skills, what Copilot dashboard shows, what PairSlash trace adds, privacy notes.
2. Review `trace` event vocabulary vs runtime activity naming — record alignment gaps (e.g., skill-name ↔ pack-name mapping) in the doc; only patch trace fields if there's an actual mismatch bug (X3 rule).
3. Update pack authoring docs (`pack-lifecycle-checklist.md`?) with the "your skill activity is user-visible" note.
4. Gates.

## Constraints (STRICT)

- MUST NOT enable new telemetry or weaken redaction — docs + at most vocab alignment.
- MUST NOT claim observability integration as a shipped feature — it's a documentation note about runtime behavior (C.6/D1).
- If trace changes are needed, they MUST NOT change event schemas consumed elsewhere (backward-compat).

## Acceptance gates

- [ ] Observability doc written and linked
- [ ] Authoring docs updated
- [ ] Gates green

## Evidence to record

- Doc path; alignment-gap findings list.

## Rollback

`git revert` — docs-only.
