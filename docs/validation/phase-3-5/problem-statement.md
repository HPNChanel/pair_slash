# PairSlash Phase 3.5 Problem Statement

## User pain

The target user is a solo builder working in Codex CLI or GitHub Copilot CLI
on a real repository with recurring project context.

Their real pain is not "AI needs more autonomy." Their real pain is:

- they do not trust durable AI writes into project context
- they lose important project truth between sessions
- they do not want convenience features that hide side effects

If PairSlash does not reduce those three pains, it does not earn weekly reuse.

## Job to be done

When working across terminal-native AI sessions on a real repo, the user wants
to:

- recover project truth quickly from authoritative memory
- decide what deserves durable memory and what does not
- make important memory writes explicit, previewable, and auditable

## What PairSlash is claiming to solve

PairSlash is claiming one narrow thing in Phase 3.5:

It can make durable project-memory workflows safe enough that a solo builder
will trust them and come back next week for the same job.

## What would count as proof

Proof requires all of the following:

- users hit the pain in real repo work
- PairSlash reduces that pain better than the manual alternative
- the trust layer is part of the value, not just extra ceremony
- the user says they would likely reuse it next week

## What would falsify the claim

Treat any of these as evidence against problem-solution fit:

- users like the output but would not change their habit
- users prefer manual review plus ad hoc notes
- users treat the write-preview flow as friction with no trust upside
- the strongest workflows are unrelated to safe memory writes

## Winning workflow first

The first workflow that must win is:

`candidate -> preview -> explicit acceptance -> audited write`

If this workflow does not beat the manual alternative on trust and repeat
intent, Phase 4 should not expand distribution or installability claims.
