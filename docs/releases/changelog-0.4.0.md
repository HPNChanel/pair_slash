# PairSlash 0.4.0 Changelog

Status: current scoped release notes for the 0.4.0 repo line
Gate status: `NO-GO` as of 2026-04-17 (`docs/releases/scoped-release-verdict.md`)

## Release scope

- Project release: `0.4.0`
- Scope: repo-local PairSlash CLI usage on Codex CLI and GitHub Copilot CLI
- Canonical entrypoint remains `/skills`
- Public support claims remain exactly the lanes recorded in
  `docs/compatibility/runtime-surface-matrix.yaml`

## What is implemented on this branch

- Phase 20 release-trust activation is implemented and wired into the release
  gate on this branch.
- `npm run test:release` now requires release-trust bundle build plus checksum-backed
  structural verification on the current branch.
- Protected CI is the only approved lane for live-signed release-trust bundles.
  The checked-in public verification root lives in `trust/first-party-keys.json`.
- Protected release lanes now run with `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1`
  (`repo-checks`, `compat-lab-nightly`, and `release-trust-candidate`) so
  missing signing material fails closed.
- Central pack trust authority now lives in `trust/pack-authority.yaml` so
  `core-maintained` and high-risk capability authority are not pack-local
  self-claims.
- Doctor and preview/install trust posture messaging now keeps local-source,
  local-policy-trusted external packs, legacy installs, and PairSlash-maintained
  releases more explicit.

## What this release does not claim

- Product-validation exit or market validation.
- Runtime parity outside the documented compatibility lanes.
- Live support promotion beyond the checked-in runtime evidence.
- Package-manager publication or public `@pairslash/*` package artifacts.

## Trust verification surfaces

- Structural release gate: `npm run test:release`
- Local bundle build: `npm run release:trust:build`
- Local bundle verification:
  - structural: `npm run release:trust:verify -- --mode structural`
  - signed bundle: `npm run release:trust:verify`

## Support boundary reminder

- `codex-cli-repo-macos` remains `degraded`
- `copilot-cli-user-linux` remains `prep`
- `codex-cli-repo-windows` remains `prep`
- `copilot-cli-user-windows` remains `prep`

Those labels can move only when `docs/evidence/live-runtime/*` and
`docs/compatibility/runtime-verification.md` are updated with exact-lane live
evidence.
