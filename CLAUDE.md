# CLAUDE.md

> Canonical project constitution for PairSlash.
> Applies across all phases unless superseded by a newer ADR or an explicit section in this file.

- Project: **PairSlash**
- Status: **Authoritative**
- Scope: **All phases, all packages, all workflows, all runtime adapters**
- Primary audience: **Founders, maintainers, compiler authors, workflow authors, reviewers, future contributors, and any Claude/Cursor session working inside the repo**
- Last normalized: **2026-03-21**

---

## 1. What this file is

`CLAUDE.md` is the **single operational truth** of the PairSlash project.

It exists to stop drift.
It defines what PairSlash is, what it is not, what must remain invariant across phases, how memory works, how workflows are classified, how runtime compatibility is handled, and how maintainers should make decisions when documentation conflicts.

This file is not a brainstorm document.
This file is not an aspirational wishlist.
This file is the project constitution.

If a future conversation, prompt, draft doc, prototype, or pack contradicts this file, **this file wins** unless the contradiction is resolved by an explicit project decision and this file is updated.

---

## 2. Precedence rules

When documents disagree, resolve them in this order:

1. **This `CLAUDE.md`**
2. **Accepted ADRs or formal project decisions created after this file**
3. **The updated PairSlash blueprint focused on Global Project Memory**
4. **The earlier PairSlash blueprint**
5. **Knowledge maps, learning plans, notes, explorations, and temporary design drafts**
6. **Ad hoc chat conclusions not written back into the repo**

Interpretation rule:

- The **updated blueprint** is authoritative wherever memory architecture, workflow permissions, and slash-entry semantics changed.
- The **earlier blueprint** still contributes useful structure for packaging, repo layout, module boundaries, and multi-phase productization, but it does **not** override the updated memory model.
- The **knowledge map** is supportive and educational, not normative.

---

## 3. Project identity

PairSlash is an **open-source slash-triggered workflow kit** for exactly **two runtimes**:

- **Codex CLI**
- **GitHub Copilot CLI**

PairSlash is **not** a new agent runtime.
PairSlash is **not** a GUI product.
PairSlash is **not** a background daemon.
PairSlash is **not** a vendor-internal integration hack.
PairSlash is **not** a generic “AI memory” experiment.

PairSlash exists to provide:

- disciplined slash-first workflows,
- a shared spec/compiler story across two CLIs,
- explicit memory behavior,
- strong contracts for read vs write actions,
- file-based, reviewable, auditable project memory,
- consistent operator experience across runtimes.

Core positioning sentence:

> **PairSlash is the OSS slash-triggered workflow kit for Codex CLI and GitHub Copilot CLI, with Global Project Memory as the durable source of truth for project context.**

---

## 4. Non-negotiable product boundaries

These boundaries apply in every phase unless intentionally revised.

### 4.1 Runtime boundary

PairSlash supports only:

- Codex CLI
- GitHub Copilot CLI

It must not silently grow a third runtime into the core product.
Do not mix Claude Code into the product runtime story.
Do not build architecture that assumes a hidden third backend will save the design later.

### 4.2 Interaction boundary

PairSlash is **slash-first**.
Every core workflow must be triggerable from inside an interactive CLI session.

Canonical entrypoint:

- **`/skills`** is the default, safest, compatibility-first entrypoint across both runtimes.

Direct-by-name invocation:

- Direct skill invocation may be supported on certain surfaces.
- It may be offered when verified.
- It must never replace `/skills` as the canonical compatibility path.
- If direct invocation is unavailable, PairSlash must guide the user back to `/skills`.

### 4.3 Automation boundary

MVP and early phases are **interactive-first**.
No hidden auto-run behavior.
No implicit task activation.
No memory mutation without an explicit workflow.
No background daemon continuously observing and rewriting project state.

### 4.4 Vendor boundary

Do not depend on undocumented private vendor internals.
Do not “hack” memory persistence through opaque stores owned by Codex or Copilot.
Do not promise behavior that relies on unstable private surfaces.

### 4.5 UX boundary

PairSlash wins on:

- workflow quality,
- contract clarity,
- packaging,
- project memory discipline,
- compatibility parity.

PairSlash does **not** win by pretending to be magical.

---

## 5. The central architectural truth

The project’s main architectural truth is now this:

> **Global Project Memory is the durable source of truth across sessions, while slash-triggered workflows are the operational interface that reads from and, in carefully separated cases, writes to that truth.**

This means:

- Slash-first remains the UX center.
- Global Project Memory is the architectural backbone.
- Session context is useful, but never authoritative.
- Read-oriented workflows must stay separate from write-authority workflows.
- The product must be understandable and reviewable by humans using normal files and diffs.

---

## 6. Memory model: authoritative layers

PairSlash memory is tiered, but only one tier is authoritative.

### 6.1 Memory layers

#### Global Project Memory

This is the **project-level source of truth**.
Examples:

- stack profile,
- canonical commands,
- glossary,
- ownership rules,
- architecture decisions,
- deployment constraints,
- known-good patterns,
- incident lessons worth retaining.

This layer is:

- authoritative,
- cross-session,
- file-based,
- reviewable,
- diffable,
- mergeable.

#### Task Memory

This holds structured memory for a large initiative, ticket, migration, or investigation.
It depends on Global Project Memory.
It may later be promoted into Global if it proves stable and reusable.

This layer is:

- longer-lived than a session,
- not yet authoritative for the whole project,
- a staging ground for stable knowledge.

#### Session Context

This is working state for the current session.
Examples:

- scratchpad,
- compaction summaries,
- temporary notes,
- current hypotheses,
- half-finished plans.

This layer is:

- non-authoritative,
- disposable,
- allowed to be messy,
- never allowed to silently override Global.

### 6.2 Hard memory ordering

When memory layers conflict:

1. Global Project Memory wins.
2. Task Memory may extend but not silently override Global.
3. Session Context is lowest priority and must not be treated as truth.

If session facts disagree with Global, PairSlash must:

- surface the conflict,
- avoid guessing,
- require an explicit write-authority flow to change Global.

---

## 7. Global Project Memory invariants

These invariants are mandatory across all phases.

### 7.1 Authoritative-first

Only Global Project Memory may represent “how the project should be remembered” at durable project scope.

### 7.2 Explicit-write-only

There is no hidden self-learning.
There is no silent memory mutation.
Any change to Global must be initiated through an explicit workflow with clear intent.

### 7.3 Schema-first

Authoritative memory must be structured.
Freeform notes do not become truth unless normalized into the approved schema.

### 7.4 Traceable

Every durable memory record must have provenance:

- what was recorded,
- who or what recorded it,
- when it was recorded,
- what evidence supports it,
- what scope it applies to.

### 7.5 Conflict-aware

New facts cannot silently overwrite old facts.
If a write collides with existing memory, the system must surface a real decision:

- append,
- supersede,
- reject,
- or keep as candidate.

### 7.6 Reviewable-by-Git

Memory changes must appear as normal files and diffs.
Humans must be able to inspect and review them using ordinary repo workflows.

### 7.7 Promotion-based

Not every note deserves promotion.
Insights from task/session layers only become Global when they are:

- stable,
- reusable,
- justified,
- worth carrying into future sessions.

### 7.8 No vendor lock-in

Project memory must be PairSlash-managed, not vendor-owned.
Codex and Copilot may consume it, but they do not define it.

---

## 8. Canonical memory filesystem shape

The current canonical shape is:

```text
.pairslash/
  project-memory/
    00-project-charter.yaml
    10-stack-profile.yaml
    20-commands.yaml
    30-glossary.yaml
    40-ownership.yaml
    50-constraints.yaml
    60-architecture-decisions/
    70-known-good-patterns/
    80-incidents-and-lessons/
    90-memory-index.yaml
  task-memory/
  sessions/
  audit-log/
  staging/
```

Meaning:

- `project-memory/` is authoritative and loaded before core workflows run.
- `task-memory/` holds structured but not-yet-authoritative knowledge.
- `sessions/` holds working-state artifacts and short-lived summaries.
- `staging/` is the validation area for records before durable write.
- `audit-log/` stores durable write history and related events.

Earlier simpler memory layouts may still appear in old drafts or prototypes, but the structure above is the current canonical target.

---

## 9. Workflow taxonomy

All PairSlash workflows must declare their operational class.
No ambiguous permissions.
No fuzzy role boundaries.

### 9.1 Read-oriented workflows

These workflows may read Global Project Memory, task memory, repo files, diffs, and other contextual inputs, but they do **not** mutate Global by default.

Examples:

- `pairslash-plan`
- `pairslash-review`
- `pairslash-onboard-repo`
- `pairslash-command-suggest`
- `pairslash-refactor-safe` (if and only if kept read-oriented at planning stage)

Rules:

- May consume Global Project Memory.
- Must not silently write Global Project Memory.
- Must distinguish facts from assumptions.
- Must define clear output structure.
- Must define failure behavior.

### 9.2 Candidate-producing workflows

These workflows can gather possible durable facts but cannot directly promote them into authoritative project truth.

Example:

- `pairslash-memory-candidate`

Rules:

- May write candidate artifacts to non-authoritative locations.
- Must never masquerade candidate memory as authoritative truth.
- Must require a later explicit promotion or write-authority workflow.

### 9.3 Write-authority workflows

These are the only workflows allowed to mutate Global Project Memory.

Primary example:

- `pairslash-memory-write-global`

Rules:

- Must require explicit intent.
- Must be schema-first.
- Must perform conflict checks.
- Must show preview patch.
- Must leave audit trail.
- Must never operate as a hidden side effect of another read workflow.

### 9.4 Audit workflows

These inspect durable memory health.

Example:

- `pairslash-memory-audit`

Rules:

- May detect duplicates, stale records, broken references, and conflict candidates.
- Must not silently rewrite Global unless routed through explicit write-authority policy.

---

## 10. Mandatory workflow contracts

Every PairSlash workflow must declare at least four contracts.

### 10.1 Input contract

What inputs are required?
What format do they take?
What is optional versus mandatory?
What scope is assumed?

### 10.2 Output contract

What should the user get back?
What structure should the output follow?
What promises does the workflow make about determinism, format, and completeness?

### 10.3 Failure contract

What happens when inputs are incomplete, evidence is weak, runtime support is missing, or conflicts cannot be resolved?
The system must fail honestly, not hallucinate success.

### 10.4 Memory contract

What memory layers may be read?
What memory layers may be written?
Under what conditions?
With what audit expectations?

Optional but recommended:

- approval contract,
- tool contract,
- patch contract,
- policy contract.

---

## 11. The canonical write-authority workflow

The most sensitive workflow in the project is:

- **`pairslash-memory-write-global`**

This is the official path for writing durable project truth.

### 11.1 Canonical invocation

Default path across runtimes:

1. Open the CLI session.
2. Use `/skills`.
3. Select `pairslash-memory-write-global`.

When supported and verified by the runtime surface, direct invocation by skill name may be offered.
But `/skills` remains the compatibility-safe entrypoint.

### 11.2 Purpose

This workflow may:

- write a new durable decision,
- update a project fact with evidence,
- promote a stable lesson into project memory,
- record a known-good command or pattern,
- capture a durable constraint,
- update glossary or ownership knowledge when justified.

### 11.3 Minimum semantic fields

The workflow must support at least:

- `kind`
- `title`
- `statement`
- `evidence`
- `scope`
- `confidence`
- `action`
- `tags`
- `source_refs`
- `updated_by`
- `timestamp`

### 11.4 Allowed value families

Recommended `kind` examples:

- decision
- command
- glossary
- constraint
- ownership
- incident-lesson
- pattern

Recommended `scope` examples:

- whole-project
- subsystem
- path-prefix

Recommended `action` examples:

- append
- supersede
- reject-candidate-if-conflict

Recommended `confidence` levels:

- low
- medium
- high

Global memory should generally only accept `medium` or `high` confidence with evidence.

### 11.5 Required execution pipeline

The workflow must not skip these steps:

1. Parse and validate structured input.
2. Reject incomplete input before any authoritative write.
3. Search relevant existing records in project memory and task memory.
4. Perform duplicate detection.
5. Perform conflict detection.
6. Perform scope validation.
7. Generate a preview patch showing the exact durable change.
8. Require explicit acceptance unless local policy explicitly allows auto-commit in a safe, local context.
9. Write the change.
10. Update index artifacts.
11. Append audit log entries.

### 11.6 Non-negotiable safety rules

- No silent writes.
- No freeform authoritative memory blobs.
- No hidden mutation as a side effect of planning or review.
- No silent conflict resolution.
- No skipping preview.
- No pretending a write succeeded if validation failed.

---

## 12. Contracts for read-oriented workflows

Read-oriented workflows are first-class citizens, but their permissions are narrower.

### 12.1 `pairslash-plan`

Purpose:

- create a structured execution plan before code changes,
- incorporate stable project conventions from Global Project Memory,
- separate facts from assumptions,
- include tests and rollback thinking.

Must:

- read Global Project Memory,
- produce deterministic structure,
- avoid writing authoritative memory,
- identify risks and open questions honestly.

Recommended output shape:

- Goal
- Constraints
- Relevant project memory
- Proposed steps
- Files likely affected
- Tests/checks
- Risks
- Rollback
- Open questions

### 12.2 `pairslash-review`

Purpose:

- review diff, PR state, or working tree against project conventions and constraints.

Must:

- consume conventions, commands, and constraints from Global Project Memory when useful,
- surface risks and missing tests,
- remain read-oriented by default,
- avoid promoting review observations into Global automatically.

### 12.3 `pairslash-onboard-repo`

Purpose:

- bootstrap understanding of a repository and produce initial structured project profile.

Must:

- produce candidate memory or repo profile scaffolds,
- remain careful about what is treated as durable truth,
- avoid asserting project-wide truth without evidence and review.

### 12.4 `pairslash-command-suggest`

Purpose:

- suggest canonical commands based on stack profile and commands memory.

Must:

- prefer known-good commands,
- remain advisory,
- not mutate memory just because a command was suggested.

---

## 13. Compatibility policy across runtimes

PairSlash is one product with two runtime targets.
The product must not split into two unrelated mental models.

### 13.1 Canonical compatibility strategy

- Standardize on `/skills` for both runtimes.
- Allow direct invocation only when verified.
- Do not depend on a private custom slash registry.
- Keep semantics aligned even when implementation artifacts differ.

### 13.2 Codex CLI mapping

Codex support should center around:

- skills,
- slash interactions,
- `AGENTS.md`,
- config layering,
- references/resources,
- MCP when needed and explicitly configured.

Rules:

- Global Project Memory must be injected into workflow context in stable priority order.
- Session compaction artifacts belong in `sessions/`, not `project-memory/`.
- Runtime-specific generation is allowed, but semantic drift is not.

### 13.3 GitHub Copilot CLI mapping

Copilot support should center around:

- skills,
- slash interactions,
- agents where appropriate,
- hooks where appropriate,
- plugin-compatible asset generation,
- MCP when explicitly supported and configured.

Rules:

- `/skills` remains the most reliable entrypoint.
- Hooks may verify or lint before write-authority workflows commit.
- Hooks must not silently commit Global Memory without explicit workflow intent.
- Persona-oriented behaviors may map to agents, but write-authority logic should remain skill-disciplined.

### 13.4 Compatibility gates

No pack should ship as “compatible” unless it passes compatibility checks for the declared runtimes.

At minimum, compatibility validation must include:

- trigger path validity,
- required file paths,
- memory permission declaration,
- runtime surface availability,
- MCP dependency declaration,
- unsupported capability detection.

---

## 14. Repository architecture direction

The long-term package direction remains:

```text
pairslash/
  packages/
    cli/
    spec-core/
    compiler-codex/
    compiler-copilot/
    memory-engine/
    installer/
    doctor/
    registry/
  packs/
    core/
    backend/
    frontend/
    devops/
    release/
  templates/
    skill/
    memory/
    repo/
  docs/
    architecture/
    workflows/
    compatibility/
  examples/
    monorepo/
    rails-service/
    node-api/
```

This layout is directional, not sacred.
What is sacred is the separation of concerns:

- spec must remain distinct from compiler output,
- runtime-specific generation must remain distinct from canonical semantics,
- memory engine concerns must remain explicit,
- installer/doctor must exist to reduce support burden,
- packs must be declarative rather than ad hoc script piles.

---

## 15. Multi-phase roadmap truth

All phases are guided by the same constitution.
Phase scope may expand, but the invariants above do not disappear.

### Phase 0 — Compatibility Spike

Goal:

- verify real trigger behavior for `/skills` and direct skill invocation,
- prove the concept with minimal but serious workflows,
- keep scope narrow.

Canonical deliverables:

- `pairslash-plan` demo,
- `pairslash-memory-write-global` demo,
- compatibility notes,
- risk notes,
- early acceptance gates.

Phase 0 must not pretend the memory engine is already production-hardened.
It only proves the architecture direction.

### Phase 1 — Core Product

Goal:

- ship `spec-core`,
- ship both compilers,
- ship installer and doctor,
- define memory permissions cleanly,
- establish stable workflow packaging.

Required direction:

- read/write/promote permissions must be explicit,
- runtime generation must preserve semantics,
- installation and compatibility verification must be part of the product story.

### Phase 2 — Global Memory Hardening

Goal:

- harden schema,
- harden patch preview,
- harden index updates,
- add supersede/dedupe flows,
- add audit workflows,
- formalize promotion rules from candidate/task/session knowledge.

This is where memory quality becomes operationally serious.

### Phase 3 — Team Packs

Goal:

- ship stricter domain-specific packs,
- expand compatibility matrix,
- version registry and packs more formally.

Examples:

- backend,
- frontend,
- devops,
- release.

### Future phases

Later phases may include stronger observability, registry maturity, richer policy systems, better testing/evals, more advanced memory audit, and optional retrieval-aware features.
But no future phase may violate the core rules of explicitness, reviewability, and source-of-truth discipline.

---

## 16. What PairSlash must not do

These are hard anti-goals.

- Do not treat session summaries as authoritative project truth.
- Do not let read workflows write directly to Global Project Memory.
- Do not use freeform markdown as authoritative memory without schema normalization.
- Do not depend on undocumented vendor internals.
- Do not add a third runtime into the core product story.
- Do not ship memory write flows without patch preview.
- Do not ship memory write flows without lint or doctor support.
- Do not ship silent fallback behavior that hides incompatibility.
- Do not pretend unsupported direct slash invocation exists.
- Do not turn PairSlash into a generic autonomous background agent.
- Do not use vector databases or heavy retrieval as a prerequisite for v1.
- Do not optimize for cleverness over operational clarity.

---

## 17. Engineering quality bar

PairSlash should be engineered like a small platform, not a pile of prompts.

### 17.1 Determinism over vibes

Whenever possible:

- prefer explicit schema,
- prefer deterministic generation,
- prefer stable ordering,
- prefer clear contracts,
- prefer visible patches,
- prefer structured logs over narrative excuses.

### 17.2 Human reviewability over hidden magic

If humans cannot understand what changed, why it changed, and what workflow had permission to change it, the feature is not ready.

### 17.3 Narrow scope wins early

Every phase should cut scope harder than feels comfortable.
Do the minimum serious thing.
Do not inflate the architecture because a later phase might want it.

### 17.4 Honest failure beats fake success

Unsupported runtime surface?
Say so.
Conflict unresolved?
Say so.
Evidence weak?
Say so.
Patch not accepted?
Do not write.

### 17.5 Cross-runtime parity matters

Parity does not mean identical files.
Parity means the same workflow semantics, memory rules, and user promises across both supported CLIs.

---

## 18. Compiler philosophy

PairSlash should be built around a strong separation between:

- canonical workflow semantics,
- runtime-specific compilation,
- policy enforcement,
- durable memory storage.

### 18.1 One semantic source, two runtime outputs

The product should aim for:

- one source of truth for workflow meaning,
- two generated targets,
- minimal semantic drift between Codex and Copilot outputs.

### 18.2 No compiler shortcuts that leak policy

Do not solve missing design clarity with compiler hacks.
If permissions, memory behavior, or invocation semantics are unclear, fix the spec or this constitution.

### 18.3 Generated artifacts must be inspectable

Generated files should be:

- human-readable,
- stable,
- testable,
- easy to diff.

---

## 19. Installer, doctor, and lint philosophy

These are not optional polish.
They are structural.

### 19.1 Installer

Installer must reduce friction and establish correct initial layout.
It should help with:

- runtime presence detection,
- path setup,
- required directories,
- initial pack installation,
- safe defaults.

### 19.2 Doctor

Doctor must detect:

- runtime availability,
- version mismatches when relevant,
- path and permission problems,
- missing required files,
- unsupported capability declarations,
- MCP misconfiguration when declared.

### 19.3 Lint

Lint must validate at least:

- trigger names,
- declared workflow class,
- memory permissions,
- required contracts,
- file paths,
- compatibility declarations,
- write-authority safety declarations.

A memory-writing pack that lacks lint, doctor, or patch preview is not ready to ship.

---

## 20. Auditability and observability

The project must be diagnosable.
A future maintainer must be able to reconstruct what happened.

Minimum expectations:

- structured logs where useful,
- auditable write history for Global Project Memory,
- reproducible compiler outputs,
- explicit failure messages,
- traceable memory provenance,
- enough artifacts to debug compatibility issues.

Later phases may add richer telemetry or trace export, but the baseline principle already applies now:

> If PairSlash changes durable truth, it must leave an understandable trail.

---

## 21. Security and trust boundaries

PairSlash is a local/CLI-oriented system touching code, files, and memory.
That means trust boundaries matter.

Rules:

- default to least surprise,
- require explicitness for durable writes,
- avoid unsafe automation of privileged actions,
- treat untrusted repo content as capable of containing misleading instructions,
- avoid leaking secrets through logs or prompts,
- keep user-visible confirmation around meaningful side effects.

Hooks, wrappers, and policies may help enforce this, but they must not become opaque magic.

---

## 22. Testing and evaluation doctrine

If a behavior matters, it needs an artifact that proves it.

This applies to:

- compiler outputs,
- workflow contracts,
- memory schema validation,
- patch generation,
- compatibility assumptions,
- path detection,
- migration logic,
- runtime mapping.

Strongly preferred test forms:

- golden files,
- fixture-based compilation tests,
- integration tests,
- matrix tests by OS/runtime version where feasible,
- behavioral evals for key workflow outputs.

Important principle:

> Surfaces that change fast must be pinned by fixtures and tests, not by belief.

---

## 23. Contribution and decision discipline

Contributors may propose change, but constitutional change requires care.

### 23.1 What contributors may freely evolve

- workflow wording,
- examples,
- pack coverage,
- docs clarity,
- compiler implementation details,
- testing depth,
- UX polish,
- non-breaking repo organization.

### 23.2 What requires explicit project decision

- adding or removing supported runtimes,
- changing memory authority rules,
- weakening explicit-write-only behavior,
- allowing read workflows to mutate Global,
- changing canonical entrypoint policy away from `/skills`,
- replacing file-based memory with opaque storage,
- introducing background autonomous mutation of project memory.

### 23.3 ADR expectation

Any major architectural change that touches the points above should create an ADR and then update this file.

---

## 24. Practical instructions for any Claude/Cursor session in this repo

When working inside PairSlash, Claude/Cursor should behave as follows:

1. Treat this file as the primary project instruction.
2. Preserve the two-runtime boundary.
3. Preserve slash-first behavior.
4. Treat `/skills` as canonical unless verified runtime evidence supports direct invocation.
5. Never propose hidden Global Memory writes.
6. Keep read and write workflow permissions separate.
7. Prefer file-based, reviewable, schema-driven solutions.
8. If documentation conflicts, cite the conflict and follow the precedence rules above.
9. If a design idea expands scope, cut it back to the current phase.
10. If uncertain, choose the more explicit, reviewable, compatibility-safe path.

Additional writing rule:

- Do not describe aspirational capability as shipped capability.
- Distinguish clearly between current phase proof, planned work, and hardened behavior.

Additional implementation rule:

- When asked to create files or specs, preserve the project constitution before optimizing for convenience.

---

## 25. Canonical summary in one page

If someone reads only one page, it should be this:

- PairSlash is an OSS slash-triggered workflow kit for **Codex CLI** and **GitHub Copilot CLI**.
- `/skills` is the canonical entrypoint across both runtimes.
- Global Project Memory is the durable project source of truth.
- Session context is useful but non-authoritative.
- Read workflows must not silently mutate Global.
- `pairslash-memory-write-global` is the official write-authority path.
- Durable memory must be file-based, schema-first, reviewable, diffable, mergeable, and auditable.
- No hidden learning, no background daemon, no third runtime, no undocumented vendor dependency.
- PairSlash should be built as a spec/compiler/memory/installer system with strong contracts and compatibility discipline.
- If there is a conflict, explicitness beats magic.

---

## 26. Source alignment note

This file intentionally consolidates three lines of project thinking:

- the original slash-first product blueprint,
- the revised blueprint that makes Global Project Memory authoritative,
- the knowledge map that identifies the skills needed to build and maintain the system.

Where they differ, this file resolves the conflict in favor of:

- slash-first interaction,
- `/skills` as canonical path,
- two-runtime discipline,
- explicit memory writes,
- file-based durable truth,
- strong workflow contracts.

---

## 27. Final constitutional statement

PairSlash should feel disciplined, not mystical.
It should help teams work through structured slash workflows inside Codex CLI and GitHub Copilot CLI while sharing a durable, reviewable, project-level memory that survives sessions without becoming messy lore.

If a future change weakens explicitness, traceability, reviewability, or the separation between read and write authority, that change is moving the project away from its core truth.

That is not an acceptable regression.
