# PairSlash Phase 3.5 Messaging and Narrative Guardrails

Messaging exists to describe the validated wedge clearly. It does not get to
invent a broader product.

## Core narrative

PairSlash is the trust layer for terminal-native AI workflows on Codex CLI and
GitHub Copilot CLI. It helps solo builders keep project memory writes explicit,
previewable, and auditable through a `/skills`-first workflow.

## Problem framing

The problem is not "agents need more power." The problem is:

- users do not trust durable AI writes into project context
- users lose project truth across sessions
- users hesitate to adopt a workflow that hides side effects

## One-line message

PairSlash makes durable project memory updates safe enough to trust in terminal
AI workflows.

## Supporting points

- `/skills` is the canonical entrypoint.
- Global Project Memory is the durable source of truth.
- Important writes stay explicit, previewable, and auditable.
- The product scope stays inside Codex CLI and GitHub Copilot CLI.
- The PairSlash source repository is licensed under Apache-2.0, while current
  install guidance remains repo-local and non-published.

## Advanced Lane Narrative Boundary

Retrieval, CI, and Delegation are Phase 11 advanced optional lanes.
They are not the main product story.

Public messaging rules:

- root README opening stays core-first
- onboarding copy stays core-first
- wedge workflow narrative stays core-first
- advanced lanes may be linked only as experimental, opt-in side paths
- advanced lane utility does not count as proof that the core wedge has won

## Claims allowed now

Use claims like these:

- "PairSlash is a trust layer for terminal-native AI workflows."
- "It is focused on explicit, reviewable project memory updates."
- "It supports exactly two runtimes: Codex CLI and GitHub Copilot CLI."
- "It aims to help solo builders resume work safely across sessions."

## Claims blocked until stronger evidence exists

Do not use claims like these:

- "PairSlash is a general agent framework."
- "PairSlash works anywhere AI agents run."
- "Installability proves users want the product."
- "Autonomous memory updates remove the need for review."
- "Runtime parity is solved" without recorded evidence on both lanes.
- "Phase 11 advanced lanes are part of the default PairSlash experience."
- "Retrieval, CI, or Delegation broaden PairSlash support" without live evidence.
- "PairSlash is already a published npm package."
- "The Apache-2.0 repo license means every `@pairslash/*` package is public."

## Message review checklist

Before keeping any sentence in README copy, release notes, or demos, ask:

1. Which real painpoint does this sentence map to?
2. Why would this make the target user come back next week?
3. Which validated runtime claim does it rely on?

If a sentence cannot answer those questions, cut it.
