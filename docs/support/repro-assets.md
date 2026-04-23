# Reality Scan

PairSlash support intake should ask for the minimum evidence needed to classify and route an issue.
This file defines required and conditional assets by issue surface so maintainers can stay local-first and avoid over-collection.

# Decisions

## Required Repro Assets By Issue Surface

| Issue surface | Required first-contact evidence | Conditional next evidence | Do not require initially |
| --- | --- | --- | --- |
| Install bug (`surface:install-lifecycle`) | Exact command, runtime/target, OS/shell, runtime version (if known), `pairslash doctor` output, expected vs actual | `pairslash debug --bundle` or `pairslash trace export --support-bundle --include-doctor` when doctor is not decisive; `pairslash lint` only for local pack/manifest edits | Compat-lab run by reporter |
| Runtime mismatch (`surface:runtime-mismatch`) | Claim path or quote, runtime/target, runtime version, `pairslash doctor` output, observed behavior | Support bundle or trace export for session-level mismatch; pack manifest info only when mismatch is pack-specific | Lint output, full repo archive |
| Workflow bug (`surface:workflow`) | Workflow or pack id, task statement, runtime lane, expected vs actual, `/skills` invocation yes/no | Doctor output when setup ambiguity exists; support bundle/trace export when live failure is captured | Compat-lab from casual reporter |
| Memory bug (`surface:memory`) | Workflow id, command sequence, preview/apply status, expected vs actual, whether authoritative memory changed | Support bundle/trace export for trust-boundary ambiguity; audit/index refs when already available | Manual full diff of `.pairslash/project-memory/` |
| Pack request (`surface:pack-discovery`) | Job to be done, runtime lane, repo archetype, desired first workflow, why existing packs fail | Example repo and tool constraints | Support bundle, trace export, doctor |
| Docs/problem report (`surface:docs-nav-wording`) | Doc path, exact stale text/command, correction, source-of-truth file | Optional command output when behavior mismatch is part of the report | Support bundle, trace export |

## Commands For Artifact Collection

Use CLI entrypoint from repo root:

```bash
npm run pairslash -- doctor --runtime <codex|copilot|auto> --target <repo|user>
npm run pairslash -- debug --latest --runtime <codex|copilot> --bundle --format text
npm run pairslash -- trace export --session <session-id> --runtime <codex|copilot> --support-bundle --include-doctor --format text
npm run pairslash -- lint
```

`pairslash lint` is only for pack authoring or local checkout drift, not default support intake.

## Evidence Escalation Rules

1. Start with doctor output.
2. Ask for a support bundle only when doctor is not decisive or trust boundary is unclear.
3. Ask for trace export only when session-level forensic details are needed.
4. Ask for lint only for local pack/manifest or contributor checkout issues.
5. Ask for compat-lab only after maintainer triage.

# File/Path Plan

- Issue template entrypoints: `.github/ISSUE_TEMPLATE/`
- Support bundle shape: `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`
- Taxonomy source: `docs/phase-9/issue-taxonomy.md`
- Maintainer routing source: `docs/phase-9/maintainer-playbook.md`
- Support ops baseline: `docs/support/phase-7-support-ops.md`

# Risks / Bugs / Drift

- Requiring too much evidence up front reduces issue quality and completion.
- Missing runtime version data weakens mismatch triage.
- Asking for lint by default confuses non-contributor reporters.
- Skipping docs/source-of-truth references creates docs drift loops.

# Acceptance Checklist

- Every issue surface has clear first-contact evidence requirements.
- Commands are concrete and runnable in repo context.
- Doctor/trace/lint/support bundle asks are scoped and conditional.
- Casual users are not asked for maintainer-only artifacts.

# Next Handoff

- Add copy-ready snippets from this file into issue template help text if maintainers need shorter prompts.
- Add template validation checks in CI for required field presence.

