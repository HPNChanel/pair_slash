# PairSlash Delegation Lane Contract (Scaffold Only)

This advanced lane is optional and isolated from core discovery/install flow.

## Authority Model

- Explicit parent-to-child task handoff is mandatory.
- Worker authority must remain a strict subset of caller authority.
- No silent delegation or hidden chain spawning is allowed.
- No unbounded fan-out is allowed (`max_fan_out = 1` in safe MVP).
- Delegated output is non-authoritative and always requires caller review.
- Delegated workers cannot write Global Project Memory.

## Allowed Surface in This Slice

- validate explicit delegation requests for safe-MVP allowlisted workflows
- generate non-authoritative delegated result envelopes
- enforce caller-scope, worker-class, and depth boundaries
- return policy verdicts and escalation flags

## Explicitly Forbidden Surface

- write-authority workflows
- dual-mode workflows
- direct repo, runtime-root, task-memory, staging, or Global Memory writes
- autonomous chain spawning
- creation of a new front door beside `/skills`
