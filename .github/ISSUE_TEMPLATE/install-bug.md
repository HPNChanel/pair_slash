---
name: Install bug
about: Report install, update, uninstall, preview, or doctor lifecycle failures
title: "[install] "
labels: ["support", "surface:install-lifecycle", "status:needs-info"]
assignees: []
---

## Summary

- Expected:
- Actual:
- First visible symptom:

## Install lifecycle scope

- Runtime (`codex` or `copilot`):
- Target (`repo` or `user`):
- Runtime version:
- OS:
- Shell:
- PairSlash version:
- Command:

## Reproduction

1. Step 1:
2. Step 2:
3. Step 3:

- Happens again on rerun: yes / no / unknown

## Required evidence

- [ ] `pairslash doctor` output (paste or attach)
- [ ] Exact command and flags
- [ ] Expected vs actual behavior

## Conditional evidence (only when relevant)

- [ ] `pairslash debug --bundle` output when doctor is not decisive
- [ ] `pairslash trace export --support-bundle --include-doctor` output for session-specific failures
- [ ] `pairslash lint` output only for local checkout or pack manifest editing

## Bundle safety (if attached)

- safe_to_share:
- redaction_state:
- share_safety_reasons:
