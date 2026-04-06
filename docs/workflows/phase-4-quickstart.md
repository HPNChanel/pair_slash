# PairSlash Quickstart

Use this path when the goal is simple: install PairSlash, run doctor, reach
`/skills`, and execute the first workflow with the least friction.

This page covers the technically shipped installability substrate only.
It does not prove product-validation exit, broad runtime parity, or live
support beyond the exact lanes in `docs/compatibility/compatibility-matrix.md`.

PairSlash is currently at Phase 3.5 business validation on top of a technically
shipped Phase 4 installability substrate with additional Phase 5/6 hardening in
the repo. Source of truth:
`docs/phase-12/authoritative-program-charter.md`.

`/skills` is the canonical entrypoint on both supported runtimes.

The current supported quickstart path is repo-local from this checkout.
It does not imply package-manager publication.
Legal/package boundary source of truth:
`docs/releases/legal-packaging-status.md`.

This page shows direct CLI invocation (`node packages/tools/cli/src/bin/pairslash.js ...`) for runtime-neutral docs.
In this repo, use the equivalent shorthand `npm run pairslash -- <args>`.

## Codex CLI on macOS repo scope

This lane is currently `degraded`, not `stable-tested`, because the archived
live record does not include a checked-in canonical `/skills` picker capture.

```bash
node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo
node packages/tools/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes
node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo
```

Then:

1. Launch Codex CLI from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

## GitHub Copilot CLI on Linux user scope

This lane is intentionally `prep`.
Deterministic coverage exists, but no checked-in live `/skills` record is
present yet for this exact lane.
Use `docs/evidence/live-runtime/copilot-cli-user-linux.md` before widening
support wording.

```bash
node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user
node packages/tools/cli/src/bin/pairslash.js install pairslash-plan --runtime copilot --target user --apply --yes
node packages/tools/cli/src/bin/pairslash.js doctor --runtime copilot --target user
```

Then:

1. Launch GitHub Copilot CLI from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

## Windows prep lane

Windows is still a prep lane in the current public compatibility boundary.
Use it to confirm doctor, preview, and path/profile behavior without claiming
live install parity:

```powershell
node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo
node packages/tools/cli/src/bin/pairslash.js doctor --runtime copilot --target user
node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user
```

## Acceptance automation

Run compat-lab acceptance when you need an artifact-backed smoke result:

```bash
npm run test:acceptance -- --lane macos --report-out artifacts/compat-lab-acceptance-macos.json
npm run test:acceptance -- --lane linux --report-out artifacts/compat-lab-acceptance-linux.json
npm run test:acceptance -- --lane windows-prep --report-out artifacts/compat-lab-acceptance-windows-prep.json
```

## More public references

- `docs/examples/README.md`
- `docs/reporting.md`
