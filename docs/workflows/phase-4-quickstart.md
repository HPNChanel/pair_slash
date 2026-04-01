# PairSlash Quickstart (Phase 6 Compat-Lab Baseline)

Use this path when the goal is simple: install PairSlash, run doctor, reach
`/skills`, and execute the first workflow with the least friction.

`/skills` is the canonical entrypoint on both supported runtimes.

This page shows direct CLI invocation (`node packages/tools/cli/src/bin/pairslash.js ...`) for runtime-neutral docs.
In this repo, use the equivalent shorthand `npm run pairslash -- <args>`.

## Codex CLI on macOS repo scope

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

Windows is still a prep lane in Phase 6. Use it to confirm doctor, preview, and
path/profile behavior without claiming live install parity:

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

## Phase 9 proof placeholders

Use these docs for public proof scaffolding. They are placeholders until
measurement fields and artifact references are filled:

- `docs/benchmarks/README.md`
- `docs/case-studies/onboard-repo-before-after.md`
- `docs/case-studies/memory-write-global-trust-event.md`
- `docs/case-studies/failure-mode-runtime-mismatch.md`
