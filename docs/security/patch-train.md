# Patch Train

Phase 10 patch handling stays narrow: restore release credibility without turning PairSlash into a governance suite.

## Trigger

- security report confirmed
- release trust regression confirmed
- install/update trust gate bypass confirmed
- support-bundle evidence shows a reproducible trust-layer defect

## Patch Flow

1. Reproduce on the affected runtime and target lane.
2. Confirm whether the issue is:
   - release integrity
   - pack trust
   - upgrade safety
   - security process only
3. Prepare the smallest patch that fixes the issue without changing `/skills`, hidden-write rules, or runtime scope.
4. Run the relevant checks:
   - `npm run lint`
   - `npm run test`
   - `npm run test:acceptance`
   - focused install/update/doctor coverage on the affected lane
5. If release-trust artifacts are part of the fix, rebuild and verify them explicitly.
6. Publish notes that state what is fixed, what evidence exists, and what is still not claimed.

## Advisory Linkage

- Every advisory should point to:
  - patched version or commit
  - affected runtime lane
  - affected trust boundary
  - mitigation if users cannot patch immediately

## What Not To Do

- do not publish an advisory before a patch or mitigation exists
- do not inflate scope into generic enterprise governance
- do not collapse fake-runtime evidence into live-runtime claims
- do not enable hidden telemetry to speed up triage
