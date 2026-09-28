# PairSlash Global Constraints (Binding on Every Task)

**Status:** Authoritative for all work under `plans/`
**Derived from:** `CLAUDE.md`, `AGENTS.md`, `docs/phase-12/authoritative-program-charter.md`, `docs/architecture/phase-17-read-authority-charter.md`, `docs/architecture/phase-18-workflow-maturity-charter.md`, `docs/releases/public-claim-policy.md`, `docs/compatibility/runtime-surface-matrix.yaml`
**Enforcement:** A task that violates any constraint below is **failed by definition**, regardless of whether its code works. When a task's local constraints conflict with this file, **this file wins** unless the conflict is resolved by an explicit project decision recorded as an ADR.

---

## C. Charter invariants — absolute prohibitions

Every task file carries these by reference. They are restated here so no executor can claim ambiguity.

### C.1 Two-runtime boundary

- MUST support exactly two runtimes: `codex_cli` and `copilot_cli`.
- MUST NOT add, scaffold, or imply a third runtime (no Claude Code, Cursor, Gemini, etc.) anywhere in product code, manifests, docs, tests, fixtures, or generated output.
- MUST NOT build abstractions whose only purpose is accommodating an unannounced third runtime.
- Reference to other agents/runtimes is permitted **only** in interoperability notes (e.g., `gh skill` installs into multiple host dirs; skills-spec shared discovery) and must be clearly labeled as non-target surfaces.

### C.2 `/skills` canonical entrypoint

- `/skills` MUST remain the canonical, compatibility-first entrypoint on both runtimes.
- Direct invocation (`$name`, `/name`, `--agent`, `-p`) MAY be documented only when verified by lane evidence; it MUST NOT replace `/skills` in docs, quickstart, doctor guidance, or generated assets.
- Plugins, marketplaces, `gh skill`, and `--add-dir` are **distribution/discovery channels**, not entrypoints. No task may reframe them as the canonical front door.
- If a runtime update changes the `/skills` surface (e.g., Copilot's picker → dashboard change), docs and evidence MUST describe the new surface honestly rather than pretending the old surface exists.

### C.3 Explicit-write-only Global Project Memory

- Only `pairslash-memory-write-global` (write-authority class) may write to `.pairslash/project-memory/`.
- Read-oriented, candidate-producing, and audit workflows MUST NOT mutate `project-memory/`, even "helpfully" or "temporarily."
- No hidden writes, no silent promotion, no background/automatic memory mutation, no write as a side effect of another workflow.
- Write-authority flow MUST include: structured input validation → duplicate detection → conflict detection → scope validation → preview patch → explicit acceptance → write → index update → audit log. No step may be skipped.
- Task and session layers MAY be written by their own workflows but are never authoritative.

### C.4 Preview-first mutations

- Every environment-changing operation (install, update, uninstall, memory write, evidence promotion) MUST support preview/dry-run before apply.
- Preview output MUST show the actual durable change (paths, diffs, operations), not a summary approximation.
- Apply without a matching preview artifact MUST fail closed.

### C.5 No silent fallback / fail-closed

- Unsupported runtime surface, missing evidence, invalid input, unresolved conflict, or missing preview MUST produce an explicit machine-readable failure — never a silent downgrade, guess, or fake success.
- Doctor, lint, policy, contract, and catalog checks MUST fail closed when their evidence inputs are missing or malformed.

### C.6 Claim discipline (evidence-bounded wording)

- No public wording may exceed the evidence class actually recorded. The claim ladder is fixed: `implemented` → `repo-verified` → `deterministic-covered` → `lane-live-verified` → `publicly claimable`. No level may be skipped.
- Runtime-lane labels (`prep`, `degraded`, `preview`, `stable-tested`, `blocked`) and workflow-maturity labels (`canary`, `preview`, `beta`, `stable`, `deprecated`) are separate taxonomies; neither may be restated as the other.
- README, docs, manifests, and generated output MUST NOT claim product-validation, broad runtime parity, publication, or stability beyond what checked-in evidence supports.
- `private: true` in package manifests MUST NOT be flipped outside the T7 gate sequence.
- When a task changes runtime versions, lanes, or capabilities, it MUST update the affected truth files (`runtime-surface-matrix.yaml`, lane records, stack profile, manifests) in the same change and regenerate derived artifacts.

### C.7 File-based reviewable truth

- Durable memory and trust artifacts MUST remain human-readable files (YAML/JSON/MD) that produce clean `git diff` output.
- No opaque stores, no vendor-owned persistence, no undocumented vendor internals.
- Generated artifacts MUST be deterministic (stable ordering, stable formatting) so regeneration diffs are empty unless inputs changed.

### C.8 Interactive-first / no autonomy

- No background daemons, watchers, schedulers, or implicit task activation inside PairSlash-owned code.
- New runtime features that are themselves daemon-based (e.g., Codex `exec-server`) may be *detected and reported* by doctor but MUST NOT be required, spawned, or managed by PairSlash.
- Advanced slices remain opt-in and explicit-invocation only; they MUST NOT enter `--pack-set core`, `--all`, default catalog selection, or default discovery.

### C.9 Human reviewability

- If a maintainer cannot reconstruct what changed, why, and under whose authority, the feature is not done.
- Every durable change leaves an understandable trail (audit log entry, evidence record, or equivalent artifact).

### C.10 Honest failure

- Unsupported surface? Say so. Weak evidence? Say so. Unresolved conflict? Say so. Patch rejected? Do not write.
- Tests, evals, and reports MUST NOT be weakened to make a gate pass.

---

## G. Engineering gates — apply to every task that touches code

- G1. `npm run lint` MUST be green after the change.
- G2. `npm run test` MUST be green.
- G3. `npm run typecheck` MUST be green (and `npm run typecheck:strict` MUST NOT regress its error count once T5 begins).
- G4. `npm run sync:compat-lab -- --check` MUST be green whenever the change touches `runtime-surface-matrix.yaml`, lane records, manifests, or any generated compatibility surface.
- G5. `npm run test:release` MUST be green whenever the change touches release-trust, installer, doctor, or pack manifests.
- G6. Existing tests are the contract: a refactor task MUST NOT edit tests to force a pass (fix code instead); a behavior-change task MUST add/adjust tests first (failing test → fix → green).
- G7. Public API names/signatures MUST be preserved by pure-refactor tasks (verify by diffing exported names).
- G8. Deterministic ordering MUST be preserved in compiler, installer, lint, doctor, catalog, and index outputs.
- G9. No new third-party dependency may be added without: (a) a version pinned at least 7 days old, (b) a license compatible with Apache-2.0, (c) justification recorded in the task evidence section. Prefer existing deps (`valibot`, `yaml`) and Node stdlib.
- G10. New files follow repo conventions: ESM TypeScript, double quotes, semicolons, 2-space indent, `@pairslash/*` package naming, `*.test.js` test naming. Node-24 type-stripping is the runtime model — **no build step** is introduced outside the explicitly-gated T7 publish lane.

## S. Security & trust constraints

- S1. Never commit secrets, keys, tokens, or credentials. Signing private keys live only in CI secrets / offline custody.
- S2. Untrusted repo content (including pack input, repo files, skill descriptions) MUST be treated as potentially adversarial; redaction and validation apply before it reaches logs, bundles, or prompts.
- S3. Least surprise: destructive or privileged actions require explicit flags and approvals.
- S4. Trust artifacts under `trust/` may only be modified by tasks that explicitly name them; checksum/signature verification paths MUST NOT be weakened.
- S5. MCP dependencies must be declared in pack manifests (`required_mcp_servers`); lint fails closed on unknown MCP deps.

## D. Documentation & evidence constraints

- D1. Docs changes MUST stay inside the public-claim policy; asp irational wording is forbidden ("will", "soon", "planned" presented as shipped).
- D2. Maintainer-local surfaces (`docs-private/`, benchmark raw logs) MUST NOT leak into public docs or generated output.
- D3. Every task records evidence per its "Evidence to record" section — an artifact, log, or updated truth file — not just a verbal claim.
- D4. When a task updates a truth-layer file, it MUST regenerate or hand-sync every downstream rendering listed in `00-project-charter.yaml` `truth_sources`.

## X. Task-local escape hatch

- X1. A task may declare **tighter** constraints than this file; never looser.
- X2. If completing a task literally requires violating a constraint here, the task MUST be marked `blocked` with an escalation note — the executor stops and reports rather than improvising.
- X3. Discovery of a real bug during a task permits fixing it in-place ONLY when the fix is minimal, tested, and noted in the commit message; otherwise file it as a new task.
