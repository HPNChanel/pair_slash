# PairSlash Positioning Statement

## One-paragraph statement

PairSlash is for people who already use terminal AI but do not trust raw AI
output enough to make it a habit. It is the trust layer for terminal-native AI
workflows on Codex CLI and GitHub Copilot CLI: it helps users get back into a
repo faster, run repeated workflows more safely, and keep project memory
disciplined across sessions. Unlike a new agent framework, a black-box
autopilot, or a generic memory store, PairSlash stays narrow, explicit, and
`/skills`-first.

## Category

PairSlash is a trust layer for terminal-native AI workflows.

## Who It Is For

- Solo builders who revisit the same repo often and want faster, safer repo
  re-entry.
- Maintainers and team leads who want less cleanup and less workflow variance
  from almost-right AI output.
- DevEx and platform teams who want a credible trust layer before they scale
  terminal AI usage across repos.

## What Pain It Solves

PairSlash cuts three recurring costs:

- context rebuild when someone comes back to a repo cold
- cleanup from almost-right AI output in repeated workflows
- drift in project truth when durable context lives in chats, notes, and memory
  fragments instead of a disciplined workflow

## What It Is Not

PairSlash is not:

- a new agent framework
- a black-box autopilot
- a generic prompt bundle
- a generic memory app
- a third-runtime compatibility layer

## Why Now

Terminal AI is moving from novelty to repeated repo work. The bottleneck is no
longer "can the model generate something useful?" The bottleneck is "can I get
back into context quickly, reuse a workflow without hidden side effects, and
trust what becomes durable project truth?"

## Why Credible

PairSlash makes narrow promises that users can actually inspect:

- it uses `/skills` as the standard entrypoint instead of magic behavior
- it stays inside exactly two runtimes: Codex CLI and GitHub Copilot CLI
- it starts with high-frequency jobs like repo onboarding and review/fix loops
- it treats durable memory as explicit, reviewable project truth instead of
  silent background state
