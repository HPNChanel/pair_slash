# Compat-Lab Bug Repro Playbook

Use this playbook to turn a support issue or suspected regression into a
deterministic compat-lab repro before widening a support claim.

If you do not already have a local `debug-report` or `support-bundle`, start
with `docs/support/phase-7-support-ops.md`. Compat-lab is for deterministic
reproduction after intake, not for skipping privacy/redaction or live-runtime
capture.

## Pick the closest fixture

- Monorepo pathing or multi-pack install drift: `repo-monorepo-workspaces`
- Backend or service workflow selection: `repo-node-service`
- Polyglot service repo regression: `repo-python-service`
- Docs-heavy planning or review drift: `repo-docs-heavy`
- Infra or release config drift: `repo-infra-repo`
- Destructive/policy/fallback issue: `repo-unsafe-repo`
- Write-authority preview or commit regression: `repo-write-authority-memory`
- Existing unmanaged runtime footprint or orphaned state: `repo-conflict-existing-runtime`

## Repro commands

Quick deterministic suite:

```bash
npm run test:compat
```

Cross-OS acceptance report:

```bash
npm run test:compat:acceptance -- --lane macos
npm run test:compat:acceptance -- --lane linux
npm run test:compat:acceptance -- --lane windows-prep
```

Refresh or verify generated artifacts:

```bash
npm run sync:compat-lab
npm run sync:compat-lab -- --check
```

## Match issue class to lab surface

- Compiler output drift:
  compare compat goldens under `packages/tools/compat-lab/goldens/`
- Generated asset or config fragment drift:
  inspect the generated-asset golden and the relevant smoke lane
- Preview or explicitness regression:
  inspect the preview no-silent-fallback golden and preview command tests
- Policy gate regression:
  run the compat behavior eval suite
- Support-lane or degraded-lane mismatch:
  inspect doctor output and the public compatibility matrix together

## Escalation rule

Do not change the public compatibility matrix because a single local run looked
good. Promote support only when:

1. deterministic compat-lab coverage is green,
2. the repro is understood or fixed, and
3. manual live evidence matches the new claim.

Keep fake-runtime compat-lab evidence separate from live support evidence. A
fake-runtime pass does not replace a real redacted support bundle from the live
failure lane.
