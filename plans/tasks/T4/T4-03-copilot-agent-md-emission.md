---
id: T4-03
track: T4
title: Copilot .agent.md emission for persona workflows (non-authoritative only)
status: done
depends_on: [T4-02]
est_size: M
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  - "verified .agent.md schema (docs.github.com custom-agents reference, 2026-09-28): frontmatter name (optional), description (required), tools, model, target, disable-model-invocation, user-invocable, mcp-servers, metadata; body <=30k chars; discovery dirs .github/agents/ (repo), ~/.copilot/agents/ (user), plugin agents/ (plugin-root component dir, agents pointer in plugin.json)"
  - "manifest: runtime_bindings.copilot_cli.agent.emit (boolean, optional) — copilot-only binding extension; absent on codex"
  - "normalize derives generated asset copilot-agent-profile (agents/<id>.agent.md, agent_fragment/agent surface, copilot_agent_profile generator); ownership auto-derived"
  - "copilot compiler renders deterministic persona shim: name/description (summary)/tools [read, search]/disable-model-invocation (true unless implicit-allowed)/metadata; body defers to SKILL.md contract, /skills canonical"
  - "plugin mode hoists agent file to plugin-root agents/ + agents pointer in plugin.json; skill mode keeps it dormant inside pack dir (reviewable, no auto-placement into .github/agents/)"
  - "lint: LINT-AGENT-001 error (write-authority + emit), LINT-AGENT-002 warning (non-read-oriented + emit), LINT-AGENT-003 warning (emit without SKILL.md sibling)"
  - "opted-in pack: pairslash-review (read-only toolset persona); all other core packs emit none"
  - "docs: copilot-cli.md mapping + plugin-emission-contract decision 4 updated; implicit-invocation-policy.md agent-shim section"
  - "gates: spec-core 59/59, compiler-copilot 16/16, lint-bridge 32/32, npm test all pass, lint pass, typecheck pass, test:release pass"
---

## Objective

Support optional `.agent.md` custom-agent emission for the Copilot lane — for persona-style read-oriented workflows where agent delegation is useful — under strict authority limits.

## Context & sources

- Copilot custom agents: `.agent.md` markdown profiles; executed as subagents; auto-selectable by description or via `--agent` headless (CP-06).
- Charter §13.3: "Persona-oriented behaviors may map to agents, but write-authority logic should remain skill-disciplined." — agent emission is forbidden for write-authority packs.
- Copilot compiler already emits `agents/runtime-context.md` (docs/runtime-mapping) — this task formalizes intentional agent emission for specific packs.
- Copilot SDK/agents discovery dirs — agents live under plugin `agents/` or `.github/agents/`? Verify the repo-target discovery path during implementation.

## Files to touch

- `packages/runtimes/copilot/compiler/src/` — agent emission
- `packs/core/*` — only manifests of packs where agent emission is justified (decision list in work steps; likely none or read-oriented ones like review/onboard)
- `packages/tools/lint-bridge/src/` — rule: write-authority + agent emission → hard error
- `tests/` — emission + guardrail tests
- Do NOT touch: codex compiler (subagent surface differs — separate evaluation, not this task), memory workflows

## Work steps

1. Verify `.agent.md` schema (frontmatter fields: name/description/tools/model per current docs) + repo-target discovery dir.
2. Design manifest declaration: `emits_agent: true` or `agent` section on copilot runtime_bindings — restricted to `read-oriented`/`candidate-producing` classes only.
3. Emit `.agent.md` for opted-in packs: name, description (with T4-02 discipline), body pointing back to the canonical skill workflow (agent is a persona shim, not a parallel implementation).
4. Lint guardrail: write-authority + agent emission → error; agent without `SKILL.md` canonical sibling → warn (agents reference skills, not replace them).
5. Tests + goldens + gates.

## Constraints (STRICT)

- MUST hard-forbid agent emission on write-authority workflows (charter §13.3 literal rule; enforce in lint, not just docs).
- Agents MUST defer to skill semantics — emitted agent text references the skill workflow as authority; no divergent logic embedded in the agent file (one semantic source, C.18.1).
- MUST NOT create a competing invocation path — agent emission is supplementary discovery; `/skills` canonical statement unchanged (C.2).
- MUST keep agent files deterministic + reviewable.
- If `.agent.md` format details can't be verified from docs → emit minimal known-valid fields only, mark inferred fields absent (fail closed).

## Acceptance gates

- [x] Opted-in pack emits valid `.agent.md`; non-opted packs emit none
- [x] Write-authority + agent → lint error (tested)
- [x] Gates green

## Evidence to record

- Verified `.agent.md` schema fields with source; emitted example.

## Rollback

`git revert` — opt-in emission.
