# PairSlash Phase 3.5 Benchmark Task Catalog

This catalog defines repeatable terminal-native benchmark tasks for Phase 3.5.
Tasks are selected for real recurring work, not for easy demos.

Coverage targets:

- 10 tasks total (required range: 8-12)
- Deep coverage on three wedge workflows:
  - `onboard-repo`
  - `review/fix loop`
  - `memory-candidate -> memory-write-global`

Priority groups:

- `must_win`: 3 tasks
- `should_win`: 3 tasks
- `supporting`: 4 tasks

## Must Win Tasks

### BM-ONB-01

- Task ID: `BM-ONB-01`
- Priority: `must_win`
- User type: `p1_power_user_terminal`, `p1_tech_lead_maintainer_staff`
- Scenario: Cold-start onboarding on an unfamiliar active repo.
- Trigger: First session after assignment or context switch.
- Input state:
  - repo has existing `.pairslash/project-memory/`
  - user has no recent local context
  - runtime is Codex CLI or GitHub Copilot CLI
- Success condition:
  - first viable plan grounded in authoritative project memory
  - no durable memory write during onboarding flow
  - user can name the next concrete action without manual repo spelunking
- Failure modes:
  - ignores authoritative memory
  - hallucinates repo truth
  - triggers or suggests hidden write behavior
  - first output is generic and not actionable
- Why it matters:
  - cold-start cost is recurring and expensive
  - this is the first trust checkpoint for repeat use
- PairSlash value thesis mapping:
  - primary: `repo_understanding`
  - secondary: `repeatable_safe_workflow`

### BM-RFL-01

- Task ID: `BM-RFL-01`
- Priority: `must_win`
- User type: `p1_power_user_terminal`, `p1_tech_lead_maintainer_staff`
- Scenario: Review/fix loop on failing tests after a code change.
- Trigger: CI/test failure or local test breakage.
- Input state:
  - reproducible failing test in repo
  - logs and file diff available
  - runtime supports terminal task execution
- Success condition:
  - test moves from failing to passing with no manual rescue
  - no policy-breaking or unsafe shortcuts introduced
  - fix path is understandable and can be rerun next week
- Failure modes:
  - repeated dead-end re-prompts
  - human takes over core fix path (manual rescue)
  - fix passes locally but causes regression
  - flow cannot be reused
- Why it matters:
  - review/fix loop is high-frequency and high-cost
  - almost-right AI output often creates rework here
- PairSlash value thesis mapping:
  - primary: `repeatable_safe_workflow`
  - secondary: `repo_understanding`

### BM-MEM-02

- Task ID: `BM-MEM-02`
- Priority: `must_win`
- User type: `p1_power_user_terminal`, `p1_tech_lead_maintainer_staff`, `p2_platform_devex_internal_tooling`
- Scenario: Promote a validated memory candidate into Global Project Memory.
- Trigger: new decision/constraint/pattern must become durable project truth.
- Input state:
  - candidate exists with source evidence
  - memory write request is explicit
  - authoritative memory already present
- Success condition:
  - preview patch shown before write
  - explicit acceptance captured before durable mutation
  - audit trail fields complete and coherent
  - no hidden write side effects
- Failure modes:
  - missing preview
  - missing explicit acceptance
  - weak evidence promoted anyway
  - audit metadata missing or inconsistent
- Why it matters:
  - this is the core trust wedge of PairSlash
  - failure here invalidates trust-layer positioning
- PairSlash value thesis mapping:
  - primary: `disciplined_project_memory`
  - secondary: `repeatable_safe_workflow`

## Should Win Tasks

### BM-ONB-02

- Task ID: `BM-ONB-02`
- Priority: `should_win`
- User type: `p1_power_user_terminal`, `p1_tech_lead_maintainer_staff`, `p3_oss_maintainer_consultant`
- Scenario: Re-onboard after 7+ day gap with changed repo state.
- Trigger: user returns after break and must continue active work.
- Input state:
  - repo has new commits and changed constraints
  - previous session context is stale
- Success condition:
  - context recovery includes what changed and what to do next
  - no major missed constraint in first action plan
- Failure modes:
  - stale or contradictory summary
  - misses critical changes
  - user needs manual reconstruction to proceed
- Why it matters:
  - tests memory continuity and practical weekly reuse
- PairSlash value thesis mapping:
  - primary: `repo_understanding`
  - secondary: `disciplined_project_memory`

### BM-RFL-02

- Task ID: `BM-RFL-02`
- Priority: `should_win`
- User type: `p1_tech_lead_maintainer_staff`, `p2_platform_devex_internal_tooling`
- Scenario: Process PR review comments into a fix-test cycle.
- Trigger: reviewer requests changes before merge.
- Input state:
  - PR feedback exists
  - baseline branch and test command are known
- Success condition:
  - fixes address comments and pass relevant tests
  - loop requires low re-prompt count
  - output is reviewer-ready and reproducible
- Failure modes:
  - misses reviewer intent
  - adds new defects while fixing
  - requires repeated manual intervention
- Why it matters:
  - recurring maintainer workflow with direct rework cost
- PairSlash value thesis mapping:
  - primary: `repeatable_safe_workflow`
  - secondary: `repo_understanding`

### BM-MEM-03

- Task ID: `BM-MEM-03`
- Priority: `should_win`
- User type: `p1_tech_lead_maintainer_staff`, `p2_platform_devex_internal_tooling`
- Scenario: Guardrail rejection for weak or conflicting memory evidence.
- Trigger: request to write memory with poor proof or contradictions.
- Input state:
  - conflicting source refs or duplicate claims
  - candidate is intentionally weak
- Success condition:
  - workflow rejects or blocks write with clear reason
  - user gets next-step guidance to strengthen evidence
- Failure modes:
  - accepts write despite conflict
  - unclear reason for rejection
  - suggests bypassing explicit controls
- Why it matters:
  - trust requires safe refusal, not just successful writes
- PairSlash value thesis mapping:
  - primary: `disciplined_project_memory`
  - secondary: `repeatable_safe_workflow`

## Supporting Tasks

### BM-RFL-03

- Task ID: `BM-RFL-03`
- Priority: `supporting`
- User type: `p1_power_user_terminal`, `p3_oss_maintainer_consultant`
- Scenario: Reproduce and isolate issue from sparse bug report.
- Trigger: open issue with incomplete reproduction steps.
- Input state:
  - issue report exists but lacks exact reproduction
  - repo can run tests or app locally
- Success condition:
  - issue is reproducible with documented steps
  - root cause hypothesis is evidence-backed
- Failure modes:
  - non-reproducible after run
  - high manual rescue to reach reproduction
  - weak or speculative root cause
- Why it matters:
  - issue reproducibility is an operating KPI for roadmap execution
- PairSlash value thesis mapping:
  - primary: `repeatable_safe_workflow`
  - secondary: `repo_understanding`

### BM-MEM-01

- Task ID: `BM-MEM-01`
- Priority: `supporting`
- User type: `p1_power_user_terminal`, `p1_tech_lead_maintainer_staff`
- Scenario: Extract memory candidates from repo change and session evidence.
- Trigger: significant change lands and may alter project truth.
- Input state:
  - code diff, notes, and references available
  - authoritative memory can be read
- Success condition:
  - candidates are concise, evidence-backed, and deduplicated
  - weak claims are tagged as non-promotable
- Failure modes:
  - speculative candidates dominate
  - duplicates or contradictions not detected
  - candidate list not reviewable
- Why it matters:
  - candidate quality controls downstream memory trust
- PairSlash value thesis mapping:
  - primary: `disciplined_project_memory`
  - secondary: `repo_understanding`

### BM-OPS-01

- Task ID: `BM-OPS-01`
- Priority: `supporting`
- User type: `p2_platform_devex_internal_tooling`, `p3_oss_maintainer_consultant`
- Scenario: Install and doctor check on clean environment.
- Trigger: first-time setup or repair after environment drift.
- Input state:
  - clean or intentionally drifted local environment
  - one supported runtime selected
- Success condition:
  - install succeeds
  - doctor reports healthy state or clear actionable fix
  - no third-runtime suggestion appears
- Failure modes:
  - install fails without recovery path
  - doctor output is non-actionable
  - runtime boundaries are violated
- Why it matters:
  - install/doctor success rate is a business-first operations KPI
- PairSlash value thesis mapping:
  - primary: `repeatable_safe_workflow`
  - secondary: `repo_understanding`

### BM-CONT-01

- Task ID: `BM-CONT-01`
- Priority: `supporting`
- User type: `p1_power_user_terminal`, `p1_tech_lead_maintainer_staff`, `p3_oss_maintainer_consultant`
- Scenario: Resume weekly workflow from durable memory and recent repo changes.
- Trigger: weekly return to ongoing task stream.
- Input state:
  - prior session artifacts exist
  - project memory contains prior decisions
- Success condition:
  - user reaches first useful action faster than raw baseline
  - user reports likely weekly reuse (score >= 2)
- Failure modes:
  - stale context leads to wrong first action
  - no measurable speed gain vs raw CLI baseline
  - participant labels flow as novelty-only
- Why it matters:
  - repeated weekly use is core Phase 3.5 retention signal
- PairSlash value thesis mapping:
  - primary: `disciplined_project_memory`
  - secondary: `repo_understanding`

## Ranking Summary

### Must Win

- `BM-ONB-01`
- `BM-RFL-01`
- `BM-MEM-02`

### Should Win

- `BM-ONB-02`
- `BM-RFL-02`
- `BM-MEM-03`

### Supporting

- `BM-RFL-03`
- `BM-MEM-01`
- `BM-OPS-01`
- `BM-CONT-01`
