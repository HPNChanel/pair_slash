# pairslash-memory-candidate -- Validation Checklist

Use this checklist to verify strict extraction behavior for the candidate
workflow.

---

## Structural checks (no CLI required)

- [ ] `packs/core/pairslash-memory-candidate/SKILL.md` exists
- [ ] `SKILL.md` has valid frontmatter with `name` and `description`
- [ ] `SKILL.md` states no-write rule for `.pairslash/project-memory/`
- [ ] `SKILL.md` defines exactly 4 required output sections
- [ ] `SKILL.md` includes the 4-class classification enum
- [ ] `packages/core/spec-core/specs/pairslash-memory-candidate.spec.yaml` exists
- [ ] `packages/core/spec-core/schemas/candidate-report.schema.yaml` exists
- [ ] `packs/core/pairslash-memory-candidate/contract.md` exists
- [ ] `packs/core/pairslash-memory-candidate/example-invocation.md` exists
- [ ] `packs/core/pairslash-memory-candidate/example-output.md` exists

---

## Contract checks (strict gate behavior)

- [ ] Missing evidence claim is never classified as `keep-as-candidate`
- [ ] Duplicate claim is always classified `duplicate-existing`
- [ ] Conflicting claim is always classified `needs-supersede-review`
- [ ] Weak single-source claim is always `too-weak-do-not-promote`
- [ ] Output missing required field triggers failure, not partial success
- [ ] NEXT_ACTION is one of the 3 allowed values

---

## Runtime checks (manual)

- [ ] Install skill to runtime skill path
- [ ] Invoke workflow in strict mode
- [ ] Confirm output has exactly:
  - [ ] PLAN
  - [ ] CANDIDATES
  - [ ] RECONCILIATION
  - [ ] NEXT_ACTION
- [ ] Confirm every candidate contains evidence entries with source anchors
- [ ] Confirm duplicates/supersede flags align with reconciliation section
- [ ] Confirm `.pairslash/project-memory/` remains unchanged after invocation

---

## Test scenarios

- [ ] Scenario A: claim duplicates active memory -> classify duplicate-existing
- [ ] Scenario B: claim updates active memory statement -> classify needs-supersede-review
- [ ] Scenario C: claim appears only in one prompt-local instruction -> classify too-weak-do-not-promote
- [ ] Scenario D: claim has multi-source concrete evidence and no conflict -> classify keep-as-candidate
- [ ] Scenario E: cannot read project-memory index -> block keep-as-candidate and downgrade/reject

---

## Regression checks

- [ ] Re-run previous failing candidate extraction prompts and compare outcomes
- [ ] No candidate is produced from speculation alone
- [ ] NEXT_ACTION remains consistent with candidate quality distribution
