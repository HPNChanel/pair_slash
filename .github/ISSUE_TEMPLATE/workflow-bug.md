---
name: Workflow bug
about: Report incorrect behavior in a shipped workflow or pack
title: "[workflow] "
labels: ["support", "surface:workflow", "status:needs-info"]
assignees: []
---

## Workflow scope

- Workflow ID:
- Pack ID:
- Invoked via `/skills`: yes / no
- Runtime (`codex` or `copilot`):
- Target (`repo` or `user`):
- Runtime version:
- PairSlash version:

## Task and behavior

- Task statement:
- Expected behavior:
- Actual behavior:
- First visible symptom:

## Reproduction

1. Step 1:
2. Step 2:
3. Step 3:

- Happens again on rerun: yes / no / unknown

## Required evidence

- [ ] Workflow ID or pack ID
- [ ] Task statement
- [ ] Expected vs actual behavior
- [ ] Runtime lane details

## Conditional evidence (only when relevant)

- [ ] `pairslash doctor` output if setup may be involved
- [ ] `pairslash debug --bundle` output for runtime failures
- [ ] `pairslash trace export --support-bundle --include-doctor` output for session-specific failures

## Bundle safety (if attached)

- safe_to_share:
- redaction_state:
- share_safety_reasons:
