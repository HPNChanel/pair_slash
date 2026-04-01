---
title: Phase 9 Coherence Review
phase: 9
status: review
owner_file: docs/phase-9/phase-9-coherence-review.md
baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md
---

# Reality Scan

## Executive Verdict

Phase 9 is directionally credible, but not draft-ready as a public OSS product
surface yet.

The landing narrative is strong, the first workflow path is mostly clear, and
the maintainer/support model is materially more real than before. The remaining
problem is system coherence: the public story promises a tight adoption loop,
but the proof layer is still unmeasured, the support entrypoint is split across
multiple surfaces, and several "public" Phase 9 docs still read like internal
phase-planning material rather than user-facing product docs.

Overall adoption-loop score: `7.0/10`

Verdict: `not ready`

## Scored Review Of The Adoption Loop

| Review question | Score | Verdict | Why | Main evidence |
| --- | --- | --- | --- | --- |
| Does the landing narrative clearly explain the pain solved? | `4.5/5` | Strong | `README.md` now leads with repo re-entry, trusted writes, exact runtime scope, and `/skills` as the front door. | `README.md`, `docs/phase-9/oss-positioning.md` |
| Is the first command/workflow path obvious? | `4.0/5` | Strong | The README and onboarding page give a concrete path: `doctor -> preview install -> install -> /skills -> pairslash-plan`. The remaining drag is command-surface inconsistency between public pages and workflow docs. | `README.md`, `docs/phase-9/onboarding-path.md`, `docs/workflows/install-guide.md`, `docs/workflows/phase-4-quickstart.md` |
| Does the support path feel real and bounded? | `3.0/5` | Mixed | The repro and triage docs are concrete, but the newcomer-facing support route still points both to a generic support-bundle template and to a template directory, while the taxonomy now defines multiple distinct issue lanes. | `README.md`, `docs/phase-9/onboarding-path.md`, `.github/ISSUE_TEMPLATE/`, `docs/support/triage-playbook.md`, `docs/support/repro-assets.md` |
| Do the proof assets create trust instead of hype? | `2.5/5` | Weak | The proof layer is honest about being unmeasured, which helps, but it still does not prove value yet. A user looking for evidence finds taxonomy and placeholders, not before/after proof. | `examples/README.md`, `docs/benchmarks/README.md`, `docs/case-studies/README.md`, `docs/case-studies/*`, `docs/validation/phase-3-5/evidence-log.md` |
| Are there sections that drift back into framework-speak? | `2.5/5` | Weak | Several Phase 9 pages still open with "Phase 9", "public narrative", "proof layer", or other internal planning language rather than user tasks. | `docs/phase-9/README.md`, `docs/phase-9/examples-and-benchmarks.md`, `docs/phase-9/contributor-model.md` |
| Are there any public statements that outrun runtime evidence? | `4.0/5` | Mostly safe | The repo is mostly disciplined about two-runtime scope, `/skills`, explicit writes, and lane-specific caveats. Risk remains where prose compresses exact lane labels or promotes canary workflows without restating maturity. | `README.md`, `docs/compatibility/compatibility-matrix.md`, `packs/core/pairslash-onboard-repo/pack.manifest.yaml` |
| Does the contributor path feel welcoming but still disciplined? | `3.5/5` | Good | `CONTRIBUTING.md` is concrete and bounded. The extra Phase 9 contributor page duplicates some of that material and still reads more like an internal alignment note than an inviting entrypoint. | `CONTRIBUTING.md`, `docs/phase-9/contributor-model.md` |
| Can a maintainer actually use the playbook during a bad report? | `4.0/5` | Strong | The playbook, repro matrix, and issue taxonomy are practical enough for real triage. The missing pieces are automation and a single obvious daily-use maintainer page. | `docs/support/triage-playbook.md`, `docs/support/repro-assets.md`, `docs/maintainers/README.md`, `docs/phase-9/maintainer-playbook.md` |

# Decisions

## Strong Surfaces / Weak Surfaces / Misleading Surfaces

| Surface | Classification | Score/Level | Why | Evidence refs | Fix owner path |
| --- | --- | --- | --- | --- | --- |
| `README.md` opening, start path, and support reality sections | Strong | `4.5/5` | Best current outsider-facing surface. It answers pain, scope, first path, and caveats quickly. | `README.md`, `docs/compatibility/compatibility-matrix.md` | `README.md` |
| `docs/phase-9/onboarding-path.md` | Strong | `4.0/5` | Clear first 90 seconds path and first successful workflow path. | `docs/phase-9/onboarding-path.md`, `docs/workflows/install-guide.md` | `docs/phase-9/onboarding-path.md` |
| `docs/support/repro-assets.md` + `docs/support/triage-playbook.md` | Strong | `4.0/5` | Concrete evidence asks and a usable triage flow keep support local-first and bounded. | `docs/support/repro-assets.md`, `docs/support/triage-playbook.md` | `docs/support/` |
| `docs/maintainers/README.md` | Strong | `3.5/5` | Good operational hub for maintainers once they already know the repo. | `docs/maintainers/README.md`, `docs/phase-9/maintainer-playbook.md` | `docs/maintainers/README.md` |
| `CONTRIBUTING.md` | Strong | `3.5/5` | Welcoming enough for early OSS, with real lane boundaries and issue routing. | `CONTRIBUTING.md`, `docs/phase-9/issue-taxonomy.md` | `CONTRIBUTING.md` |
| `docs/phase-9/README.md` | Weak | `2.5/5` | Useful as an index, but it still looks like a phase-coordination page more than a public docs landing page. | `docs/phase-9/README.md` | `docs/phase-9/README.md` |
| `docs/phase-9/contributor-model.md` | Weak | `2.5/5` | Accurate, but duplicative and internal in tone. It does not improve the contributor journey beyond `CONTRIBUTING.md`. | `docs/phase-9/contributor-model.md`, `CONTRIBUTING.md` | `docs/phase-9/contributor-model.md` |
| `docs/benchmarks/README.md` + `docs/case-studies/*` | Weak | `2.5/5` | Honest placeholders, but still a proof architecture without proof. | `docs/benchmarks/README.md`, `docs/case-studies/*`, `docs/validation/phase-3-5/evidence-log.md` | `docs/benchmarks/README.md`, `docs/case-studies/` |
| `examples/README.md` | Weak | `2.0/5` | Creates a visible examples surface without owning actual examples in that directory. It points outward to `docs/examples/` and case-study placeholders. | `examples/README.md`, `docs/examples/README.md` | `examples/README.md`, `docs/examples/README.md` |
| Public support intake wording in `README.md` and onboarding docs | Misleading | `High` | These surfaces still emphasize one support-bundle template while the actual support model now has multiple issue types. | `README.md`, `docs/phase-9/onboarding-path.md`, `.github/ISSUE_TEMPLATE/`, `docs/phase-9/issue-taxonomy.md` | `README.md`, `docs/phase-9/onboarding-path.md`, `.github/ISSUE_TEMPLATE/config.yml` |
| Public proof-story surfaces under `docs/phase-9/` | Misleading | `Medium` | They are mostly strategy and planning docs presented alongside user-facing pages. An outsider can mistake planning artifacts for finished public docs. | `docs/phase-9/README.md`, `docs/phase-9/examples-and-benchmarks.md`, `docs/phase-9/support-surfaces-summary.md` | `docs/phase-9/` |

## Overclaim Risk Audit

| Claim or wording | Current surface | Risk level | Why it outruns evidence or stays safe | Constraint source | Required correction |
| --- | --- | --- | --- | --- | --- |
| "PairSlash is the OSS trust layer for terminal-native AI workflows." | `README.md` | Low | Safe. This matches current shipped scope and the Phase 9 baseline. | `docs/phase-9/phase-9-baseline-reality-lock.md`, `docs/releases/phase-5-shipped-scope.md` | None beyond keeping the narrow framing. |
| "It supports exactly two runtimes: Codex CLI and GitHub Copilot CLI." | `README.md`, `docs/phase-9/onboarding-path.md` | Low | Safe and well constrained. | `docs/releases/phase-5-shipped-scope.md`, `docs/validation/phase-3-5/verdict.md` | None. |
| "`/skills` is the canonical front door." | `README.md`, onboarding docs | Low | Safe and repeatedly backed by shipped-scope docs and pack manifests. | `docs/releases/phase-5-shipped-scope.md`, `packs/core/*/pack.manifest.yaml` | None. |
| "GitHub Copilot CLI | user | Supported with caveats" | `README.md` start table | Medium | Directionally true, but weaker than the exact public label `degraded`. The prose compresses a specific compatibility state into softer marketing language. | `docs/compatibility/compatibility-matrix.md` | Replace with the exact lane label or show the label adjacent to the prose. |
| "After first success, use `pairslash-onboard-repo` as the repo re-entry wedge workflow." | `README.md`, `docs/phase-9/onboarding-path.md` | Medium | Strategically correct, but the pack is still `release_channel: canary` and public proof is still unmeasured. | `docs/phase-3.5/wedge-workflows-decision.md`, `packs/core/pairslash-onboard-repo/pack.manifest.yaml`, `docs/validation/phase-3-5/evidence-log.md` | Keep it as "next workflow" and restate canary/proof limits anywhere it is promoted. |
| "Issue template: pairslash support bundle" as the public support path | `README.md`, `docs/phase-9/onboarding-path.md` | High | The operational model now has install/runtime/workflow/memory/docs/pack intake lanes. A single template-first message misstates the actual support model. | `docs/phase-9/issue-taxonomy.md`, `.github/ISSUE_TEMPLATE/*` | Replace with "choose the matching issue template" and reserve the support bundle template for artifact-heavy cases. |
| "Examples" as a visible public proof surface | `examples/README.md` | Medium | The page suggests a concrete examples layer, but the directory does not own runnable example assets. The real examples still live under `docs/examples/`. | `examples/README.md`, `docs/examples/README.md` | Declare which path is canonical or turn `examples/README.md` into a thin pointer page. |
| "Benchmark asset index" and case studies as proof | `docs/benchmarks/README.md`, `docs/case-studies/*` | Medium | The pages are careful, but a public reader still finds a proof layer with zero filled evidence. | `docs/benchmarks/README.md`, `docs/case-studies/*`, `docs/validation/phase-3-5/evidence-log.md` | Fill at least one measured onboarding asset or downgrade the surface to "planned proof assets". |
| "Failure and Support" feels like a finished public support lane | `docs/phase-9/README.md`, `README.md` | Medium | The underlying support docs are real, but the public entrypoint is still split between workflow docs, support docs, and templates. | `docs/support/phase-7-support-ops.md`, `docs/support/triage-playbook.md`, `.github/ISSUE_TEMPLATE/config.yml` | Create one explicit public support entry page or chooser. |

# File/Path Plan

## Top 10 Final Fixes Before Calling Phase 9 Draft-Ready

1. `README.md`, `docs/phase-9/onboarding-path.md`
   Problem: public support guidance still points users to one bundle template even though support now has multiple issue surfaces.
   Correction direction: change the newcomer-facing wording to "choose the matching issue template" and keep the support-bundle template as the artifact-heavy escalation path.
   Why it matters: the failure path is one of the three core product questions.

2. `.github/ISSUE_TEMPLATE/config.yml`
   Problem: the config is minimal and does not help route newcomers to the right issue lane.
   Correction direction: add explicit contact links or clearer chooser guidance for install bug, runtime mismatch, workflow bug, memory bug, pack request, and docs drift.
   Why it matters: support should feel operational, not like maintainers expect users to infer the taxonomy from filenames.

3. `examples/README.md`, `docs/examples/README.md`
   Problem: there are now two example surfaces with different ownership models and names that imply the same thing.
   Correction direction: pick one canonical examples home and demote the other to a thin redirect/pointer.
   Why it matters: first-run trust drops when a user clicks "examples" and lands in a directory that mostly points elsewhere.

4. `docs/benchmarks/README.md`, `docs/case-studies/onboard-repo-before-after.md`, `docs/validation/phase-3-5/evidence-log.md`
   Problem: the proof layer is structurally honest but still empty.
   Correction direction: land one measured onboarding asset first, even if narrow and lane-specific.
   Why it matters: without one filled proof asset, the adoption loop still depends on narrative rather than evidence.

5. `docs/case-studies/failure-mode-runtime-mismatch.md`, `docs/support/phase-7-support-ops.md`
   Problem: failure honesty is promised, but the repo still lacks a filled public failure-case example.
   Correction direction: add one sanitized real or rehearsal-grade failure asset showing doctor, bundle safety, and issue routing.
   Why it matters: "what happens when it fails" is part of the product promise, not just support operations.

6. `README.md`, `docs/workflows/install-guide.md`, `docs/workflows/phase-4-quickstart.md`
   Problem: public onboarding commands are split between `npm run pairslash -- ...` and direct `node packages/tools/cli/src/bin/pairslash.js ...`.
   Correction direction: standardize the public command surface or explicitly explain why one path is repo-user-facing and the other is maintainer-facing.
   Why it matters: command drift undermines first-run confidence.

7. `docs/phase-9/README.md`
   Problem: the page is serving as a public docs index while still sounding like a phase coordination artifact.
   Correction direction: either strip the phase-planning tone from the public index or move internal summaries and guardrail docs out of the public entry surface.
   Why it matters: the public docs landing page should answer user tasks, not expose the internal planning layer.

8. `docs/phase-9/contributor-model.md`, `CONTRIBUTING.md`
   Problem: contributor guidance is split between an active public guide and a narrower internal alignment page.
   Correction direction: make `CONTRIBUTING.md` the clear contributor entrypoint and reduce `contributor-model.md` to a short boundary/ownership note or remove it from public navigation.
   Why it matters: OSS contribution should feel simple before it feels governed.

9. `docs/maintainers/README.md`, `docs/support/triage-playbook.md`, `docs/phase-9/maintainer-playbook.md`
   Problem: maintainers have enough material, but not one clearly dominant daily-use page.
   Correction direction: define one operational hub and treat the other pages as reference/context.
   Why it matters: during a bad report, maintainers should not need to choose between overlapping playbooks.

10. `docs/phase-9/`
    Problem: public-facing pages, planning summaries, and implementation summaries all live side by side.
    Correction direction: split public narrative pages from internal Phase 9 coordination docs, or at minimum keep only the true public pages in the visible Phase 9 index.
    Why it matters: outsiders should meet a product surface, not a release-program workspace.

# Risks / Bugs / Drift

## Where The Docs Still Sound Like A Framework

- `docs/phase-9/README.md` opens as "This directory defines the public Phase 9 narrative" rather than answering a user task.
- `docs/phase-9/examples-and-benchmarks.md` is strong product strategy, but it still reads like a proof-program design memo instead of a public proof entrypoint.
- `docs/phase-9/contributor-model.md` is framed around alignment sources and surfaces rather than contributor outcomes.
- Several pages keep "Phase 9", "active-draft", "baseline source", and similar program-management markers in view. That is useful internally, but public docs should not depend on a phase taxonomy to make sense.
- `examples/README.md` and `docs/benchmarks/README.md` emphasize classification, registry, and measurement slots before they show a user anything runnable or demonstrable.

## Where User Confidence Will Still Collapse

- A user who asks "show me proof" still lands on `not-measured` placeholders.
- A user who clicks "examples" can hit ownership confusion between `examples/` and `docs/examples/`.
- A user who copies commands from one page and then another can hit command-surface inconsistency between `npm run pairslash -- ...` and direct CLI-path commands.
- A user who reaches the failure path still has to infer which issue template is correct unless they already understand the issue taxonomy.
- A user who lands in `docs/phase-9/` encounters planning and coordination language mixed with user-facing material.
- A user on Copilot or Windows still sees an honest but fragile path; the docs do not overclaim, but they also do not yet provide enough filled proof to offset the caveats.

## Top 10 Final Fixes Before Calling Phase 9 Draft-Ready

This section is intentionally duplicated as the execution list above and should
be treated as the final gate list:

1. Fix the public support entrypoint.
2. Make the GitHub issue chooser explicit.
3. Resolve canonical examples-path ownership.
4. Land one measured onboarding proof asset.
5. Land one filled failure-case proof asset.
6. Normalize the public command surface.
7. De-internalize the public Phase 9 docs index.
8. Collapse contributor guidance to one clear entrypoint.
9. Collapse maintainer guidance to one daily-use hub.
10. Separate public Phase 9 docs from planning artifacts.

# Acceptance Checklist

- [x] The review scores the overall adoption loop.
- [x] The review answers all 8 required review questions.
- [x] The review includes the table `Strong surfaces / weak surfaces / misleading surfaces`.
- [x] The review includes the table `Overclaim risk audit`.
- [x] The review includes the section `Where the docs still sound like a framework`.
- [x] The review includes the section `Where user confidence will still collapse`.
- [x] The review includes the section `Top 10 final fixes before calling Phase 9 draft-ready`.
- [x] Every major finding is grounded in repo paths rather than opinion alone.
- [x] Overclaim findings are tied back to compatibility, shipped scope, validation, workflow, or pack-manifest truth.

# Next Handoff

Final adoption-loop verdict: `not ready`

First 3 fixes to execute next:

1. Repair the public support entrypoint and issue-template routing.
2. Land one measured onboarding proof asset.
3. Resolve the examples-path and public-vs-planning path collisions.

Surfaces that should remain internal-only until evidence exists:

- `docs/phase-9/examples-and-benchmarks.md`
- `docs/phase-9/support-surfaces-summary.md`
- `docs/phase-9/phase-9-scaffold-summary.md`
- `docs/phase-9/readme-diff-summary.md`
- `docs/phase-9/proof-assets-implementation-summary.md`

