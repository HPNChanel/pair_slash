# Pilot Acceptance Lanes

Phase 4 automation is local and deterministic. Support claims still need
runtime evidence.

## Lanes

- macOS pilot: Codex CLI, repo target, `preview install`, `install --apply --yes`, `doctor`
- Linux pilot: GitHub Copilot CLI, user target, `preview install`, `install --apply --yes`, `doctor`
- Windows prep lane: `doctor`, `preview install`, and install-root/path/profile checks only unless live runtime evidence is recorded

## Automation baseline

Phase 4 now ships an acceptance slice that exercises installability as a
product surface without claiming live runtime evidence:

```bash
npm run test:phase4:acceptance -- --lane macos --report-out artifacts/phase4-acceptance-macos.json
npm run test:phase4:acceptance -- --lane linux --report-out artifacts/phase4-acceptance-linux.json
npm run test:phase4:acceptance -- --lane windows-prep --report-out artifacts/phase4-acceptance-windows-prep.json
```

The acceptance slice covers:

- fresh install repo-scope
- fresh install user-scope
- update that preserves a valid local override
- uninstall that removes only PairSlash-owned assets
- doctor catching a broken setup

The JSON report is an automation baseline for CI and reproducibility. It is not
a substitute for live interactive runtime evidence.

## Minimum commands

```bash
node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo

node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user
node packages/cli/src/bin/pairslash.js install pairslash-plan --runtime copilot --target user --apply --yes
node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user
```

## Evidence discipline

- Record what runtime and OS were actually used.
- Keep Windows as a prep lane until the runtime behavior is observed, not inferred.
- Do not mark a lane supported only because fake-runtime tests passed.
- Treat `npm run test:phase4:acceptance` as installability evidence, not as a
  replacement for `/skills` interaction notes or live runtime verification.
