# Supply-Chain Gates

What CI currently enforces about dependency and artifact integrity, and where
the boundaries are.

## npm audit gate

- `repo-checks.yml` quick-checks runs
  `npm audit --audit-level=high --omit=dev` on every PR and main push, on both
  tested Node majors.
- Coverage boundary: production dependencies only (`--omit=dev`), high and
  critical severities only. Dev-tooling vulnerabilities and moderate/low
  findings are visible in `npm audit` output but do not gate.
- The repo ships near-zero production dependencies; the gate is still
  load-bearing because workspace manifests can grow deps over time.

## Release-lane SBOM

- Both release lanes emit an unsigned CycloneDX SBOM companion:
  - `release-trust-candidate.yml` (protected, on dispatch/tags)
  - `repo-checks.yml` release-gates (main pushes, when the signed lane fires)
- Generated with `npm sbom --sbom-format cyclonedx --sbom-type application`
  — no new dependency, output reflects the lockfile (resolved versions), not
  declared ranges.
- The SBOM lands inside the uploaded `release-trust` artifact directory as
  `sbom.cyclonedx.json`, **after** the trust-bundle build and verification
  steps. It is deliberately outside the signed checksum set: SBOMs are
  metadata for consumers, not signed truth (adding them would mean every
  dependency refresh invalidates the signed bundle).
- Verified format locally on 2026-09-29: CycloneDX 1.5, application type,
  workspace packages + resolved dependencies enumerated.

## What this does NOT cover

- No dependency pinning beyond `package-lock.json` (no vendoring, no
  integrity re-verification against a second source).
- No provenance attestation for npm publication — publication itself is not
  claimed yet (see `docs/releases/legal-packaging-status.md`).
- The SBOM is unsigned — treat it as advisory inventory, not authenticated
  supply-chain proof.
