---
id: T6-01
track: T6
title: R1 — record official Phase-19 benchmark round 1
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
blocked_reason:
---

## Objective

Run and record the first official benchmark round under the Phase-19 method — the missing evidence that keeps `docs/validation/phase-3-5/verdict.md` at `NO-GO`.

## Context & sources

- Apparatus exists: `npm run benchmark:validate|capture|score|evidence|case|replay`, `npm run benchmark:round1`; truth sources `docs-private/validation/...`/`benchmark-*.yaml` files; raw logs are maintainer-local.
- Must-win workflows per the method: `pairslash-plan`, `pairslash-memory-write-global` on a real Codex repo lane.
- Human-in-loop: running real workflows on a real runtime needs maintainer execution — an agent session can prepare and validate, the capture may need a human. If so: `blocked` with a precise run-sheet is correct.

## Files to touch

- `benchmark-truth.yaml` (path per `docs-private/validation/` or charter pointer — verify active file)
- `docs/validation/phase-3-5/verdict.md` — ONLY if scoring actually satisfies criteria; else dated gap note
- `.pairslash/audit-log/` or benchmark evidence dir per convention
- Do NOT touch: benchmark scoring code (unless real bug → X3), raw log publication (maintainer-local)

## Work steps

1. Verify the active benchmark method files (truth catalog, task catalog, log schema, scoring rubric, lane wording).
2. Run `npm run benchmark:validate` → fixtures consistent.
3. Execute round 1 per the method on the documented lane(s); capture raw logs maintainer-local.
4. `npm run benchmark:score`; persist scoring artifact.
5. Update `benchmark-truth.yaml` at policy-permitted granularity; update `verdict.md` only if criteria met — else record the dated gap.
6. Gates: lint, test, test:release.

## Constraints (STRICT)

- MUST follow the documented method exactly — no ad-hoc scoring adjustments to reach GO (C.10 honest failure).
- MUST NOT publish raw logs into public surfaces — granularity limits per public-claim policy.
- MUST NOT move `verdict.md` past what evidence supports — NO-GO stays unless criteria met.
- If runtime access unavailable → `blocked` with run-sheet; do NOT fabricate rounds.

## Acceptance gates

- [ ] Round recorded with timestamps + lane IDs OR dated gap documented
- [ ] `npm run test:release` green
- [ ] No public wording outruns evidence

## Evidence to record

- benchmark-truth entries; verdict delta (if any); commit hash.

## Rollback

Revert `verdict.md`/`benchmark-truth.yaml` to prior commit; raw logs remain maintainer-local.
