# PairSlash 0.4.0 Upgrade Notes

## Who needs to act

- Maintainers cutting repo releases
- Users carrying legacy install state without trust receipts
- Anyone verifying PairSlash release-trust bundles locally

## What changed

- `npm run test:release` now includes release-trust bundle build and
  structural verification.
- Signed release-trust bundles are now reserved for protected CI with
  `PAIRSLASH_RELEASE_TRUST_PRIVATE_KEY` and
  `PAIRSLASH_RELEASE_TRUST_KEY_ID`.
- Protected release lanes enforce `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1` so
  signing configuration drift hard-fails the gate.
- The checked-in public verification root is now
  `trust/first-party-keys.json`.
- Central authority for `core-maintained` packs and high-risk capabilities is
  now `trust/pack-authority.yaml`.
- The previous public `0.2.0` changelog and upgrade notes are now archived
  internally and are no longer part of the current public release surface.

## Maintainer verification steps

1. Run `npm run test:release`.
2. If you are in the protected signing lane, set
   `PAIRSLASH_RELEASE_TRUST_PRIVATE_KEY` and
   `PAIRSLASH_RELEASE_TRUST_KEY_ID`, then rerun `npm run test:release`.
3. In protected CI (`repo-checks`, `compat-lab-nightly`, or
   `release-trust-candidate`), keep `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1`.
4. Build the signed bundle you intend to publish with
   `npm run release:trust:build -- --out <path>`.
5. Verify the resulting signed bundle with
   `npm run release:trust:verify -- --trust-dir <path>`.

## Legacy install note

- Legacy installs without trust receipts should be reviewed with
  `pairslash doctor`.
- Reinstall or update legacy packs so the install state records a current
  trust receipt before you treat the install as release-verified.

## No migration implied

- No Global Project Memory schema migration is required.
- No new runtime is added.
- No package-manager publication is introduced.

## Support claim boundary

Use `docs/compatibility/compatibility-matrix.md` and
`docs/compatibility/runtime-surface-matrix.yaml` for every public support
statement. This upgrade does not by itself promote any runtime lane.
