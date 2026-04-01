---
name: Runtime mismatch
about: Report mismatch between observed behavior and compatibility/runtime support wording
title: "[runtime-mismatch] "
labels: ["support"]
assignees: []
---

## Support claim being challenged

- Claim location (file path or docs link):
- Claim text:
- Why the claim appears incorrect:

## Runtime lane

- Runtime (`codex` or `copilot`):
- Target (`repo` or `user`):
- Runtime version:
- OS:
- Shell:
- PairSlash version:

## Observed behavior

- Command:
- Expected behavior:
- Actual behavior:
- Happens again on rerun: yes / no / unknown

## Required evidence

- [ ] Exact claim path or quote
- [ ] Runtime version and lane details
- [ ] `pairslash doctor` output
- [ ] Expected vs actual behavior

## Conditional evidence (only when relevant)

- [ ] `pairslash debug --bundle` output for live runtime mismatch
- [ ] `pairslash trace export --support-bundle --include-doctor` output for session-specific mismatch
- [ ] Pack manifest path only if mismatch is pack-specific

## Bundle safety (if attached)

- safe_to_share:
- redaction_state:
- share_safety_reasons:

