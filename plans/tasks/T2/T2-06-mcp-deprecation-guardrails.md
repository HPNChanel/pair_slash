---
id: T2-06
track: T2
title: MCP deprecation / dual-era guardrails in lint + doctor
status: done
depends_on: [T2-05]
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  rules: [LINT-MCP-004 (warn legacy), LINT-MCP-005 (warn defaulted era), LINT-MCP-006 (error unknown era, runs before manifest-validation gate)]
  doctor: dependencies.required_mcp_servers now emits spec_era_map/legacy_declarations/era_guidance evidence; legacy era => warn advisory with server/discover + UnsupportedProtocolVersionError guidance; local-only, no probing
  gates: lint=0, test=0, typecheck=0, test:compat=0, sync:compat-lab clean
  tests: lint-bridge 23/23, doctor 28/28
---

## Objective

Add lint + doctor guardrails for the MCP era transition: warn on legacy-era declarations, fail on removed-protocol assumptions, surface dual-era server negotiation guidance.

## Context & sources

- MCP 2026-07-28 has a formal deprecation policy and reserved error codes (e.g., `-32002` reassigned, `-32022` UnsupportedProtocolVersionError).
- PairSlash's exposure: pack `required_mcp_servers.spec_era`, emitted `mcp` sidecars, doctor probes.
- Lint already fails on unknown MCP dependency — extend that family of rules.
- Doctor's MCP checks (existing `mcp`-declared-misconfiguration detection per CLAUDE.md §19.2) get era awareness.

## Files to touch

- `packages/tools/lint-bridge/src/` — new era rules
- `packages/tools/doctor/src/` — era-aware MCP check messages
- `tests/` — lint/doctor rule tests
- Do NOT touch: emitters (done T2-05), schema (done T2-04)

## Work steps

1. Lint rules: (a) warn when `spec_era: legacy` (deprecated surface in use — guidance to upgrade); (b) error when a pack claims MCP capability but omits era on new schema_version; (c) error on unknown era values (should already be schema — defense in depth).
2. Doctor: when MCP deps are declared, check emitted config exists and reference-era matches install state; report `server/discover`-style guidance text (advisory — doctor does not probe servers live unless already doing so).
3. Tests for each rule + doctor messaging.
4. Gates.

## Constraints (STRICT)

- MUST fail closed: unknown/unsupported era values are errors, not warnings.
- MUST NOT probe remote MCP servers from lint/doctor (local-only checks; no network).
- Warnings for `legacy` MUST include remediation text (upgrade path to dual/modern).
- MUST NOT gate on MCP features runtime doesn't expose — the rules evaluate pack declarations, not runtime capability claims.

## Acceptance gates

- [x] Lint rules live with tests (positive/negative)
- [x] Doctor messages updated
- [x] `npm run lint`, `npm run test`, `npm run typecheck` green

## Evidence to record

- Rule list + verdict semantics in commit body.

## Rollback

`git revert`.
