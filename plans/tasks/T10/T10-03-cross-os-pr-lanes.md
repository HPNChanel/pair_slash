---
id: T10-03
track: T10
title: Cross-OS PR acceptance lanes (macOS/Windows deterministic)
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Extend PR-level CI beyond ubuntu-only: run the deterministic acceptance suite on `macos-latest` + `windows-latest` for relevant changes — real-OS regression coverage without relying solely on nightly.

## Context & sources

- July plan intent (M1.5): extend `phase4-acceptance.yml` to 3-OS matrix — verify current state (nightly already has 3-OS; PR lane may not).
- Cost mitigation: gate the extended lanes on path filters (`packages/**`, `packs/**`, `tests/**`, workflows) or run them on `main`-bound PRs only — decide + record.
- Deterministic lanes only — fake/shim compat-lab acceptance, NOT live runtime evidence (that stays T6's human-captured domain).

## Files to touch

- `.github/workflows/phase4-acceptance.yml` (or wherever acceptance runs on PR)
- Possibly `.github/workflows/repo-checks.yml` path filters
- Do NOT touch: nightly matrix (already 3-OS), lane evidence claims (deterministic coverage ≠ live evidence — C.6)

## Work steps

1. Read current workflow triggers/matrix — find where the acceptance suite runs on PRs.
2. Add macOS + Windows to the PR lane matrix; add path filters if cost discipline requires.
3. Verify Windows lane actually green today on main first (fix forward if the suite is ubuntu-assumptive — path handling, shell, etc.).
4. Record the cost/coverage decision in the workflow comment + commit.
5. Gates.

## Constraints (STRICT)

- MUST keep deterministic — no live runtime calls in PR lanes.
- MUST NOT weaken existing gates to gain OS coverage — failures on Windows/macOS are findings, not skip-candidates (if a test is truly OS-specific, mark `skip` with reason per node:test convention, not deleted).
- Path filters MUST include all files that could affect the suite — an over-narrow filter is silent coverage loss.
- MUST document that PR OS coverage is deterministic-class evidence only (docs note).

## Acceptance gates

- [ ] 3-OS acceptance green on a test PR/push
- [ ] Path filters documented
- [ ] Gates green

## Evidence to record

- Matrix diff; first green run refs; cost decision.

## Rollback

`git revert`.
