# pairslash-plan -- Example Invocations

These examples show how to activate the skill and what to provide as input.

---

## Activation sequence

### Via /skills (canonical path, both runtimes)

```
> /skills
[skill picker opens]
> select pairslash-plan
> Add a rate-limiting layer to the public API endpoints.
```

### Via direct invocation on Codex CLI (when runtime surface allows)

```
> $pairslash-plan Add a rate-limiting layer to the public API endpoints.
```

*Fallback to /skills if $pairslash-plan is not available on this runtime surface.*

### Via direct invocation on Copilot CLI (interactive mode only)

```
> Use the /pairslash-plan skill to plan: Add a rate-limiting layer to the public API endpoints.
```

*Note: This does not work in `-p`/`--prompt` mode due to a known Copilot CLI bug.*

---

## Minimal invocation (goal only)

```
Add a rate-limiting layer to the public API endpoints.
```

The workflow reads project memory automatically and asks for clarification only if
the goal is too vague to plan.

---

## Invocation with scope hint

```
Add a rate-limiting layer to the public API endpoints.
scope: subsystem api-gateway
```

---

## Invocation with extra constraint

```
Add a rate-limiting layer to the public API endpoints.
constraint: Must not introduce a new external dependency without a team review.
```

---

## What happens when there is no project memory

If `.pairslash/project-memory/` is missing or empty, the workflow warns:

> "No PairSlash project memory found. This plan is based solely on your
> input and repository inspection. Consider running pairslash-memory-write-global
> to establish project memory."

It then proceeds and marks all context as `[assumption]` rather than `[from memory]`.
