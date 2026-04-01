---
name: Memory bug
about: Report preview/apply/audit issues for explicit Global Project Memory workflows
title: "[memory] "
labels: ["support"]
assignees: []
---

## Memory workflow scope

- Workflow (`pairslash-memory-candidate` or `pairslash-memory-write-global`):
- Invoked via `/skills`: yes / no
- Runtime (`codex` or `copilot`):
- Target (`repo` or `user`):
- Runtime version:
- PairSlash version:

## Command and trust event

- Command sequence:
- Preview shown before apply: yes / no
- Apply executed: yes / no
- Authoritative memory changed: yes / no / unknown

## Expected vs actual

- Expected behavior:
- Actual behavior:
- First visible symptom:

## Required evidence

- [ ] Command sequence and workflow ID
- [ ] Expected vs actual behavior
- [ ] Whether preview and apply matched
- [ ] Runtime lane details

## Conditional evidence (only when relevant)

- [ ] `pairslash debug --bundle` output for trust-boundary ambiguity
- [ ] `pairslash trace export --support-bundle --include-doctor` output for session-level forensics
- [ ] Memory audit/index references if already available

## Bundle safety (if attached)

- safe_to_share:
- redaction_state:
- share_safety_reasons:

