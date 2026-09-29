---
id: T10-05
track: T10
title: Contributor/dev docs refresh (CONTRIBUTING, AGENTS.md sync)
status: done
depends_on: [T10-02]
est_size: S
claimed_by: devin
claimed_at: 2026-09-29
completed_at: 2026-09-29
evidence: >-
  CONTRIBUTING.md: npm pin corrected 11.7.0 → 11.14.1 (was drifted vs
  packageManager), Node line now states both tested majors (24.x, 26.x)
  with the >=24.0.0 floor, typecheck added to the base command block, a
  compat-surface command block added (test:compat, sync:compat-lab --check,
  test:release), and a "How work is planned" section links plans/README.md
  and the node-release-cadence policy doc. AGENTS.md: Node/npm line synced
  to tested-majors wording, command list gained typecheck/test:compat/
  sync:compat-lab, and the style section now describes strict ESM
  TypeScript via type-stripping (erasable-syntax-only) with tests staying
  .js — matching post-T5-14 reality. CLAUDE.md audited: no toolchain or
  runtime-surface staleness found (constitution is semantic, not
  versioned); left untouched per constraint.
---

## Objective

Refresh contributor-facing docs so a new contributor sees current truth: Node 24+26 support, npm pin, current commands, plans/ program pointer, and any drift accumulated since April.

## Context & sources

- `CONTRIBUTING.md` — contributor lanes, PR expectations, issue routing (verify against current state).
- `AGENTS.md` — repo-guidelines file consumed by agents (build/test commands, style rules, architecture notes) — must reflect strict-TS reality, plans/ workflow, Node matrix.
- `CLAUDE.md` is the constitution — NOT refreshed here (it's authoritative; a refresh of it is a governance act, T6/T10-adjacent but separate — note if it references stale runtime facts).
- New `plans/` program should be discoverable from contributor docs.

## Files to touch

- `CONTRIBUTING.md`, `AGENTS.md`
- Possibly `docs/README.md` index links
- `plans/README.md` — cross-link check
- Do NOT touch: CLAUDE.md content (flag staleness in evidence instead — constitution edits need explicit project decision), README.md claims (governed)

## Work steps

1. Audit CONTRIBUTING + AGENTS.md: commands still valid? Node/npm versions current? TS reality (type-stripping, strict) described? plans/ referenced?
2. Minimal sync edits — factual corrections only.
3. Add plans/ pointer in CONTRIBUTING (how work is planned now).
4. Note any CLAUDE.md staleness found (e.g., references to old runtime surfaces) in evidence — for a separate constitutional-review decision.
5. Gates; mark T10 done.

## Constraints (STRICT)

- MUST NOT edit CLAUDE.md — it's the constitution; staleness is reported, not patched here.
- MUST NOT strengthen claims (C.6) — docs describe commands/tooling, not capability claims.
- MUST keep AGENTS.md's role intact (repo guidelines) — don't turn it into docs duplication.
- Docs MUST reflect tested reality only (if Node 26 CI isn't green yet, say "verification in progress").

## Acceptance gates

- [ ] CONTRIBUTING + AGENTS.md reflect verified current state
- [ ] plans/ discoverable from contributor docs
- [ ] Gates green; T10 marked done

## Evidence to record

- Per-file staleness list + corrections; CLAUDE.md findings for separate review.

## Rollback

`git revert`.
