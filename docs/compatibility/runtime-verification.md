# PairSlash Runtime Verification

Use this checklist when you are collecting manual live evidence for the public
compatibility matrix. Compat-lab automation is deterministic and release-gating,
but it does not replace live `/skills` verification.

Canonical lane records live under `docs/evidence/live-runtime/`.
Each lane record must separate deterministic evidence, fake/shim evidence, and
live evidence before the matrix is updated.
Each lane also needs a YAML sidecar with freshness, required evidence class,
host profile count, and negative evidence when present.

Do not use this page as the install guide. Start with
`docs/workflows/install-guide.md`.

If a live verification step fails and you need maintainer support, switch to the
support flow in `docs/support/phase-7-support-ops.md` and capture a local
support bundle before sharing anything externally.

Live runtime verification can widen support truth only.
It does not publish any `@pairslash/*` package, change `NOTICE` requirements,
or alter the repo-local packaging boundary recorded in
`docs/releases/legal-packaging-status.md`.

## Before you start

- Complete managed install for the target lane.
- Open `docs/compatibility/compatibility-matrix.md` and confirm which support
  level the lane currently claims.
- Keep notes on the exact runtime version, OS, shell, and what you actually saw.
- If a surface is degraded, prep-only, or blocked, record that explicitly. Do
  not infer success from deterministic compat-lab coverage alone.

## Preview, degraded, or stable-tested lane verification

Run these steps inside the live runtime from repo root:

1. Launch the runtime and open `/skills`.
2. Verify the expected PairSlash workflows are visible.
3. Run `pairslash-plan` through `/skills` and confirm it behaves like a
   read-oriented workflow.
4. Run `pairslash-memory-write-global` and confirm:
   - preview appears before any write
   - explicit confirmation is required
   - no hidden writes occur
   - rejected or blocked previews do not silently fall back
5. Confirm read workflows do not mutate `.pairslash/project-memory/`.
6. Record whether the evidence class is `live_smoke`, `live_verification`, or
   `repeated_live_verification`.
7. If the lane is degraded, record exactly which caveat still applies.
8. If the lane is preview, make sure the canonical `/skills` path is part of
   the recorded proof.
9. Only promote to `stable-tested` after repeated canonical live verification
   exists on at least two distinct host profiles and two distinct dates.

## Prep lane verification

For prep lanes, do not promote support claims from doctor/preview alone.

Verify only what the lane actually promises:

1. `pairslash doctor`
2. `pairslash preview install ...`
3. Any install-root, shell-profile, or path-resolution checks relevant to the
   runtime

Only move a prep lane beyond prep when real install and `/skills` evidence is
captured.

## Record results

When evidence changes, update:

- `docs/evidence/live-runtime/<lane>.md`
- `docs/compatibility/runtime-surface-matrix.yaml`
- `docs/compatibility/compatibility-matrix.md`
- `docs/troubleshooting/compat-lab-bug-repro.md` if a new repro path or caveat
  becomes part of maintainer workflow

Keep manual evidence separate from deterministic compat-lab output. The matrix
must tell users what is truly supported today.
Do not flatten fake/shim acceptance into live evidence in the lane record.
Do not use runtime verification results as package-publication evidence.
One-off live runs do not justify `stable-tested`.

## Support capture

When live verification fails in a way that doctor output alone cannot explain:

```bash
node packages/tools/cli/src/bin/pairslash.js debug --latest --runtime codex --bundle --format text
node packages/tools/cli/src/bin/pairslash.js trace export --session <session-id> --runtime codex --support-bundle --include-doctor --format text
```

Review `privacy-note.txt` and `bundle-manifest.json` before attaching the
bundle outside the machine.
