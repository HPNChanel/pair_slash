---
title: OSS Positioning
phase: 9
status: draft
owner_file: docs/phase-9/oss-positioning.md
baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md
---

# Reality Scan

## Recommended Homepage / README Narrative

PairSlash should open on a narrow pain, not on architecture.

Recommended narrative:

- Terminal AI gets less trustworthy the moment project context has to survive the current session.
- PairSlash is the OSS trust layer for terminal-native AI workflows.
- It supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- `/skills` is the canonical front door on both supported runtimes.
- It gives users explicit workflows, preview-first lifecycle commands, and an authoritative Global Project Memory path that is explicit-write-only, previewable, audited, and reviewable.
- When setup or runtime behavior fails, the public path starts with `doctor`, then moves to local debug / support-bundle capture instead of vague "just retry" advice.

This keeps the homepage centered on three outsider questions:

1. Why install this: to make terminal AI workflows trustworthy enough to reuse.
2. Where do I start: `doctor`, install, `/skills`, first workflow.
3. What happens when it fails: doctor-first triage with a local-first support path.

## Rejected Narrative And Why It Is Dangerous

Rejected narrative:

"PairSlash is a cross-runtime agent framework with persistent memory for terminal AI."

Why this is dangerous:

- It reframes PairSlash as a generic framework instead of a trust layer.
- It implies runtime breadth the repo does not support.
- It weakens `/skills` as the visible front door.
- It invites parity claims that conflict with the compatibility matrix.
- It makes memory sound ambient or automatic instead of explicit-write-only.
- It encourages README language that outruns current validation evidence.

# Decisions

## README Opening Decision

The README opening should be painpoint-first, runtime-aware, and task-first in this order:

1. State the failure mode: terminal AI loses trust when repo truth and safe writes do not survive the session.
2. State the category line: PairSlash is the trust layer for terminal-native AI workflows.
3. State the exact scope: supports exactly Codex CLI and GitHub Copilot CLI.
4. State the front door: `/skills` is canonical.
5. State the trust boundary: Global Project Memory writes are explicit, previewable, audited, and reviewable.
6. State the recovery path: when it fails, start with `doctor`.

## Recommended Section Order For README

Recommended order:

1. Hero / opening pain and category line
2. Why install this
3. Choose your runtime lane
4. Start here
5. First successful workflow
6. What happens when it fails
7. Why PairSlash is different
8. Task-first workflow map
9. Compatibility and support boundaries
10. Contribute

## Public Default First-Run Wedge

Decision:

- Public default first-run wedge: `pairslash-onboard-repo`
- First shipped bootstrap success after install: `pairslash-plan`

Why this split is correct:

- `pairslash-onboard-repo` is the public adoption wedge from `docs/phase-3.5/wedge-workflows-decision.md`.
- `pairslash-plan` is still the defensible bootstrap path in `README.md`, `docs/workflows/install-guide.md`, `docs/workflows/phase-4-quickstart.md`, and the CLI bootstrap selection.
- `pairslash-onboard-repo` is still `release_channel: canary`, so wording must keep maturity explicit.
- Public docs should show the wedge without pretending the bootstrap installer currently defaults to onboarding.

## First Command In Public Onboarding

Decision:

The first command shown in public onboarding should be:

```bash
npm run pairslash -- doctor --runtime codex --target repo
```

Why this command goes first:

- It matches the root script surface already exposed in `package.json`.
- It leads with diagnosis before mutation.
- It is the clearest answer to "what do I do first?" for a new user.
- It reinforces that failure handling is part of the product, not an afterthought.

## Recommended Docs Site Top Nav And Side Nav

### Top Nav

Recommended top nav:

- Start Here
- By Task
- By Runtime
- Failure and Support
- Contribute

This keeps outsider navigation centered on adoption, runtime choice, and recovery before maintainer detail.

### Task-First Side Nav

Recommended task-first side nav:

- Start Here
- Re-enter a repo
- Plan a change
- Write project memory explicitly
- Review work safely
- Use advanced implementation workflows
- When it fails

Task mapping:

- Re-enter a repo -> `pairslash-onboard-repo`
- Plan a change -> `pairslash-plan`
- Write project memory explicitly -> `pairslash-memory-candidate` then `pairslash-memory-write-global`
- Review work safely -> `pairslash-review`
- Use advanced implementation workflows -> `pairslash-backend`, `pairslash-frontend`, `pairslash-devops`, `pairslash-release`

### Runtime-First Side Nav

Recommended runtime-first side nav:

- Choose a runtime lane
- Codex CLI
- GitHub Copilot CLI
- Compatibility matrix
- Known broken and prep lanes
- Runtime verification

This navigation should make lane differences legible instead of flattening them into generic support copy.

## First 90 Seconds Experience

The first 90 seconds should let a coder answer the three public questions without reading the full workflow catalog.

Required elements in view:

- A painpoint-first opening that names repo re-entry and trusted durable writes as the problem.
- The exact category line: trust layer for terminal-native AI workflows.
- The exact runtime scope: Codex CLI and GitHub Copilot CLI only.
- A visible `/skills` statement as the canonical front door.
- A short "Start here" path that begins with `doctor`.
- A short "When it fails" path that points to doctor, debug, trace export, and the support issue template.
- A visible support caveat that claims are lane-specific, not universal.

If a first-time visitor cannot see scope, start path, and failure path immediately, the public narrative is too abstract.

## First Successful Workflow Experience

The first successful workflow experience should be explicit and narrow:

1. Run `npm run pairslash -- doctor --runtime codex --target repo`.
2. Preview install.
3. Install with apply.
4. Launch the runtime from repo root.
5. Run `/skills`.
6. Select `pairslash-plan`.
7. Ask: `Create a repo plan from the current repo state.`

What happens next:

- After first success, the next recommended public workflow is `pairslash-onboard-repo` (`canary`) for repo re-entry.
- Durable memory comes later and stays explicit: `pairslash-memory-candidate` then `pairslash-memory-write-global`.
- Review stays review-first and explicit, not autonomous.

## What We Say About Support, And What We Do Not Say

What we say:

- Support is lane-specific and evidence-bound.
- `doctor` is the first support entrypoint.
- PairSlash provides local-first debug, trace export, and support-bundle commands.
- Public issue intake should point to the matching template under `.github/ISSUE_TEMPLATE/`.
- The support-bundle template is the artifact-heavy escalation path when debug/trace artifacts already exist.
- Windows is still a `prep` lane until live install evidence exists.
- GitHub Copilot CLI prompt-mode direct invocation is `known-broken`; `/skills` is the canonical path.

What we do not say:

- We do not say runtime parity is solved.
- We do not say Windows has live install support.
- We do not say PairSlash has broad benchmark-backed product validation.
- We do not say Copilot direct invocation is an equal public path.
- We do not say PairSlash fixes failures automatically.
- We do not say support breadth extends beyond the evidence in the compatibility matrix and support docs.

## Public Wording Guardrails

Use these wording guardrails in README, docs-nav labels, and public onboarding pages.

Allowed wording:

- "PairSlash is the trust layer for terminal-native AI workflows."
- "PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI."
- "`/skills` is the canonical entrypoint on both supported runtimes."
- "Global Project Memory writes are explicit, previewable, audited, and reviewable."
- "Use `doctor` first when setup or runtime behavior fails."
- "Support claims are lane-specific: `stable-tested`, `degraded`, `prep`, or `known-broken`."

Forbidden wording:

- "PairSlash is a generic agent platform/framework."
- "PairSlash works anywhere terminal agents run."
- "Memory stays in sync automatically."
- "Runtime parity is complete."
- "Copilot direct invocation is fully supported."
- "PairSlash is benchmark-proven with strong reuse or business validation."

## Three Public Promises That Are Safe

Safe public promises:

1. PairSlash supports exactly two runtimes and keeps `/skills` as the canonical front door.
2. Global Project Memory writes are explicit-write-only, previewable, audited, and reviewable.
3. When failure happens, PairSlash gives a doctor-first, local-first support path with debug and support-bundle capture.

## Three Public Promises That Are Currently Unsafe

Unsafe public promises:

1. Runtime parity across Codex, Copilot, Windows, macOS, and Linux.
2. Benchmark-backed validation of repeated user adoption, business pull, or weekly reuse.
3. Automatic durable memory upkeep or autonomous review/fix behavior.

# File/Path Plan

## README Opening Ownership

The README should own:

- Category line
- outsider-first pain statement
- exact runtime scope
- `/skills` front door
- first command
- first workflow
- failure path entrypoint

It should not own:

- full support operations detail
- maintainer triage procedure
- benchmark evidence deep dives
- exhaustive workflow pack reference

## Start Here Page Ownership

The Start Here page should own the executable newcomer path:

1. `doctor`
2. `preview install`
3. `install --apply`
4. `/skills`
5. `pairslash-plan`
6. next workflow: `pairslash-onboard-repo`
7. support path if blocked

This content should stay aligned with:

- `docs/workflows/install-guide.md`
- `docs/workflows/phase-4-quickstart.md`
- `docs/workflows/phase-4-doctor-troubleshooting.md`

## Support / Issue Reporting Entry Point

Recommended public support entry point:

- top-nav label: `Failure and Support`
- first action: run `doctor`
- escalation path: `debug --bundle` or `trace export --support-bundle`
- issue intake: choose the matching template under `.github/ISSUE_TEMPLATE/`
- artifact-heavy fallback: `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`

This path should read as operationally concrete, not community-handwave support.

## Contributor Entry Point

Recommended contributor entry point:

- top-nav label: `Contribute`
- opening angle: contribute to the trust layer, not to a generic agent platform
- required contributor orientation:
  - two-runtime scope
  - `/skills` front door
  - explicit-write-only memory discipline
  - no hidden writes
  - no third runtime drift

## Maintainer / Triage Entry Point

Recommended maintainer / triage entry point:

- linked from `Failure and Support` and `Contribute`
- not promoted as a primary outsider top-nav item

Maintainer surfaces should own:

- triage note templates
- repro routing
- redaction/share safety
- compat-lab vs live-runtime reproduction
- lane-specific support decisions

# Risks / Bugs / Drift

## Narrative Drift Risks

- Wedge drift: public docs may confuse `pairslash-onboard-repo` with the current bootstrap installer default.
- Support drift: README language may flatten `stable-tested`, `degraded`, `prep`, and `known-broken` into "supported."
- Product drift: public copy may slowly turn PairSlash into a vague agent framework.
- Memory drift: copy may imply background memory updates instead of explicit authority.
- Failure-path drift: docs may oversell happy-path onboarding and under-specify doctor-first recovery.

## Repo Truth This Positioning Must Respect

- `README.md` already positions PairSlash as a trust layer and keeps `/skills` canonical.
- `docs/compatibility/compatibility-matrix.md` limits the strongest support claim to lane-specific evidence and marks Windows as `prep`.
- `docs/releases/phase-5-shipped-scope.md` preserves preview-before-write, no hidden write, and no silent fallback.
- `docs/releases/scoped-release-verdict.md` is the scoped release-installability verdict.
- `docs/validation/phase-3-5/verdict.md` is the product-validation verdict.
- `docs/releases/public-claim-policy.md` is the public-claim boundary.
- `docs/phase-3.5/wedge-workflows-decision.md` keeps onboarding, memory, then review/fix as the wedge order.
- `docs/workflows/install-guide.md` and `docs/workflows/phase-4-quickstart.md` make `pairslash-plan` the current first installed workflow.

# Acceptance Checklist

- The document clearly answers: why install this, where do I start, what happens when it fails.
- The opening reads as trust layer, not framework.
- `/skills` appears as the canonical front door.
- The two-runtime scope is explicit and early.
- The public default first-run wedge is explicitly named as `pairslash-onboard-repo`.
- The first shipped bootstrap success is explicitly named as `pairslash-plan`.
- The first onboarding command is explicitly named as `npm run pairslash -- doctor --runtime codex --target repo`.
- The README section order is decision-complete.
- The docs top nav and both side-nav models are decision-complete.
- Support wording is evidence-bound and lane-specific.
- Safe and unsafe public promises are explicitly listed.

# Next Handoff

Use this file as the source of truth for the next Phase 9 public surfaces:

- `README.md`
- `docs/phase-9/onboarding-path.md`
- `docs/phase-9/issue-taxonomy.md`
- `docs/phase-9/contributor-model.md`
- `docs/phase-9/maintainer-playbook.md`

The first downstream execution sequence should be:

1. Patch `README.md` to match the opening, section order, and first-command decision in this file.
2. Fill `docs/phase-9/onboarding-path.md` from the Start Here and failure-path decisions here.
3. Fill `docs/phase-9/issue-taxonomy.md` and `docs/phase-9/maintainer-playbook.md` from the support entrypoint and triage ownership decisions here.
