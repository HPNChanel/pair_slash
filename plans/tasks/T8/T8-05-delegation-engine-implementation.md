---
id: T8-05
track: T8
title: delegation-engine — authority-subset checks + non-authoritative envelopes
status: done
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-09-29
completed_at: 2026-09-29
evidence: packages/advanced/delegation-engine tests 10/10 (no authoritative-write exports/fs writes, subset-violation deny, canonical taxonomy deny, authority-source required, memory_write_global undelegatable, pack-authority allowlist gating, non-authoritative envelope + write_authority_route, determinism, blocked-abort); phase11 delegation-lane 10/10; typecheck/lint/npm test/test:release green
---

## Objective

Implement `packages/advanced/delegation-engine`: structured delegation envelopes where a delegated action may only operate within a declared authority subset — checked against policy-engine + `trust/pack-authority.yaml` — with results tagged non-authoritative.

## Context & sources

- Current: `src/{capabilities,envelope,index,policy-contract}.js` scaffold.
- Requirements (July A3): delegation policy (sub-agent operates only within declared authority subset); authority-subset checks against policy-engine + pack-authority; result envelopes non-authoritative; any authoritative action routes back through `pairslash-memory-write-global` pipeline.
- New context: runtime subagent surfaces now exist (Copilot custom agents CP-06; Codex multi-agent CX-20) — the engine models *delegation envelopes*, runtime agents are a future integration (note in docs, not this task).

## Files to touch

- `packages/advanced/delegation-engine/src/*.js` → `.ts` + implement
- `packages/advanced/delegation-engine/package.json`, tests
- `trust/pack-authority.yaml` — READ only (consumed as authority source; never modified by this slice)
- Do NOT touch: trust files, memory-engine, runtime packages

## Work steps

1. Design envelope: `{delegator, delegatee_scope, authority_subset[], constraints, provenance}` — authority_subset is a set of capability atoms from the pack-authority taxonomy.
2. Validation: requested authority ⊆ delegator's own authority ⊆ pack-authority allowlists — violation → deny (fail closed).
3. Execution semantics: envelope describes intent; execution produces a non-authoritative result envelope; durable writes route back through write-authority pipeline (engine cannot write memory).
4. Tests: subset-violation deny, non-authoritative labeling, no-promotion path, escalation-to-write-global reference correctness.
5. Strict-clean; gates.

## Constraints (STRICT)

- MUST fail closed on any authority-subset violation — overclaiming scope is an error, never a warning.
- MUST NOT grant the engine any write path to `.pairslash/project-memory/` — routing requirement is structural (imports) not just policy.
- Result envelopes MUST be labeled non-authoritative/`supporting` — cannot masquerade as truth.
- MUST NOT create autonomous dispatch — delegation envelopes are explicit artifacts, not background agents (C.8).
- Authority taxonomy MUST reuse existing capability names (`memory_write_global`, `repo_write`, `shell_exec`, `test_exec`, `mcp_client`) — no inventing parallel vocab.

## Acceptance gates

- [x] Subset-violation deny tests pass
- [x] No authoritative-write path exists (import-level test)
- [x] Gates green

## Evidence to record

- Envelope schema; deny-path test output.

## Rollback

`git revert`.
