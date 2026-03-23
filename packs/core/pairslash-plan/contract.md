# pairslash-plan -- Workflow Contract

**Version:** 0.2.0
**Phase:** 2
**Class:** read-oriented
**Status:** active

---

## Purpose

`pairslash-plan` produces a structured execution plan before code changes.

It is the default "think before you act" workflow in PairSlash. It reads Global
Project Memory to incorporate authoritative project context, separates known facts
from assumptions, and forces explicit thinking about tests, risks, and rollback
before any implementation begins.

**What it is not:**
- It is not a code writer.
- It is not a memory writer.
- It is not a reviewer or an onboarding tool.
- It is not a chat assistant that gives vague advice.

---

## Activation

**Canonical path (both runtimes):**

```
/skills
```

Select `pairslash-plan` from the skill picker.

**Direct invocation (when runtime surface allows):**

| Runtime | Syntax | Status |
|---------|--------|--------|
| Codex CLI | `$pairslash-plan` | Supported; fallback is `/skills` |
| GitHub Copilot CLI | `/pairslash-plan` in prompt | Unverified in interactive mode; blocked in `-p`/`--prompt` mode |

**Implicit invocation:**
Both runtimes may automatically activate this skill when the user's task matches
the skill's description. Do not rely on this; use explicit invocation for
production use.

**Compatibility authority:**
Pack identity/version lives in `packs/core/pairslash-plan/pack.yaml`.
Registry membership lives in `packages/spec-core/registry/packs.yaml`.
Runtime support status must match `docs/compatibility/runtime-surface-matrix.yaml`.

---

## Input contract

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `goal` | **yes** | string | What you want to accomplish. Natural language is fine. |
| `scope_hint` | no | string | Which part of the project this targets: `whole-project`, a subsystem name, or a file path prefix. |
| `constraints` | no | string | Any extra constraints beyond what project memory declares. |

**Scope assumption:**
If no `scope_hint` is provided, the workflow reads all project-memory files and
infers scope from the goal.

**Minimum viable invocation:**
Just describe your goal. Example: "Add authentication to the API service."

---

## Output contract

The workflow produces a structured plan in **exactly** these sections, in this order:

1. **Goal** -- Restated goal in one clear sentence.
2. **Constraints** -- From project memory (cited) + from user input.
3. **Relevant project memory** -- Excerpts from `.pairslash/project-memory/`, each cited by filename.
4. **Proposed steps** -- Numbered, concrete, actionable, verifiable.
5. **Files likely affected** -- Specific files or directories; uncertainty must be stated.
6. **Tests and checks** -- What to write or run; which existing tests might break.
7. **Risks** -- Likelihood, impact, and mitigation for each risk.
8. **Rollback** -- Specific commands or steps to undo the plan.
9. **Open questions** -- Unknowns explicitly labeled as "I don't know X" or "I assumed X."

**Output format:** structured markdown.

**Determinism promise:** The section structure is fixed. Every invocation produces
the same sections in the same order. Empty sections get "None identified." not silence.

---

## Failure contract

| Failure condition | Behavior |
|-------------------|----------|
| `.pairslash/project-memory/` does not exist | Warn: "No project memory found. Plan based on user input and repo inspection only." Proceed. |
| Goal is too vague to plan | Ask a clarifying question. Do not produce a speculative plan. |
| A project-memory file cannot be read | Note which file failed. Continue with available information, marking the gap. |
| Goal is provided but scope is ambiguous | Infer from goal + memory. Mark the inference as `[assumption]` in the plan. |

**Anti-pattern this contract prohibits:**
Producing a confident-sounding plan when evidence is weak. Use "I assumed X" or
"None identified" rather than padding sections with speculation.

---

## Memory contract

| Layer | Permission | Details |
|-------|------------|---------|
| Global Project Memory | **read** | `.pairslash/project-memory/` |
| Task Memory | read (optional) | `.pairslash/task-memory/` for ongoing initiative context |
| Session Context | read (implicit) | Current conversation context |
| **Any memory layer** | **NEVER write** | This workflow has no write authority |

**Invariant:**
`pairslash-plan` MUST NOT write to any memory layer. If the planning session
surfaces knowledge worth persisting (a new constraint, a confirmed decision),
the user must invoke `pairslash-memory-write-global` explicitly in a separate step.

---

## Approval posture

This workflow requires **no approval** to run. It is fully read-oriented.

There are no file writes, no memory mutations, and no side effects to approve.
The user reviews the output plan and decides whether to proceed with implementation.

---

## Metadata and Registry

`pairslash-plan` is a formalized core pack with explicit metadata and registry hooks.

- Pack metadata: `packs/core/pairslash-plan/pack.yaml`
- Pack registry: `packages/spec-core/registry/packs.yaml`
- Compatibility evidence: `docs/compatibility/runtime-surface-matrix.yaml`

These artifacts are authoritative for pack identity, version, and compatibility
status. Human-readable docs in this contract must stay aligned with them.

---

## Runtime mapping notes

### Codex CLI

- Install skill to: `.agents/skills/pairslash-plan/`
- Activation: `/skills` picker, or `$pairslash-plan` in prompt
- Memory read: Codex file reading tools are available; skill instructions direct
  the LLM to read `.pairslash/project-memory/` files
- `/skills` is the canonical compatibility path
- `$pairslash-plan` direct invocation: supported

### GitHub Copilot CLI

- Install skill to: `.github/skills/pairslash-plan/`
- Activation: `/skills list` to confirm presence, then `/pairslash-plan` in prompt
- Memory read: Copilot file reading tools are available
- Known issue: `/pairslash-plan` does not work in `-p`/`--prompt` mode
  (github/copilot-cli#2040). Interactive prompt invocation remains unverified.
- `/skills reload` can pick up newly installed skills without restarting
