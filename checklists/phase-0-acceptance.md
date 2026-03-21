# PairSlash Phase 0 -- Master Acceptance Checklist

This is the single authoritative checklist for declaring Phase 0 complete.

**Phase 0 is done when:**
- All MUST gates pass (G1-G10).
- All WILL-NOT gates remain pass (G15-G18).
- All unverified items (V1-V7) have a recorded status (even if "not available").
- Risks are updated with test evidence.

SHOULD gates (G11-G14) are expected but non-blocking.

**Where to record results:**
- Per-gate evidence: `phase-0/compatibility/acceptance-gates.yaml`
- Per-item evidence: `phase-0/compatibility/runtime-surface-matrix.yaml`
- Test steps: `docs/phase-0/runtime-verification.md`

---

## Tier 1: Structural checks (no CLI required)

These were verified on 2026-03-21 from Cursor. Re-verify if any files change.

- [x] `.pairslash/project-memory/` exists with charter, stack profile, and index
- [x] `.pairslash/task-memory/`, `sessions/`, `audit-log/`, `staging/` all exist
- [x] All 9 YAML files parse without errors
- [x] Both SKILL.md files have valid frontmatter (`name` + `description`)
- [x] `pairslash-plan` SKILL.md contains explicit write prohibition
- [x] `pairslash-memory-write-global` SKILL.md contains preview + acceptance gates
- [x] No SKILL.md references a third runtime (G15)
- [x] No SKILL.md references MCP, vector DB, or background daemons (G16)
- [x] `runtime-surface-matrix.yaml` contains V1-V7 with status fields (G9)

---

## Tier 2: MUST gates -- blocking (require live CLI)

All must pass. Record pass/fail and evidence for each.

### pairslash-plan

| Gate | Description | Pass criteria | Status | Evidence |
|------|-------------|---------------|--------|---------|
| G1 | Skill appears in /skills listing | Visible on at least one runtime | UNTESTED | |
| G3 | Reads project memory | Output cites .pairslash/project-memory/ file | UNTESTED | |
| G4 | Output follows 9-section structure | All 9 sections present in order | UNTESTED | |
| G10 | No silent memory writes | No new files in project-memory/ after invocation | UNTESTED | |

**Quick test sequence (pairslash-plan):**
1. Install to runtime skill directory (see `phase-0/install-guide.md`)
2. Launch CLI from repo root
3. Invoke: `/skills` picker or `$pairslash-plan`/`/pairslash-plan`
4. Goal: "Add rate limiting to the API gateway"
5. Check: all 9 sections in output?
6. Check: any .pairslash/ file cited?
7. Check: `git status` shows no changes to `project-memory/`

### pairslash-memory-write-global

| Gate | Description | Pass criteria | Status | Evidence |
|------|-------------|---------------|--------|---------|
| G2 | Skill appears in /skills listing | Visible on at least one runtime | UNTESTED | |
| G5 | Preview patch before write | Preview appears; no premature file write | UNTESTED | |
| G6 | Acceptance required | "no" stops write; no new files | UNTESTED | |
| G7 | Written record has 11 fields | All fields present in written YAML | UNTESTED | |

**Quick test sequence (pairslash-memory-write-global, happy path):**
1. Install to runtime skill directory
2. Launch CLI from repo root
3. Invoke: `/skills` picker or direct invocation
4. Input (all 7 required fields):
   ```
   kind: constraint
   title: No external deps without review
   statement: Any new external dependency must be reviewed by two maintainers.
   evidence: Team agreement sprint retrospective 2026-03-18.
   scope: whole-project
   confidence: high
   action: append
   ```
5. Check: preview patch appears (G5)?
6. Say "no" -- check no file written (G6)?
7. Repeat and say "yes" -- check all 11 fields in written file (G7)?

**Quick test sequence (rejection gate):**
1. Invoke with incomplete input (omit `evidence`):
   ```
   kind: command
   title: Run tests before push
   statement: Always run the test suite before pushing to main.
   scope: whole-project
   confidence: high
   action: append
   ```
2. Check: workflow rejects immediately and lists `evidence` as missing?

---

## Tier 3: WILL-NOT gates -- scope containment

These must all remain pass. If any fail, the implementation has scope-crept.

| Gate | Description | Status |
|------|-------------|--------|
| G15 | No third runtime references in skills | PASS (verified 2026-03-21) |
| G16 | No MCP, vector DB, or background daemons | PASS (verified 2026-03-21) |
| G17 | No read-workflow memory mutation | PASS (verified 2026-03-21) |
| G18 | No out-of-scope memory authority | PASS (verified 2026-03-21) |

Re-run this check if any SKILL.md is edited:

```bash
# Check for third-runtime references
grep -ri "claude.code\|claude-code\|cursor runtime\|background daemon" phase-0/skills/

# Check for MCP/vector/daemon
grep -ri "MCP\|vector.*database\|background daemon" phase-0/skills/
```

Both should return zero matches.

---

## Tier 4: Verification items (V1-V7)

Each must have a recorded status. "Not available" is a valid outcome if documented.

| Item | Question | Status | Fallback |
|------|----------|--------|---------|
| V1 | `/skills` picker in Codex CLI? | UNVERIFIED | `$skill-name` direct invocation |
| V2 | Skill reads `.pairslash/` files from instructions? | UNVERIFIED | User pastes memory content |
| V3 | Skill produces YAML preview patch reliably? | UNVERIFIED | Strengthen instructions; Phase 2 scripts |
| V4 | `$pairslash-plan` direct invocation in Codex CLI? | UNVERIFIED | `/skills` browser |
| V5 | `/pairslash-plan` invocation in Copilot interactive mode? | UNVERIFIED | `/skills list` + select |
| V6 | `scripts/` execution in both runtimes? | UNVERIFIED | Phase 0 instruction-only |
| V7 | Copilot `/skills reload` detects new skills mid-session? | UNVERIFIED | Restart CLI |

Record results in `phase-0/compatibility/runtime-surface-matrix.yaml`.

---

## Tier 5: SHOULD gates (non-blocking)

| Gate | Description | Status |
|------|-------------|--------|
| G11 | Both skills work on both runtimes | UNTESTED |
| G12 | Duplicate detection fires on kind+title collision | UNTESTED |
| G13 | Audit log entry created after write | UNTESTED |
| G14 | Direct invocation (`$`/`/`) works | UNTESTED |

**Test for G12 (duplicate detection):**
1. Successfully write a record (complete G7 first)
2. Attempt to write a record with the same `kind` and `title`
3. Check: does the workflow halt and show the duplicate?

**Test for G13 (audit log):**
1. Complete any write (accept or reject)
2. Check: `ls .pairslash/audit-log/`
3. Verify: a new file exists with `result: success` or `result: rejected`

---

## Phase 0 completion statement

When all items in Tier 1, 2 (MUST), and 3 (WILL-NOT) are checked, and all
V1-V7 items have recorded statuses, complete this statement:

```
Phase 0 Compatibility Spike completed.

Date: _______________
Tested runtime(s): _______________
Tested by: _______________

MUST gates passed: ___ / 10
WILL-NOT gates passed: 4 / 4
SHOULD gates passed: ___ / 4
Verification items resolved: ___ / 7

Blockers identified (if any): _______________
Phase 1 preconditions met: yes / no
```
