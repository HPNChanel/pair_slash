# pairslash-review -- Workflow Contract

**Version:** 0.1.0  
**Phase:** 2  
**Class:** read-oriented

---

## Purpose

Review diffs or working tree changes against PairSlash constraints and produce
actionable findings with clear evidence and recommended fixes.

---

## Input contract

Required:

- `review_subject` (string)
- `diff_source` (diff text, changed file list, or scoped working tree request)

Optional:

- `scope_hint` (subsystem/path)
- `strictness` (`strict` default, `balanced`)

---

## Output contract

Deterministic markdown with sections:

1. `SUMMARY`
2. `FINDINGS`
3. `MISSING_TESTS`
4. `OPEN_QUESTIONS`
5. `RECOMMENDATION`

Each finding includes:

- severity
- file_or_area
- issue
- evidence
- recommended_fix

---

## Failure contract

- Missing diff/target -> ask and stop.
- Unreadable memory -> continue with explicit limitation note.
- No findings -> explicit no-findings statement + residual risk note.

---

## Memory contract

- Reads: `.pairslash/project-memory/`, optional `.pairslash/task-memory/`.
- Writes: none.
- Invariant: review must never mutate Global Project Memory.

---

## Side-effect contract

- Filesystem writes: none
- Git mutation: none
- Network calls: none

