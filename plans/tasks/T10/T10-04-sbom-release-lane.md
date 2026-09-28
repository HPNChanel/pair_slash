---
id: T10-04
track: T10
title: Release-lane SBOM artifact + audit hardening
status: todo
depends_on: []
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
---

## Objective

Produce a CycloneDX SBOM artifact on the release lane and confirm the `npm audit` gate is enforced at the right level — closing the supply-chain gap noted since July.

## Context & sources

- `repo-checks.yml` already runs `npm audit --audit-level=high --omit=dev` on quick-checks (verify it's actually present/enforced — confirmed in read).
- Missing: SBOM artifact on release lane (`dist/sbom.cyclonedx.json` intent from July M1).
- Tooling: `npm sbom` (built-in, produces CycloneDX/SPDX) — prefer built-in over new dep; verify output format vs release-trust consumer expectations.

## Files to touch

- `.github/workflows/release-trust-candidate.yml` — SBOM generation + artifact upload step
- Possibly `scripts/` — SBOM verify step (checksum/SBOM consistency into release-trust bundle?)
- `docs/releases/` — note the SBOM in release artifacts docs
- Do NOT touch: trust/signing internals

## Work steps

1. Verify `npm sbom` output format + completeness for this workspace (multi-package workspaces — does it cover workspace deps? Test).
2. Add release-lane step generating `sbom.cyclonedx.json` + upload as artifact; include in release-trust bundle inputs if the trust format supports extra artifacts (check `release-trust.ts` schema — don't force it if the format is closed; attach as sibling artifact).
3. Confirm `npm audit` gate presence + level; document what's covered vs not.
4. Gates.

## Constraints (STRICT)

- MUST NOT weaken `REQUIRE_SIGNED` or trust-bundle verification to fit SBOM in — SBOM is additive metadata.
- MUST NOT commit SBOM to source on every PR — release-lane artifact only (it's generated, churny).
- Prefer `npm sbom` (zero new deps) — a new dep needs G9 review.
- SBOM MUST reflect actual resolved deps (lockfile truth), not declared ranges.

## Acceptance gates

- [ ] Release lane produces valid CycloneDX SBOM artifact
- [ ] Audit gate documented + enforced
- [ ] Gates green

## Evidence to record

- Sample SBOM summary (dep count, format version); artifact ref.

## Rollback

`git revert`.
