# pairslash-review -- Shadow Spec

**Status:** Shadow spec only -- Phase 0 comparison artifact
**Class:** read-oriented (planned)
**Phase 0 role:** Secondary -- not a primary deliverable
**Source:** CLAUDE.md Sections 9.1, 12.2

This file exists to capture the planned shape of `pairslash-review` so that
Phase 0 planning decisions can be compared against it. No SKILL.md exists.
No runtime testing is expected in Phase 0.

---

## A. Compact workflow contract

### Purpose

Review a diff, PR state, or working tree against project conventions and
constraints. Surface risks, constraint violations, and missing tests before
a commit or merge.

**What it is not:**
- It is not a planner (`pairslash-plan` is for planning).
- It is not a memory writer (it must not promote observations to Global Memory).
- It is not a code fixer or auto-committer.

### Activation

**Canonical path (both runtimes):**

```
/skills
```

Select `pairslash-review` from the skill picker.

No SKILL.md exists in Phase 0, so this path does not yet work. Invocation paths
are noted here for Phase 1 reference only.

| Runtime | Direct invocation | Status |
|---------|-------------------|--------|
| Codex CLI | `$pairslash-review` | Verify in Phase 1 |
| GitHub Copilot CLI | `/pairslash-review` in prompt | Verify in Phase 1 |

### Input contract

| Field | Required | Notes |
|-------|----------|-------|
| Diff or working tree context | Yes | Paste `git diff`, describe staged changes, or provide a PR URL |
| Scope hint | No | Which subsystem or file prefix to focus on |

The skill reads Global Project Memory to load constraints and commands.
If no diff/PR context is provided, the skill must ask before reviewing.

### Output contract

A structured review. The exact section schema is **not yet fixed** -- that is
Phase 1 design work. A proposed (non-binding) output structure:

```
### Review: <subject>

**Constraint check:**
  - [from memory: <file>] <finding>

**Risk surface:**
  - <risk> -- Likelihood: <low|medium|high> | Impact: <low|medium|high>

**Missing tests:**
  - <test gap>

**Recommendation:**
  - <proceed / hold / amend>

**Memory note:**
  - [if a new constraint or decision surfaces, tell the user to invoke
    pairslash-memory-write-global separately]
```

### Failure contract

| Condition | Behavior |
|-----------|----------|
| No diff/PR context provided | Ask for context. Do not produce a speculative review. |
| Project memory unreadable | Warn and proceed; mark findings as unchecked against constraints. |
| Review surfaces a new constraint | Note it as a candidate, but do NOT write to Global Memory. |

### Memory contract

| Layer | Permission |
|-------|------------|
| Global Project Memory | read (conventions, constraints, commands) |
| Task Memory | read (optional) |
| Any memory layer | NEVER write |

**Invariant:** `pairslash-review` MUST NOT write to Global Project Memory. If a
review surfaces knowledge worth persisting, the user must invoke
`pairslash-memory-write-global` explicitly as a separate step.

### Approval posture

None required. This workflow is fully read-oriented with no file writes or memory
mutations.

### Runtime mapping notes (Phase 1 target)

| Property | Codex CLI | Copilot CLI |
|----------|-----------|-------------|
| Repo install target | `.agents/skills/pairslash-review/` | `.github/skills/pairslash-review/` |
| User install target | `~/.agents/skills/pairslash-review/` | `~/.copilot/skills/pairslash-review/` |
| Activation (canonical) | `/skills` | `/skills` |

---

## B. Illustrative sample input and output

These are illustrative only. They are not binding contracts and are not tested
in Phase 0.

**Input:**

```
Goal: Review the working tree changes for the pairslash-plan skill before committing.
Context:
  Modified: packs/core/pairslash-plan/SKILL.md
  + ## Step 1: Load project memory
  + Read .pairslash/project-memory/00-project-charter.yaml ...
```

**Output (proposed structure, not yet fixed):**

```
### Review: pairslash-plan SKILL.md changes

**Constraint check:**
  - [from memory: 00-project-charter.yaml] Canonical entrypoint is /skills. PASS.
  - [from memory: 00-project-charter.yaml] No third-runtime references. PASS.
  - No 50-constraints.yaml found in project memory -- constraint check incomplete.

**Risk surface:**
  - Step 3 instructs the LLM to read .pairslash/ files. File read failure
    is not explicitly handled in the new section. Risk: medium.

**Missing tests:**
  - No validation artifact checks that all 9 output sections appear.
    A validation-checklist.md exists but is not automated.

**Recommendation:**
  - Proceed with commit. Open a task for file-read failure handling before Phase 1.

**Memory note:**
  - The risk around file-read failure is a candidate for task-memory or staging.
    If confirmed stable, invoke pairslash-memory-write-global to record it.
    This review workflow does not write it automatically.
```

---

## C. Why this workflow is secondary in Phase 0

1. **Architecture proof is already covered.** `pairslash-plan` proves read-from-memory.
   `pairslash-memory-write-global` proves write-to-memory. `pairslash-review` is
   another read-oriented workflow -- it adds product value but no new architectural
   proof.

2. **Output schema is not fixed.** `pairslash-plan` has a deterministic 9-section
   structure that is testable. `pairslash-review` requires its own output schema
   design before it can be verified. That design work belongs in Phase 1, not here.

3. **Testing requires a live codebase.** Review is meaningful only when there is
   code to review. Phase 0's test environment contains only the spike artifacts
   themselves. A review of spike artifacts is circular validation.

4. **Narrowness is a Phase 0 quality bar.** Adding a third working skill increases
   the runtime compatibility testing surface without adding new architectural
   insight. The Phase 0 mandate is to prove feasibility with minimum scope.

---

## D. Phase 1 deferral

`pairslash-review` is a planned product workflow, not a rejected one.
CLAUDE.md Section 9.1 lists it as a read-oriented workflow. Section 12.2
defines its purpose. It belongs in Phase 1 Core Product alongside the compiler
and installer.

**Phase 1 preconditions:**

- [ ] Fixed output schema (required sections, ordering, fail behavior)
- [ ] Defined input contract (git diff, PR URL, or working tree -- pick one primary)
- [ ] SKILL.md written to the same standard as `pairslash-plan`
- [ ] Full companion artifacts: `contract.md`, `example-invocation.md`,
      `example-output.md`, `validation-checklist.md`
- [ ] Runtime compatibility verified on both Codex CLI and Copilot CLI
- [ ] Acceptance gates written and verified (analogous to G1-G10 for the primary skills)
