# PairSlash Phase 4 Quickstart

Use this path when the goal is simple: install PairSlash, run doctor, reach
`/skills`, and execute the first workflow with the least friction.

`/skills` is the canonical entrypoint on both supported runtimes.

## Codex CLI on macOS repo scope

```bash
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
```

Then:

1. Launch Codex CLI from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

## GitHub Copilot CLI on Linux user scope

```bash
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime copilot --target user --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user
```

Then:

1. Launch GitHub Copilot CLI from repo root.
2. Run `/skills`.
3. Select `pairslash-plan`.
4. Ask: `Create a repo plan from the current repo state.`

## Windows prep lane

Windows is still a prep lane in Phase 4. Use it to confirm doctor, preview, and
path/profile behavior without claiming live install parity:

```powershell
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo
node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user
```

## Acceptance automation

Run the Phase 4 acceptance slice when you need an artifact-backed smoke result:

```bash
npm run test:phase4:acceptance -- --lane macos --report-out artifacts/phase4-acceptance-macos.json
npm run test:phase4:acceptance -- --lane linux --report-out artifacts/phase4-acceptance-linux.json
npm run test:phase4:acceptance -- --lane windows-prep --report-out artifacts/phase4-acceptance-windows-prep.json
```
