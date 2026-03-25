# pairslash-plan -- Example Invocations

## Canonical activation (both runtimes)

```text
/skills
select pairslash-plan
Create a repo plan from the current repo state.
```

## Minimal invocation

```text
Create a repo plan from the current repo state.
```

## With scope hint

```text
Create a repo plan for the installer package.
scope: packages/installer
```

## With additional constraint

```text
Create a repo plan for installer command UX.
constraint: preserve local overrides and keep preview-first behavior.
```

## No project memory present

If `.pairslash/project-memory/` is missing, the workflow should continue with
repo inspection and mark assumptions explicitly.
