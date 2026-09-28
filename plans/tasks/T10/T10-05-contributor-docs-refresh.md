---
id: T10-05
track: T10
title: Contributor/dev docs refresh (CONTRIBUTING, AGENTS.md sync)
status: todo
depends_on: [T10-02]
est_size: S
claimed_by:
claimed_at:
completed_at:
evidence:
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
