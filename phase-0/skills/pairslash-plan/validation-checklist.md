# pairslash-plan -- Validation Checklist

Use this checklist to verify that a `pairslash-plan` invocation is working
correctly. Each item maps to an acceptance gate in
`phase-0/compatibility/acceptance-gates.yaml`.

---

## Structural checks (no CLI required)

These can be verified from Cursor or any text editor.

- [ ] `phase-0/skills/pairslash-plan/SKILL.md` exists
- [ ] `SKILL.md` has valid YAML frontmatter with `name` and `description` fields
- [ ] `SKILL.md` body begins with a clear "read-oriented" declaration
- [ ] `SKILL.md` contains "MUST NOT write" invariant
- [ ] `SKILL.md` Step 1 instructs loading `.pairslash/project-memory/` files
- [ ] `SKILL.md` Step 3 defines all 9 output sections in order
- [ ] `SKILL.md` Rules section prohibits memory writes explicitly
- [ ] `phase-0/specs/pairslash-plan.spec.yaml` exists and parses as valid YAML
- [ ] `phase-0/skills/pairslash-plan/contract.md` exists with all 7 contract sections
- [ ] `phase-0/skills/pairslash-plan/example-invocation.md` exists
- [ ] `phase-0/skills/pairslash-plan/example-output.md` exists with all 9 plan sections

---

## Installation checks (require a terminal)

- [ ] `cp -r phase-0/skills/pairslash-plan .agents/skills/` succeeds (Codex CLI)
  OR
  `cp -r phase-0/skills/pairslash-plan .github/skills/` succeeds (Copilot CLI)
- [ ] `ls .agents/skills/pairslash-plan/SKILL.md` (or `.github/`) returns the file
- [ ] `.pairslash/project-memory/00-project-charter.yaml` exists at the repo root

---

## Runtime checks (require a live CLI session)

Each check maps to an acceptance gate. Record pass/fail and evidence.

### G1 -- Skill appears in /skills listing

- [ ] Launch CLI from the repo root
- [ ] Use `/skills` (or equivalent) to list available skills
- [ ] `pairslash-plan` appears in the list
- Evidence: _______________

### G3 -- Skill reads project memory

- [ ] Invoke the skill with any concrete goal
- [ ] Output cites at least one file from `.pairslash/project-memory/`
- [ ] Citation format is `[from memory: filename]` or equivalent
- Evidence: _______________

### G4 -- Output follows the 9-section structure

- [ ] Invoke the skill with a concrete goal
- [ ] Verify all 9 section headers appear in output, in this order:
  - [ ] Goal
  - [ ] Constraints
  - [ ] Relevant project memory
  - [ ] Proposed steps
  - [ ] Files likely affected
  - [ ] Tests and checks
  - [ ] Risks
  - [ ] Rollback
  - [ ] Open questions
- [ ] No section is silently omitted (missing sections show "None identified.")
- Evidence: _______________

### G10 -- No silent memory writes

- [ ] After invoking the skill, verify no files in `.pairslash/project-memory/`
  were created or modified
- [ ] `git status` (or equivalent) shows no changes to `.pairslash/project-memory/`
- Evidence: _______________

---

## Behavioral quality checks (subjective, reviewer judgment)

These are not binary pass/fail but are important for Phase 0 quality.

- [ ] Facts are labeled `[from memory]`; assumptions are labeled `[assumption]`
- [ ] When goal is vague, the skill asks a clarifying question rather than
  producing a speculative plan
- [ ] When project memory is missing, the skill warns rather than silently
  proceeding as if memory exists
- [ ] Risks section includes likelihood, impact, and mitigation for each risk
- [ ] Rollback section provides specific commands, not generic advice
- [ ] Open questions section distinguishes "I don't know X" from "I assumed X"

---

## Scope containment checks (G15-G18)

- [ ] Output contains no references to Cursor, Claude Code, or other runtimes
  as product targets
- [ ] Output contains no instructions to write to project memory
- [ ] Output contains no references to background daemons or hidden state
- [ ] All memory path references point to `.pairslash/`, not external stores

---

## What to record after testing

Update these files with evidence:

1. `phase-0/compatibility/runtime-surface-matrix.yaml`
   - V1: did `/skills` picker work in Codex CLI?
   - V2: did the skill read `.pairslash/` files from instructions?
   - V4: did `$pairslash-plan` direct invocation work?
   - V5: did `/pairslash-plan` work in Copilot CLI interactive mode?

2. `phase-0/compatibility/acceptance-gates.yaml`
   - G1, G3, G4, G10: update `status` to `pass` or `fail` with `evidence`

3. If a MUST gate fails, open a new issue or task before closing Phase 0.
