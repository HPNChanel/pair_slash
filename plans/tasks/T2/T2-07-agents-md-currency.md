---
id: T2-07
track: T2
title: AGENTS.md currency verification + emission decision
status: done
depends_on: []
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  adr: docs/architecture/adr-0002-agents-md-emission.md
  decision: defer — managed-block merge (Option B) is the only ownership-safe emission design and needs region-level machinery the installer lacks; managed-file and nested-file variants rejected
  agents_md_audit: all referenced npm scripts still exist; npm pin drift 11.7.0→11.14.1 synced; convention verified (freeform Markdown, ancestor jurisdiction, v1.1 proposal unratified)
  gates: lint=0, test=0
---

## Objective

Verify the repo's `AGENTS.md` conforms to the current AGENTS.md convention, decide whether PairSlash compilers should emit/merge AGENTS.md fragments for installed packs, and record the decision.

## Context & sources

- AGENTS.md is the open convention for repo-level agent instructions; Codex consumes it natively (CLAUDE.md §13.2 lists it in the Codex mapping).
- Repo already has a root `AGENTS.md` (repo-guidelines for humans/agents) — that's for THIS repo, distinct from what a pack might emit into a *target* repo on install.
- Question to answer: should installing a PairSlash pack also drop/update an `AGENTS.md` fragment in the target repo (e.g., "this repo uses PairSlash workflows; memory at .pairslash/")? Risks: clobbering user's existing AGENTS.md (ownership); benefits: runtimes auto-read it.

## Files to touch

- `docs/architecture/` — decision record file (e.g., `adr-XXXX-agents-md-emission.md` following existing ADR naming)
- `AGENTS.md` — only if currency check finds genuine staleness (minor sync)
- If decision = adopt: a follow-up task is created for the emitter — this task ships the decision, not the emitter.
- Do NOT touch: compilers (pending decision)

## Work steps

1. Read current AGENTS.md spec/convention state (agents.md / community spec) — verify required/optional sections, precedence conventions.
2. Audit repo's `AGENTS.md` for spec compliance + staleness (it references lint/test commands — verify they still match scripts).
3. Decide emission: adopt (with ownership-safe merge semantics only — never overwrite an existing AGENTS.md; append-managed-block pattern) / defer / reject. Record rationale: ownership risk vs agent-onboarding value.
4. Write the ADR at `docs/architecture/adr-XXXX-*.md` (next free number).
5. If AGENTS.md needs updates, make minimal sync edits.

## Constraints (STRICT)

- MUST NOT overwrite/clobber a target repo's existing `AGENTS.md` in any adopted design — managed-block merge or nothing (ownership rule from charter).
- MUST NOT treat AGENTS.md emission as a memory write — it's a runtime-instruction file; keep it in install-asset semantics.
- Decision MUST be recorded as an ADR (charter §23.3 — architectural change discipline).
- MUST NOT add AGENTS.md generation that bypasses preview (C.4).

## Acceptance gates

- [x] ADR written with explicit adopt/defer/reject + rationale
- [x] `AGENTS.md` verified current or minimally synced
- [x] `npm run lint`, `npm run test` green

## Evidence to record

- ADR path; AGENTS.md audit findings.

## Rollback

`git revert` — docs-only unless emitter task spins up later (then separate).
