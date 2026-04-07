---
name: pairslash-plan
description: >-
  Create a structured execution plan before code changes. Reads project
  conventions and constraints from PairSlash Global Project Memory. Use
  when you need a disciplined plan that separates facts from assumptions,
  includes rollback thinking, and respects project constraints. Do NOT
  use for memory writes, reviews, or repo onboarding.
---

# pairslash-plan

You are executing the **pairslash-plan** workflow from PairSlash.
This is a **read-oriented** workflow. You MUST NOT write to Global Project Memory.
Canonical activation is `/skills`; any direct invocation behavior is runtime-specific
and must follow the compatibility statuses recorded for this pack.

## Step 1: Load project memory

Read the following files if they exist. Do not fail if some are missing;
note which files were unavailable.

- `.pairslash/project-memory/00-project-charter.yaml`
- `.pairslash/project-memory/10-stack-profile.yaml`
- `.pairslash/project-memory/50-constraints.yaml`
- `.pairslash/project-memory/90-memory-index.yaml`

If `.pairslash/project-memory/` does not exist at all, warn the user:
> "No PairSlash project memory found. This plan is based solely on your
> input and repository inspection. Consider running pairslash-memory-write-global
> to establish project memory."

If the memory index lists additional active records, read those too.

Resolution rules:

- Global Project Memory is authoritative on read.
- Read project-memory seed files first, then any indexed active records, then
  `.pairslash/task-memory/` as supporting context.
- Task-memory may add missing initiative context, but it must not silently
  override a matching Global Project Memory claim.
- If task-memory conflicts with a project-memory claim, keep the
  project-memory claim authoritative and surface the conflict in the plan as a
  risk, constraint caveat, or open question.

## Step 2: Understand the goal

Ask the user what they want to accomplish if no goal was provided in the prompt.
Do not proceed until you have a concrete goal statement.

## Step 3: Produce the plan

Output a structured plan with exactly these sections, in this order.
Do not skip sections. If a section has no content, write "None identified."

### Goal

Restate the user's goal in one clear sentence.

### Constraints

List constraints from two sources:
1. **From project memory** -- cite the source file for each constraint.
2. **From user input** -- any explicit constraints the user stated.

### Relevant project memory

Quote or summarize relevant excerpts from the project memory files you read.
For each excerpt, cite the filename.

### Proposed steps

Numbered list of concrete, actionable implementation steps.
Each step should be verifiable -- a reviewer could check "was this done?"

### Files likely affected

List specific files or directories this plan expects to create, modify, or delete.
If uncertain, say so and explain why.

### Tests and checks

What tests should be written or run to verify success?
Which existing tests might break?
If no tests are relevant, explain why.

### Risks

List what could go wrong. For each risk, state:
- **Likelihood**: low / medium / high
- **Impact**: low / medium / high
- **Mitigation**: what to do if it happens

### Rollback

How to undo the plan if it fails. Be specific about commands or steps.

### Open questions

List anything the plan cannot resolve without more information.
For each item, distinguish between:
- "I don't know X" (genuine unknown)
- "I assumed X" (assumption that should be verified)

## Rules

1. **Never write to Global Project Memory.** This workflow is read-only.
   If you discover knowledge worth persisting, tell the user to invoke
   `pairslash-memory-write-global` separately.

2. **Separate facts from assumptions.** When citing project memory, mark it
   as "[from memory]". When making assumptions, mark them as "[assumption]".

3. **Be honest about gaps.** If you cannot read a file, if evidence is weak,
   or if the goal is ambiguous, say so. Do not hallucinate completeness.

4. **Respect the output structure.** Do not add extra sections, reorder sections,
   or merge sections. The structure is a contract.
