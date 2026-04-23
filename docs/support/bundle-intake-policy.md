# Support Bundle Intake Policy

This policy defines when reporters and maintainers should collect and share a PairSlash support bundle.

## Intake rule

1. Start with `pairslash doctor`.
2. Collect a support bundle only when doctor output is not decisive, or when trust-boundary behavior is unclear.
3. Prefer the smallest artifact needed for the next triage step.

## Redaction and share safety

- `safe_to_share: true` with `redaction_state: shareable` is the only state suitable for public issue attachments.
- If `safe_to_share: false` or `redaction_state: review-required`, keep the bundle local and share sanitized summaries only.
- Always review `privacy-note.txt` before attaching any file outside your machine.

## Required fields for artifact-heavy intake

- `session_id`
- `bundle_id`
- `safe_to_share`
- `redaction_state`
- `share_safety_reasons`
- runtime + target + runtime version (if known)

## Allowed collection commands

```bash
npm run pairslash -- debug --latest --runtime <codex|copilot> --bundle --format text
npm run pairslash -- trace export --session <session-id> --runtime <codex|copilot> --support-bundle --include-doctor --format text
```

## Routing boundary

- Install and lifecycle failures: `surface:install-lifecycle`
- Runtime claim/behavior mismatch: `surface:runtime-mismatch`
- Workflow behavior failures: `surface:workflow`
- Memory trust-boundary failures: `surface:memory`

Use `docs/phase-9/issue-taxonomy.md` and `docs/support/triage-playbook.md` for label and escalation decisions.
