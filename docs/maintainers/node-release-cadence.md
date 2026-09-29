# Node.js Release Cadence & Engine Policy

Operational reference for how PairSlash tracks Node.js majors, records tested
versions, and schedules engine transitions.

## Supported range

- `engines.node`: `>=24.0.0` — the floor stays 24 while both majors are tested.
- Tested majors: **Node 24.x and Node 26.x** — both run the full gate suite in
  CI (`repo-checks`, `compat-lab-acceptance`, `compat-lab-nightly`,
  `release-trust-candidate` all matrix `["24", "26"]`).
- `@types/node` tracks the max tested major (26.x). Contributors must not use
  Node-26-only APIs while the floor is 24 — the typecheck and CI matrix are the
  enforcement, not review memory.

## Release cadence (from Node 27 onward)

Node.js moved to one major per year, released in April, with every major
becoming LTS. Implications for PairSlash:

- **Next transition: ~April 2027** (Node 27 becomes the new LTS line).
- Node 26 entered Active LTS on 2026-10-28; Node 24 moved to maintenance on
  2026-10-20 and exits support around April 2028.
- When a new major ships, the playbook is: verify locally on the new major,
  add it to the CI matrix alongside the old one, update `@types/node` to the
  new major, and only then consider moving the `engines` floor.

## Engine-floor policy

- Keep `engines` honest: only versions actually exercised in CI may be claimed
  as tested. `>=24.0.0` is a floor statement, not a per-version guarantee.
- Drop a floor only when the maintenance major blocks a real need, never on a
  calendar. Record floor bumps in the release notes and this file.
- Type-stripping is load-bearing (we run `.ts` directly via Node 24+). Recheck
  `node packages/tools/cli/src/bin/pairslash.ts` on every new major before
  trusting the matrix — flag defaults like `erasableSyntaxOnly` have changed
  between majors before.

## Verification checklist for a new major

1. Install the new major locally (nvm/volta/fnm) — do not rely on CI alone.
2. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:compat`,
   `npm run test:release` on the new major.
3. Record incompatibilities in the task evidence — "zero observed" is a valid
   entry, an absent entry is not.
4. Add the major to CI matrices (quick-checks + acceptance lanes first; not
   blindly everywhere).
5. Bump `@types/node` and verify the type surface stays clean for the floor.

## History

- 2026-09-29 — Node 26.10.0 verified locally (zero incompatibilities); CI
  matrices extended to `["24", "26"]`; `@types/node` bumped to 26.6.3;
  `engines` floor kept at `>=24.0.0`.
