# pairslash-memory-write-global -- Example Invocations

## Canonical activation (both runtimes)

```text
/skills
select pairslash-memory-write-global
```

## Structured write request

```text
Record this:
kind: decision
title: Use managed install commands for Phase 4
statement: PairSlash install/update/uninstall must be run through managed CLI commands.
evidence: Phase 4 runtime-native distribution policy.
scope: whole-project
confidence: high
action: append
```

## Natural language request

```text
Record that release claims must be blocked when phase4 release gate is not GO.
```

Workflow behavior expected:

1. Extract structured fields.
2. Ask for confirmation.
3. Run duplicate/conflict checks.
4. Show preview patch.
5. Require explicit acceptance.
6. Write record and audit entry only after acceptance.

## Missing fields behavior

If required fields are missing, workflow must reject and list missing fields
before any preview/write step.
