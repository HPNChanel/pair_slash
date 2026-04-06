# Contributing To PairSlash

PairSlash is a trust layer for terminal-native AI workflows.
Contribution scope is intentionally narrow:

- Exactly two runtimes: Codex CLI and GitHub Copilot CLI
- `/skills` remains the canonical front door
- Global Project Memory is explicit-write-only and reviewable

Repository source is licensed under Apache-2.0.
That does not widen package publication: root and PairSlash-owned package
manifests remain `private`, and the supported install path stays repo-local
from this checkout.

## Start

Use Node `>=24.0.0` and `npm@11.7.0`.

```bash
npm install
npm run lint
npm run test
```

Use `doctor` before reporting environment problems:

```bash
npm run pairslash -- doctor --runtime auto --target repo
```

Issue intake lives under `.github/ISSUE_TEMPLATE/`.

## Contributor Lanes

### Pack authors

Own workflow behavior and pack metadata in `packs/core/*`.

- Keep pack scope task-first and runtime-aware.
- Preserve explicit write authority boundaries.
- Update tests or fixtures when pack behavior changes.
- Include pack manifest compatibility notes when relevant.

### Runtime adapter contributors

Own runtime-specific behavior under `packages/runtimes/*` and related tooling.

- Do not introduce a third runtime.
- Keep `/skills` as the primary entrypoint.
- Preserve deterministic install/update/uninstall behavior.
- Validate both runtime lanes when behavior diverges.

### Docs contributors

Own docs clarity and claim accuracy under `docs/`.

- Align support wording to `docs/compatibility/compatibility-matrix.md`.
- Keep onboarding and troubleshooting task-first.
- Downgrade docs claims when evidence is not strong enough.
- Do not claim hidden memory behavior or autopilot behavior.

### Release and triage contributors

Own intake quality, reproducibility hygiene, and regression routing.

- Follow `docs/reporting.md`.
- Ask for the smallest useful artifact first.
- Distinguish code bug vs docs drift vs evidence gap.
- Keep support claims aligned with runtime verification evidence.

## PR Expectations

- Keep changes single-purpose.
- Include lane impact in PR description (`codex`, `copilot`, or `shared`).
- Include commands run (`lint`, `test`, and targeted checks).
- Add or update tests for behavior changes.
- Do not widen support claims without compatibility and runtime-verification updates.

## Support And Issue Routing

- Install or lifecycle bug: use [.github/ISSUE_TEMPLATE/install-bug.md](.github/ISSUE_TEMPLATE/install-bug.md).
- Runtime mismatch: use [.github/ISSUE_TEMPLATE/runtime-mismatch.md](.github/ISSUE_TEMPLATE/runtime-mismatch.md).
- Workflow bug: use [.github/ISSUE_TEMPLATE/workflow-bug.md](.github/ISSUE_TEMPLATE/workflow-bug.md).
- Memory trust bug: use [.github/ISSUE_TEMPLATE/memory-bug.md](.github/ISSUE_TEMPLATE/memory-bug.md).
- Pack request: use [.github/ISSUE_TEMPLATE/pack-request.yml](.github/ISSUE_TEMPLATE/pack-request.yml).
- Docs drift: use [.github/ISSUE_TEMPLATE/docs-problem.yml](.github/ISSUE_TEMPLATE/docs-problem.yml).

If you already have local support artifacts, use [.github/ISSUE_TEMPLATE/pairslash-support-bundle.md](.github/ISSUE_TEMPLATE/pairslash-support-bundle.md).
