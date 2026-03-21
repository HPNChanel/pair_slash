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
| G1 | Skill appears in /skills listing | Visible on at least one runtime | PASS | Activated via $pairslash-plan on Codex CLI v0.116.0 |
| G3 | Reads project memory | Output cites .pairslash/project-memory/ file | PASS | 8 [from memory: filename] citations in output |
| G4 | Output follows 9-section structure | All 9 sections present in order | PASS | All 9 sections present with substantive content |
| G10 | No silent memory writes | No new files in project-memory/ after invocation | PASS | git status clean after pairslash-plan invocation |

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
| G2 | Skill appears in /skills listing | Visible on at least one runtime | PASS | Activated via $pairslash-memory-write-global on Codex CLI |
| G5 | Preview patch before write | Preview appears; no premature file write | PASS | Preview in correct format, no premature writes (2/2 runs) |
| G6 | Acceptance required | "no" stops write; no new files | PASS | No write without acceptance; agent stopped at gate |
| G7 | Written record has 11 fields | All fields present in written YAML | FAIL | 9/11 fields: tags and source_refs dropped by LLM write script |

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
| V1 | `/skills` picker in Codex CLI? | NOT-TESTABLE | Requires interactive TUI; $skill-name confirmed working |
| V2 | Skill reads `.pairslash/` files from instructions? | VERIFIED | Agent read all 3 memory files via shell commands |
| V3 | Skill produces YAML preview patch reliably? | VERIFIED | Correct format in 2/2 runs, all 11 fields in preview |
| V4 | `$pairslash-plan` direct invocation in Codex CLI? | VERIFIED | Skill activated and produced full output |
| V5 | `/pairslash-plan` invocation in Copilot interactive mode? | NOT-TESTED | Copilot CLI unavailable (gh not installed) |
| V6 | `scripts/` execution in both runtimes? | NOT-APPLICABLE | No scripts in Phase 0 skills |
| V7 | Copilot `/skills reload` detects new skills mid-session? | NOT-TESTED | Copilot CLI unavailable (gh not installed) |

Record results in `phase-0/compatibility/runtime-surface-matrix.yaml`.

---

## Tier 5: SHOULD gates (non-blocking)

| Gate | Description | Status |
|------|-------------|--------|
| G11 | Both skills work on both runtimes | NOT-TESTED (Copilot CLI unavailable; Codex confirmed) |
| G12 | Duplicate detection fires on kind+title collision | PASS |
| G13 | Audit log entry created after write | PASS |
| G14 | Direct invocation (`$`/`/`) works | PASS (Codex $name confirmed; Copilot /name not tested) |

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
Phase 0 Compatibility Spike -- PARTIAL COMPLETION.

Date: 2026-03-21
Tested runtime(s): Codex CLI v0.116.0 (gpt-5.3-codex)
Not tested: GitHub Copilot CLI (gh command not available)
Tested by: automated verification via codex exec

MUST gates passed: 9 / 10
  G1-G6: PASS
  G7: FAIL (9/11 fields; tags and source_refs dropped by LLM write script)
  G8-G10: PASS (structural, previously verified)
WILL-NOT gates passed: 4 / 4
  G15-G18: PASS (unchanged)
SHOULD gates passed: 3 / 4
  G12: PASS, G13: PASS, G14: PASS (Codex only)
  G11: NOT-TESTED (Copilot CLI unavailable)
Verification items resolved: 7 / 7
  V2: VERIFIED, V3: VERIFIED, V4: VERIFIED
  V1: NOT-TESTABLE (interactive TUI only)
  V5: NOT-TESTED, V7: NOT-TESTED (Copilot CLI unavailable)
  V6: NOT-APPLICABLE (no scripts in Phase 0)

Blockers identified:
  1. G7 FAIL: LLM write script drops tags and source_refs fields.
     Preview patch is correct (11/11), but written file has 9/11.
     Root cause: R2 (LLM instruction compliance). Phase 2 scripted
     validation will enforce field completeness.
  2. Copilot CLI not available for testing. V1/V5/V7/G11 deferred.

Phase 1 preconditions met: CONDITIONAL
  Codex CLI path proven. G7 gap documented and mitigable.
  Copilot CLI verification still needed on a machine with gh installed.
```
