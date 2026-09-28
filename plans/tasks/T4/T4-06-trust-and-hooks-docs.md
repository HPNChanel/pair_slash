---
id: T4-06
track: T4
title: Trust/managed-hooks + runtime toggle gaps in doctor guidance
status: todo
depends_on: [T4-01]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Document the trust/interoperability surface honestly: Codex trust-by-hash hook review, managed `requirements.toml` hooks, `[features] hooks=false`, Copilot's temporarily-unavailable hook toggles, `--add-dir` skill sources — and make doctor guidance reflect them.

## Context & sources

- Codex: unmanaged hooks skipped until trusted via `/hooks`; hash-pinned re-review; managed hooks from `requirements.toml` can't be disabled by users; `[features] hooks=false` global kill (CX-10/11/12).
- Copilot: after `/plugins` removal, per-hook enable/disable toggles are temporarily unavailable (CP-19) — guidance must not reference toggles that don't exist.
- `--add-dir` discovery (CP-08) means skills may come from outside the installed roots — doctor/doctor-guidance should mention this when diagnosing "unexpected skill" issues.

## Files to touch

- `packages/tools/doctor/src/` — guidance strings for hooks states (if the checks exist) or new informational check for hooks-disabled config
- `docs/workflows/phase-4-doctor-troubleshooting.md` or successor doc — hooks troubleshooting section
- `docs/runtime-mapping/*.md` — trust-flow notes
- Do NOT touch: hook emitters (T4-01), runtime config enforcement (none exists — by design)

## Work steps

1. Add doctor awareness for `hooks = false` (Codex config) and Copilot hook-toggle gap — informational findings: "write-authority preflight hooks will be skipped while hooks are disabled".
2. Update troubleshooting doc: hook trust-review flow (Codex), Copilot toggle gap, `--add-dir` skill provenance.
3. Cross-link T4-01's emitted hooks docs.
4. Gates.

## Constraints (STRICT)

- MUST NOT instruct users to trust hooks blindly — guidance says review-then-trust (security S-rules).
- MUST NOT reference runtime features that don't exist at the documented versions (verify each claim).
- MUST keep guidance version-aware where behavior differs (hooks-disabled note is Codex-specific; toggle-gap is Copilot-specific).
- MUST NOT auto-modify runtime config to enable hooks — report only.

## Acceptance gates

- [ ] Doctor guidance covers the documented states
- [ ] Troubleshooting doc updated
- [ ] Gates green

## Evidence to record

- States documented per runtime; sources cited.

## Rollback

`git revert`.
