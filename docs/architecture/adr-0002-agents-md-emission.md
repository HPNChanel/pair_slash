# ADR 0002: Defer AGENTS.md Emission Into Target Repos

Status: Accepted (decision: defer)
Date: 2026-09-28
Track: T2-07

## Context

AGENTS.md is the open convention for repo-level agent instructions
(<https://agents.md/>). Current convention state, verified 2026-09-28:

- The file is freeform CommonMark Markdown; there is no required schema or
  frontmatter contract. Conformant content is any non-empty Markdown body.
- Placement is the repository root, with optional nested files in
  subdirectories. Jurisdiction is ancestor-based: a nested `AGENTS.md`
  applies only to files inside its own subtree, and accumulates with
  ancestors; the nearest file wins on conflicts.
- A v1.1 proposal (hierarchical scope, precedence, progressive
  disclosure formalization) is under discussion upstream but not ratified.
- Codex CLI consumes `AGENTS.md` natively (CLAUDE.md §13.2); Copilot also
  reads it as repo instructions.

The question for PairSlash: should installing a pack also emit or merge an
`AGENTS.md` fragment into the *target* repository (e.g., "this repo uses
PairSlash workflows; project memory lives at `.pairslash/`")?

This repo's own `AGENTS.md` was audited during this decision:

- All commands it references (`npm run pairslash -- doctor …`,
  `npm run lint|test|test:acceptance|test:release`, `lint:phase4` /
  `test:phase4` aliases) still exist in `package.json`.
- One drift found and fixed: it pinned `npm@11.7.0` while
  `packageManager` declares `npm@11.14.1`; synced.
- Otherwise the file conforms to the convention (freeform, root-scoped).

## Options considered

### A. Emit `AGENTS.md` as a fully PairSlash-managed file

Feasible with today's installer: create on install, digest-tracked,
block-on-edit update, remove-if-unmodified uninstall. Rejected on UX and
ownership grounds: root `AGENTS.md` is the single highest-touch
agent-instruction file in a repo; users routinely edit it. A PairSlash
write-lock over it would produce constant update blocks and violates the
spirit of the ownership charter (we must not clobber files the user owns
in practice).

### B. Managed-block merge into an existing `AGENTS.md`

Append/update a delimited block (`<!-- pairslash:begin -->` …
`<!-- pairslash:end -->`) inside a user-owned file. This is the only
semantics that respects ownership when the file already exists — but it
requires block-level reconciliation machinery the installer does not have
today (ownership/digest tracking is file-granular, not region-granular).
Region-level edit detection, partial-preservation on update/uninstall,
and preview of intra-file patches are all new surface area.

### C. Emit a nested `AGENTS.md` inside the pack install directory

e.g. `.agents/skills/<pack>/AGENTS.md`. Rejected: ancestor-based
jurisdiction means it only applies to paths inside the pack directory —
agents editing regular repo files never see it. No product value.

### D. Emit a PairSlash-named instruction file elsewhere

e.g. `.pairslash/AGENTS.md` or `AGENTS.pairslash.md`. Rejected: the
convention only auto-reads files literally named `AGENTS.md`; anything
else is dead weight the runtime never loads.

## Decision

**Defer.** PairSlash does not emit or modify `AGENTS.md` in target
repositories in this phase.

Rationale:

1. The only ownership-safe design (Option B, managed-block merge) exceeds
   current installer machinery; shipping a weaker variant would violate
   the ownership charter for the most-edited instruction file in a repo.
2. The agent-onboarding value ("repo uses PairSlash; memory at
   `.pairslash/`") is real but not load-bearing: skill `SKILL.md` bodies
   already carry this guidance into the session where workflows run.
3. Deferral is reversible and cheap — Option B remains the documented
   adopt candidate if installer gains region-managed merge support.

## Consequences

- No emitted artifact touches the target repo's `AGENTS.md`; install
  surface stays limited to managed skill/pack directories.
- Doctor/lint gain no AGENTS.md checks; nothing new to reconcile on
  update/uninstall.
- Users who want runtime-level PairSlash guidance continue to add it
  themselves; SKILL.md guidance covers workflow-time context.

## Re-entry condition

Revisit this decision when the installer supports region-managed
(managed-block) merge semantics for shared files, or when a runtime
formally defines a pack-contributed instruction surface that supersedes
`AGENTS.md` emission.

## Follow-up

1. If T4/T5 lands block-merge machinery for shared files, re-open Option B
   as a dedicated emitter task.
2. Keep this repo's own `AGENTS.md` synced with `package.json` scripts
   (npm pin drift found and fixed in this task).
