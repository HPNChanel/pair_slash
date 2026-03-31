# PairSlash Product-Validation Benchmark Tasks

This file defines the current product-validation benchmark system for
PairSlash. The directory path is legacy. The benchmark method in this file is
the active source of truth for the current business-validation phase.

## Benchmark doctrine

- Measure painpoint win, not implementation breadth.
- Use the same runtime, repo snapshot, evaluator, and success criteria on both
  the baseline arm and the PairSlash arm.
- Baseline means the raw terminal AI workflow the user would otherwise use on
  the same runtime, plus any manual repo work needed to finish the job.
- Official benchmark evidence excludes installability-only, doctor-only, and
  preview-only technical acceptance runs.
- Negative runs, weak runs, and mixed runs must be logged immediately. No
  cherry-picking.

## Required evidence for every official run

Every official paired run must capture:

- `paired_group_id`
- workflow and scenario
- runtime (`codex-cli` or `github-copilot-cli`)
- repo snapshot reference
- exact task statement
- frozen success criteria
- exact baseline prompt or method
- exact PairSlash prompt or path
- time-to-first-success
- task success
- manual rescue count
- reprompt count after first answer
- weekly reuse answer and reason
- required artifacts for that workflow

## Official benchmark set

There are three required wedge benchmarks. The memory wedge has two required
scenarios. The next-week retention question is measured through reuse answers
and delayed follow-up notes, not as a separate primary benchmark.

## W1. Repo onboarding and re-orientation

**Workflow:** `pairslash-onboard-repo`

**Pain this must solve:** the user returns to a repo cold, does not trust a
generic summary, and wastes time rebuilding context by hand.

**Task setup:**

- Use a real repo snapshot with enough ambiguity to punish shallow summaries.
- Freeze the success criteria before either arm runs.
- Good default repo shapes are docs-heavy repos, monorepos, or real repos with
  stale doc noise and active constraints.

**Baseline method:**

- Use the same runtime and model in raw CLI mode.
- Ask for repo orientation without PairSlash workflows.
- Allow the same filesystem visibility PairSlash gets.

**PairSlash method:**

- Start from `/skills`.
- Run `pairslash-onboard-repo`.
- Allow follow-up only if it still stays inside the onboarding job.

**Primary metrics:**

- time-to-first-success delta vs raw CLI
- task success without manual rescue
- orientation accuracy against frozen success criteria
- weekly reuse answer

**Required artifacts:**

- baseline transcript or notes
- PairSlash transcript or notes
- repo snapshot reference
- evaluator notes on false assumptions or missed constraints

**Pass signals:**

- PairSlash beats the raw CLI baseline on speed or matches speed with clearly
  better correctness.
- The onboarding result points to the right files, risks, and next workflow.
- The user gives a credible `likely_yes` or `default_path` reuse answer.

**Failure signals:**

- The output is mostly a polished repo summary with no trust advantage.
- PairSlash needs manual rescue to find the real constraints.
- The raw CLI arm is faster and just as actionable.

## W2. Trust-memory flow

**Workflow:** `pairslash-memory-candidate -> pairslash-memory-write-global`

**Pain this must solve:** project truth gets lost in chat debris, private notes,
or weak memory writes the user cannot trust later.

This wedge has two required scenarios. Both are mandatory before any memory
claim can move the product phase.

### W2a. Memory happy path

**Task setup:**

- Use a repo state with one evidence-backed durable fact worth saving.
- Freeze the required record fields before the run.
- Use real or realistic existing project memory so reconciliation is not fake.

**Baseline method:**

- Use raw CLI to identify the durable fact.
- Have the user manually draft or update the memory record and verify conflicts
  by hand.

**PairSlash method:**

- Start from `/skills`.
- Run `pairslash-memory-candidate`.
- Promote the accepted candidate through `pairslash-memory-write-global`.

**Primary metrics:**

- trust-boundary integrity
- preview-to-write fidelity
- task success without manual rescue
- weekly reuse answer

**Required artifacts:**

- candidate output
- preview artifact
- written record or commit result
- audit-log reference
- memory-index reference

**Pass signals:**

- Candidate extraction stays evidence-first and reconciles against authoritative
  memory.
- Preview appears before any write.
- Explicit acceptance is required.
- Written record matches the staged preview exactly.

**Failure signals:**

- Any hidden or implicit durable write.
- Candidate promotion happens without strong evidence.
- Preview and written output drift.

### W2b. Guardrail rejection and fidelity path

**Task setup:**

- Use conflicting evidence, duplicate evidence, or thin evidence on purpose.
- Freeze what a correct rejection or downgrade looks like before the run.

**Baseline method:**

- Use raw CLI to assess the same evidence and decide whether to write.
- Manual conflict checking is allowed, but it must be logged.

**PairSlash method:**

- Start from `/skills`.
- Run `pairslash-memory-candidate` and `pairslash-memory-write-global` against
  the weak or conflicting case.

**Primary metrics:**

- rejection correctness
- trust-boundary integrity
- clarity of blocking explanation
- weekly reuse answer

**Required artifacts:**

- conflicting or weak evidence source refs
- candidate output
- preview or rejection artifact
- any policy or audit artifact produced

**Pass signals:**

- The workflow stops, downgrades, or rejects the write correctly.
- The user stays inside the trust boundary.
- The explanation is plain enough that the user knows what blocked the write.

**Failure signals:**

- The workflow accepts the write anyway.
- Conflicts or ambiguity are hidden.
- Guardrails are framed as optional friction rather than the product value.

## W3. Review/fix loop

**Workflow:** `pairslash-review` plus an explicit user-approved fix handoff

**Pain this must solve:** repeated review churn, almost-right AI output, and
cleanup loops that feel fast at first but cost time later.

**Task setup:**

- Use a pinned diff or working tree snapshot with at least one real issue, one
  missing-test implication, and one possible red herring.
- Freeze the exact issue and success criteria before the run.

**Baseline method:**

- Use the same runtime and model in raw CLI mode.
- Run the review and fix loop without PairSlash workflows.

**PairSlash method:**

- Start from `/skills`.
- Run `pairslash-review`.
- Only allow an explicit fix handoff after the review step is inspected.

**Primary metrics:**

- issue reproducibility rate
- rework reduction vs raw CLI
- task success without manual rescue
- weekly reuse answer

**Required artifacts:**

- diff or working tree snapshot
- review report
- fix attempt notes
- test or verification output

**Pass signals:**

- PairSlash reproduces the real issue before proposing the fix.
- Cleanup burden is lower than the raw CLI baseline.
- The workflow stays explicit and does not drift into hidden autonomous fixing.

**Failure signals:**

- PairSlash reads like a generic code review with no repo-grounded trust gain.
- The fix path jumps ahead of the evidence path.
- Review/fix wins only because the task is too easy to expose workflow value.

## Longitudinal follow-up rule

At least two official runs in each 30-day cycle should include a delayed
follow-up note after five to ten days, or a disciplined delayed replay, to test
whether the workflow result was still useful later. This is supporting evidence
for the north-star metric, not a fourth wedge benchmark.

## Runtime coverage rule

- `W1` needs at least one official paired run on each supported runtime before
  broader onboarding claims are allowed.
- `W2a` and `W2b` must both pass on Codex CLI and GitHub Copilot CLI before the
  trust-memory wedge counts as validated.
- `W3` can begin on the primary runtime, but it needs a second-runtime spot
  check before any broad review/fix utility claim.
- No installability-only or doctor-only run may be relabeled as `W1`, `W2`, or
  `W3`.
