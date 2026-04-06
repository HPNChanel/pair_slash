# PairSlash Reporting Guide

Use this page when PairSlash fails on a real machine and you need to file an issue
without widening public support claims.

## Start with local evidence

Run `doctor` first:

```bash
npm run pairslash -- doctor --runtime <codex|copilot|auto> --target <repo|user>
```

If the problem is still unclear, capture a local artifact:

```bash
npm run pairslash -- debug --latest --runtime <codex|copilot> --bundle --format text
npm run pairslash -- trace export --session <session-id> --runtime <codex|copilot> --support-bundle --include-doctor --format text
```

Review the generated privacy note before sharing anything outside your machine.

## Choose the right issue template

- Install or lifecycle bug: [install-bug.md](../.github/ISSUE_TEMPLATE/install-bug.md)
- Runtime mismatch: [runtime-mismatch.md](../.github/ISSUE_TEMPLATE/runtime-mismatch.md)
- Workflow bug: [workflow-bug.md](../.github/ISSUE_TEMPLATE/workflow-bug.md)
- Memory trust bug: [memory-bug.md](../.github/ISSUE_TEMPLATE/memory-bug.md)
- Pack request: [pack-request.yml](../.github/ISSUE_TEMPLATE/pack-request.yml)
- Docs problem: [docs-problem.yml](../.github/ISSUE_TEMPLATE/docs-problem.yml)

If you already have local artifacts, use
[pairslash-support-bundle.md](../.github/ISSUE_TEMPLATE/pairslash-support-bundle.md).

## Public boundary

- Public support wording still comes from the [compatibility matrix](compatibility/compatibility-matrix.md).
- `doctor` and support bundles are local diagnosis artifacts, not public support promotion.
- Maintainer-only triage runbooks live outside the public docs surface.
