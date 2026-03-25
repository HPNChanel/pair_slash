# PairSlash 90-Second Demo Script

This script follows the recommended wedge order:

1. `onboard-repo`
2. `memory-candidate -> memory-write-global`
3. `review/fix loop`

## Cold Open

"Every time I come back to a repo with terminal AI, I pay the same tax:
rebuild context, double-check what the model guessed, and clean up output that
is almost right. PairSlash exists to remove that tax without asking me to trust
a black box."

## Task Setup

"I am back in a real repo after a context switch. I need to understand what
matters, save one important piece of project truth safely, and then review a
fix without letting the workflow go off the rails."

## Problem

"Raw CLI help is fast, but it usually breaks in three places: wrong repo
assumptions, repeated cleanup from almost-right output, and no disciplined
project memory when the session ends."

## Workflow

"First, from `/skills`, I run `pairslash-onboard-repo`. It gives me the repo
facts that matter first, separates facts from assumptions, and points me to the
next workflow instead of dumping a generic summary.

Second, I take one real finding and run the memory path. `pairslash-memory-candidate`
keeps only evidence-backed project truth. Then
`pairslash-memory-write-global` shows me the durable change before anything is
written. Nothing becomes project memory without an explicit acceptance step.

Third, I use the review/fix loop. PairSlash reviews the work, shows what is
actually wrong, and hands off into an explicit fix step instead of pretending
to be an autopilot."

## Outcome

"Now I am back in the repo faster, I reused a workflow with clearer guardrails,
and I ended the session with project truth I can trust next week."

## Why It Matters

"That is the adoption wedge: less context rebuild, less cleanup, and less
guesswork about what became durable."

## Closing Line

"PairSlash is not another agent framework. It is the trust layer for
terminal-native AI workflows on Codex CLI and GitHub Copilot CLI."
