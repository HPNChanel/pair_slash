---
title: Examples And Benchmarks
phase: 9
status: draft
owner_file: docs/phase-9/examples-and-benchmarks.md
baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md
---

# Reality Scan

## Executive Verdict

Phase 9 proof should start with narrow, repeatable wedge evidence instead of
feature-tour evidence.

Public proof should lead with:

- cold repo re-entry against a raw CLI baseline
- explicit trust-memory proof on the strongest supported lane
- one honest failure-mode asset that shows PairSlash blocking or degrading
  correctly

Public proof should not lead with:

- installability-only wins
- compat-lab fixture breadth
- cross-runtime parity claims
- generic coding benchmark claims

Current repo truth forces a narrow proof posture:

- `docs/validation/phase-3-5/evidence-log.md` still records no official
  product-validation benchmark runs under the active schema
- `docs/validation/phase-3-5/benchmark-tasks.md` defines only three official
  wedge benchmarks: onboarding, memory flow, and review/fix loop
- `docs/compatibility/compatibility-matrix.md` keeps public support
  lane-specific: `stable-tested`, `degraded`, `prep`, and `known-broken`
- `docs/examples/` is explicitly documentation-oriented and non-authoritative
- `packages/tools/compat-lab/` is deterministic regression truth, not public
  proof of user value

That means Phase 9 should publish example repos and proof assets that help a
first-time user believe the wedge story, while still treating formal benchmark
evidence as scarce and high-bar.

# Decisions

## Example Repo Archetypes

| Archetype | Canonical source in repo | Primary wedge workflow | Public role first | Why it belongs in Phase 9 |
| --- | --- | --- | --- | --- |
| Docs-heavy repo | `packages/tools/compat-lab/fixtures/repos/docs-heavy` | `pairslash-onboard-repo` | First public benchmark repo and first before/after proof | Best fit for cold repo re-entry because shallow summaries fail easily and the workflow must prove trust, not polish. |
| Monorepo workspace repo | `docs/examples/monorepo` plus `packages/tools/compat-lab/fixtures/repos/repo-monorepo-workspaces` | `pairslash-onboard-repo` | Second public example repo after the default onboarding asset | Good follow-up proof that PairSlash can orient a more complex repo shape without turning the story into broad parity. |
| Memory-authority repo | `packages/tools/compat-lab/fixtures/repos/repo-write-authority-memory` | `pairslash-memory-candidate -> pairslash-memory-write-global` | Benchmark repo, not a starter example | This is the strongest repo-native surface for preview-before-write, audit posture, and fidelity proof. |
| Runtime-conflict repo | `packages/tools/compat-lab/fixtures/repos/repo-conflict-existing-runtime` | `pairslash-plan` plus support path | Public failure-case example, not a headline benchmark | Needed so docs can show what failure honesty looks like when unmanaged runtime state blocks install or update. |
| Node service repo with pinned diff | `docs/examples/node-api` plus `packages/tools/compat-lab/fixtures/repos/node-service` | `pairslash-review` plus explicit fix handoff | Internal benchmark repo first | Useful later for recurring-utility proof, but too easy to misread as a generic coding benchmark if surfaced before wedge evidence exists. |

## Benchmark Tasks Mapped To Wedge Workflows

| Benchmark task | Wedge workflow | Repo archetype | Public status | Why this status is correct now |
| --- | --- | --- | --- | --- |
| Cold repo re-entry against raw CLI on a docs-heavy repo | `pairslash-onboard-repo` | Docs-heavy repo | Public first | This is the acquisition wedge and the clearest answer to "why install this?" without overclaiming breadth. |
| Cold repo re-entry against raw CLI on a monorepo | `pairslash-onboard-repo` | Monorepo workspace repo | Public next | Valuable second proof once the default onboarding asset exists, but it should not replace the simpler first wedge proof. |
| Memory happy path with preview/write/audit fidelity | `pairslash-memory-candidate -> pairslash-memory-write-global` | Memory-authority repo | Public after first onboarding proof lands | Strong trust-layer proof, but it should follow repo re-entry so the public story does not collapse into architecture-first messaging. |
| Memory rejection path with weak or conflicting evidence | `pairslash-memory-candidate -> pairslash-memory-write-global` | Memory-authority repo with conflict setup | Public with the memory lane | This is the honest guardrail proof that stops PairSlash from sounding like a safety theater layer. |
| Review/fix paired benchmark on a pinned diff | `pairslash-review` plus explicit fix handoff | Node service repo with pinned diff | Internal-only for now | The benchmark doctrine keeps review/fix in scope, but public emphasis here would blur PairSlash into a generic coding assistant before wedge proof exists. |
| Install, doctor, preview, and compat-lab acceptance | Managed lifecycle and support surfaces | Compat-lab fixtures and real runtime lanes | Internal-only as technical appendix | Necessary technical evidence, but explicitly excluded from official wedge proof by the validation docs. |

## Public Proof Asset Plan

| Asset type | What it must contain | Canonical home for Phase 9 | Public use |
| --- | --- | --- | --- |
| Copyable repo examples | Repo shape, supported runtime lane, first command, `/skills` workflow path, expected next step, and support caveat | `docs/examples/` | Help first-run users reproduce the wedge tasks without reading maintainer-only fixture internals. |
| Benchmark harness summaries | `paired_group_id`, runtime, repo snapshot ref, frozen success criteria, baseline method, PairSlash method, TTFS delta, rescue count, reuse answer, artifact refs, and negative evidence note | `docs/evidence/benchmarks/` | Publish compact proof summaries without pretending the harness is a marketing number generator. |
| Before/after case studies | Raw CLI baseline, PairSlash path, what changed, what stayed constrained, exact artifacts used, and the trust boundary outcome | `docs/evidence/benchmarks/` | Turn wedge evidence into outsider-readable proof without dropping the benchmark discipline. |
| Failure-case examples | One blocked or degraded install/support path and one guardrail rejection path, including `doctor` or support-bundle escalation where needed | `docs/evidence/support/` and `docs/evidence/benchmarks/` | Make docs feel honest by showing how PairSlash fails safely instead of hiding weak lanes. |

## What Counts As Credible Evidence

Credible public proof for PairSlash must satisfy the current validation method,
not a lighter demo standard.

Evidence counts as credible only when all of these are true:

- The task maps to one official wedge workflow from
  `docs/validation/phase-3-5/benchmark-tasks.md`.
- The baseline arm and PairSlash arm use the same runtime, repo snapshot,
  evaluator, and frozen success criteria.
- The raw CLI baseline does not get less repo access than PairSlash, and
  PairSlash does not get extra hints the baseline did not get.
- Required artifacts are captured for the workflow, not replaced with
  installability logs or screenshots alone.
- Negative, weak, and mixed runs are logged instead of dropped.
- Lane-specific support status stays visible. A `stable-tested` Codex claim does
  not silently broaden into a Copilot or Windows parity claim.
- Live runtime evidence remains separate from compat-lab deterministic evidence.
  Compat-lab can prove regression safety; it does not prove user value by
  itself.
- Trust-boundary behavior remains part of the proof. If preview-before-write,
  explicit acceptance, or rejection fidelity fails, the run is not a win even
  if the artifact looks polished.

## What We Refuse To Benchmark Publicly And Why

| Benchmark we refuse | Why we refuse it publicly |
| --- | --- |
| Installability-only "wins" | The active validation docs explicitly exclude install, doctor, and preview-only runs from official product proof. |
| Pack-count or workflow-breadth comparisons | PairSlash wins by solving wedge tasks, not by having a large catalog. Breadth metrics invite framework framing. |
| Cross-runtime aggregate scores that hide caveats | The compatibility matrix is lane-specific. Aggregates would flatten `stable-tested`, `degraded`, `prep`, and `known-broken` into misleading parity. |
| Toy codegen races or generic coding speed tests | They would reposition PairSlash as a vague coding agent instead of a trust layer for terminal-native workflows. |
| Review/fix benchmarks on trivial diffs | Easy tasks create fake wins and obscure whether PairSlash actually reduces almost-right cleanup burden on real review work. |
| Compat-lab fixture pass rates presented as user-value proof | Compat-lab is regression truth and release-gating support evidence, not a substitute for paired wedge benchmarks. |

## First 3 Proof Assets To Build Now

| Priority | Asset | Why it comes first | Required evidence |
| --- | --- | --- | --- |
| 1 | Docs-heavy repo onboarding before/after | Best first public answer to "why install this?" and the cleanest acquisition wedge proof | Paired raw CLI vs `pairslash-onboard-repo` run, frozen success criteria, TTFS comparison, orientation accuracy notes, and reuse answer |
| 2 | Memory happy-path proof bundle | Best first proof that PairSlash changes durable behavior instead of just improving phrasing | Candidate output, preview artifact, written record, audit-log ref, memory-index ref, and preview-to-write fidelity result |
| 3 | Memory rejection and guardrail proof bundle | Satisfies the honesty requirement by proving that PairSlash blocks weak or conflicting writes instead of smoothing them over | Weak/conflicting source refs, rejection or downgrade artifact, blocking explanation, and trust-boundary pass result |

# File/Path Plan

## Proof Asset Placement

| Surface | Recommended home | What belongs there | What does not belong there |
| --- | --- | --- | --- |
| Copyable starter examples | `docs/examples/` | Human-readable starter repos and first-run commands | Official benchmark scores or release-gating claims |
| Public benchmark summaries | `docs/evidence/benchmarks/` | Paired-run summaries, artifact indexes, and before/after proof pages | Raw compat-lab goldens or fixture internals |
| Live runtime proof | `docs/evidence/live-runtime/` | Sanitized `/skills` captures, exact runtime versions, OS, shell, and lane notes | Cross-runtime rollup claims that outrun the matrix |
| Support honesty assets | `docs/evidence/support/` | Failure-case examples, support-bundle walkthroughs, and doctor-first repro notes | Marketing copy or generic troubleshooting lists |
| Deterministic regression truth | `packages/tools/compat-lab/` | Fixtures, goldens, acceptance automation, and regression control | Public-facing claims that a user should treat as benchmark proof |

## Example Ownership Rules

- `docs/examples/README.md` should keep stating that examples are
  documentation-oriented and non-authoritative.
- `packages/tools/compat-lab/fixtures/README.md` should remain the canonical
  explanation of fixture purpose for regression and release safety.
- `docs/phase-9/examples-and-benchmarks.md` should own the public proof-layer
  decisions: which repos are starter examples, which are benchmark-only, and
  which are failure-only honesty assets.

## Implemented Entry Points

- Public examples index: `docs/examples/README.md`
- Benchmark asset index: `docs/benchmarks/README.md`
- Case-study taxonomy index: `docs/case-studies/README.md`
- First-wave asset placeholders:
  - `docs/case-studies/onboard-repo-before-after.md`
  - `docs/case-studies/memory-write-global-trust-event.md`
  - `docs/case-studies/failure-mode-runtime-mismatch.md`

# Risks / Bugs / Drift

## Top Proof-Layer Risks

1. Treating compat-lab coverage as public proof of user value.
2. Surfacing review/fix first and letting PairSlash read like a generic coding
   assistant.
3. Using monorepo or service examples to imply runtime parity beyond the
   compatibility matrix.
4. Publishing only happy-path artifacts and making support docs feel evasive.
5. Turning memory proof into architecture admiration instead of trust-behavior
   proof.
6. Letting public examples drift from the pinned benchmark tasks and frozen
   success criteria.
7. Publishing benchmark summaries without negative evidence notes or artifact
   refs.

## Current Drift The Doc Must Respect

- `docs/validation/phase-3-5/evidence-log.md` is still empty for official runs,
  so this document can plan proof assets but cannot claim benchmark victory.
- `docs/compatibility/compatibility-matrix.md` still marks:
  - Codex CLI repo on macOS as `stable-tested`
  - GitHub Copilot CLI user on Linux as `degraded`
  - Windows lanes as `prep`
  - Copilot prompt-mode direct invocation as `known-broken`
- `docs/examples/` already contains `node-api`, `rails-service`, and
  `monorepo`, but those are examples, not benchmark evidence.
- `packages/tools/compat-lab/fixtures/repos/repo-conflict-existing-runtime`
  provides a strong honesty example for blocked install/update behavior and
  should stay visible as a failure asset rather than being hidden.

# Acceptance Checklist

- The document names 3 to 5 example repo archetypes and assigns each a public
  role.
- The benchmark-task table clearly separates public-facing wedge proof from
  internal-only technical or recurring-utility benchmarks.
- The proof asset plan includes copyable examples, benchmark summaries,
  before/after case studies, and failure-case examples.
- Credible evidence rules mirror the active validation doctrine rather than a
  demo-only standard.
- The document explicitly refuses vanity benchmarks that would reframe
  PairSlash as a generic framework or coding benchmark product.
- At least one failure-mode or degraded-lane example is present in the plan.
- The first three proof assets strengthen first-run adoption instead of
  impressing maintainers only.

# Next Handoff

## Immediate Execution Sequence

1. Build the docs-heavy onboarding before/after asset on the strongest public
   lane first.
2. Build the memory happy-path proof bundle with full preview/write/audit/index
   evidence.
3. Build the memory rejection proof bundle so the guardrail story is publicly
   credible.
4. After those three exist, add the monorepo onboarding asset as the second
   copyable example.
5. Only then consider promoting a review/fix proof artifact for public use.

## Follow-On Files To Fill

- `docs/examples/README.md`
- `docs/phase-9/onboarding-path.md`
- `docs/phase-9/issue-taxonomy.md`
- future `docs/evidence/benchmarks/` summaries
- future `docs/evidence/support/` failure-case walkthroughs
