---
title: Phase 9 Bug And Drift Review
phase: 9
status: review
owner_file: docs/phase-9/phase-9-bug-and-drift-review.md
source_scope:
  - README.md
  - docs/phase-9/**
  - examples/**
  - docs/benchmarks/**
  - docs/case-studies/**
  - CONTRIBUTING.md
  - .github/ISSUE_TEMPLATE/**
  - docs/support/**
cross_checks:
  - docs/compatibility/**
  - docs/releases/**
  - docs/validation/**
  - docs/workflows/**
  - packs/core/**
---

# Reality Scan

Phase 9 surfaces were reviewed against runtime truth, shipped scope, support evidence, and actual command/path surfaces.

Checks run:

- Markdown link check across scoped docs: `FILES_SCANNED=37`, `LINKS_SCANNED=85`, `BROKEN=0`.
- Command extraction check across scoped docs (`npm run pairslash -- ...` and `node packages/tools/cli/src/bin/pairslash.js ...`): `COMMAND_LINES=78`, `FLAGGED=0` unknown command shapes.
- Path naming check for accidental `packages/cli` drift: no hits in reviewed surfaces.

Low-risk fixes were applied in this pass where correctness was unambiguous:

- Public support intake routing now points to matching issue template lanes (not only support-bundle).
- Runtime wording tightened in README lane notes (`stable-tested` / `degraded` phrasing).
- Taxonomy and maintainer docs updated to reflect the actual template set already present.
- Workflow/support docs now include explicit command-surface equivalence (`node ...pairslash.js` vs `npm run pairslash -- ...`).
- Contributor issue-routing references are now clickable links.

# Decisions

## Severity-Ranked Bug List

| Severity | Status | Finding | Evidence | Impact | Decision |
| --- | --- | --- | --- | --- | --- |
| `s1` | Open | `docs/examples/README.md` is a public entrypoint but still points to starter examples and proof placeholders rather than measured evidence. | `docs/examples/README.md` | First-run users can hit an examples surface that does not yet feel evidence-backed, which weakens trust in adoption proof. | Keep open; requires measured examples or clearer evidence boundaries. |
| `s2` | Fixed | Public failure path pointed to one support-bundle template instead of issue-type lanes. | `README.md`, `docs/phase-9/onboarding-path.md`, `docs/phase-9/README.md` | Could misroute reports and make support feel inaccurate. | Patched to explicit template lanes plus artifact-heavy fallback. |
| `s2` | Fixed | Phase 9 taxonomy still claimed only one issue template existed and treated forms as future state. | `docs/phase-9/issue-taxonomy.md` | Support model drifted from repo reality. | Patched to current template set and routing model. |
| `s2` | Fixed | Maintainer playbook referenced a single bug intake template only. | `docs/phase-9/maintainer-playbook.md` | Triage handoff model looked narrower than implemented intake. | Patched to chooser + artifact-heavy template. |
| `s2` | Open | Planning docs still reference future homes not present (`docs/evidence/*`, `docs/site/getting-started`, `docs/contributing`). | `docs/phase-9/examples-and-benchmarks.md`, `docs/phase-9/phase-9-baseline-reality-lock.md`, `docs/phase-9/phase-9-scaffold-summary.md` | Maintainers can mistake roadmap paths for active locations. | Keep open; strategic path move required. |
| `s2` | Fixed | Public wedge wording did not consistently mark canary workflows when promoted after first success. | `README.md`, `docs/phase-9/onboarding-path.md`, `docs/phase-9/README.md`, `docs/phase-9/oss-positioning.md`, `packs/core/pairslash-onboard-repo/pack.manifest.yaml` | Risked implying broader maturity than manifest channel indicates. | Patched to keep `canary` explicit where promoted. |
| `s3` | Fixed | Contributor template routing in `CONTRIBUTING.md` used bare filenames, not links. | `CONTRIBUTING.md` | Minor friction for newcomer reporting path. | Patched with direct links. |
| `s3` | Open | `.github/ISSUE_TEMPLATE/config.yml` uses repo/branch-specific absolute links (`main`) for contact docs. | `.github/ISSUE_TEMPLATE/config.yml` | Forks or non-main maintenance branches may route to upstream docs. | Keep open; needs durable docs URL strategy. |

## Drift List: Docs Vs Repo Truth

| Drift item | Current state | Repo truth | Status |
| --- | --- | --- | --- |
| Issue intake model in public docs | Now lane-based plus artifact-heavy fallback | Template set exists for install/runtime/workflow/memory/pack/docs + support bundle | Fixed |
| Taxonomy template model | Now reflects implemented templates | `.github/ISSUE_TEMPLATE/*` includes both markdown and form lanes | Fixed |
| Runtime lane wording in README start table | Now anchored to lane labels (`stable-tested`, `degraded`) | Compatibility matrix is lane-specific | Fixed |
| Command-surface guidance | Public and workflow/support docs now state equivalence for repo-local usage | CLI entrypoint exists both as `npm run pairslash --` and direct script path | Partially fixed |
| Example home ownership | `docs/examples/README.md` is still mostly an index to starter examples and case-study placeholders | `docs/examples/` holds the canonical examples home | Open |
| Planned future docs homes | Several Phase 9 planning docs reference paths not created | Current repo has `docs/phase-9`, `docs/benchmarks`, `docs/case-studies`, `examples` | Open |

## Drift List: Docs Vs Support-Evidence Truth

| Drift item | Current state | Evidence truth | Status |
| --- | --- | --- | --- |
| Support labels in public docs | Uses `stable-tested`, `degraded`, `prep`, `known-broken` | Compatibility matrix defines exactly these public labels | Aligned |
| Copilot prompt-mode wording | Marked `known-broken`; `/skills` kept canonical | Compatibility matrix known issue K1 | Aligned |
| Windows support wording | Kept as `prep`, no live parity claim | Compatibility matrix + runtime verification constraints | Aligned |
| Canary workflow promotion | Now explicitly marked `canary` where promoted in Phase 9 public path | Pack manifests mark `pairslash-onboard-repo` and `pairslash-review` as canary | Aligned after patch |
| Public proof claims | Case-study/benchmark assets remain `not-measured` placeholders | Evidence log still lacks official measured wedge runs | Aligned but still weak proof posture |

## Link-Check And Path-Check Summary

| Check | Result | Notes |
| --- | --- | --- |
| Markdown link validity | Pass (`BROKEN=0`) | No broken local markdown links in reviewed scope. |
| Command existence shape | Pass (`FLAGGED=0`) | No unknown CLI command shapes in extracted command lines. |
| Path naming drift (`packages/cli`) | Pass | No accidental rename drift detected in reviewed surfaces. |
| Planned-path existence | Fail (expected roadmap gap) | `docs/evidence/*`, `docs/site/getting-started`, and `docs/contributing` are referenced in planning docs but not created. |

# File/Path Plan

Patched in this review pass:

- `README.md`
- `docs/phase-9/onboarding-path.md`
- `docs/phase-9/README.md`
- `docs/phase-9/issue-taxonomy.md`
- `docs/phase-9/maintainer-playbook.md`
- `docs/phase-9/oss-positioning.md`
- `docs/workflows/install-guide.md`
- `docs/workflows/phase-4-quickstart.md`
- `docs/workflows/phase-4-doctor-troubleshooting.md`
- `docs/support/phase-7-support-ops.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/config.yml`

Open path ownership decisions needed:

- Canonical examples home: `docs/examples/` is now canonical, but the proof story is still placeholder-heavy.
- Public proof home path: whether to create `docs/evidence/*` now or remove from active wording.
- Public-vs-internal Phase 9 split inside `docs/phase-9/`.

# Risks / Bugs / Drift

## Fast Fixes

These are already applied:

1. Switched public support intake language from single-template routing to lane-specific template routing.
2. Updated taxonomy/playbook language that drifted behind implemented issue templates.
3. Tightened runtime support wording in README lane notes to matrix labels.
4. Marked canary workflow maturity where wedge workflows are promoted.
5. Added direct links to issue templates in `CONTRIBUTING.md`.
6. Added command-equivalence notes where command-surface inconsistency was causing confusion.

## Risky Fixes

These should not be patched blindly:

1. Canonicalize `examples/` vs `docs/examples/` ownership.
Reason: requires product/docs IA decision and likely moves/redirect strategy.
2. Split public narrative docs from internal Phase 9 coordination docs in `docs/phase-9/`.
Reason: may break current maintainer references and handoff flows if done ad hoc.
3. Introduce `docs/evidence/*` and related planned path tree now.
Reason: path creation without asset population may increase empty-surface drift.
4. Replace repo/branch-specific issue-template contact links with durable docs URLs.
Reason: depends on long-lived docs host or policy for branch/fork behavior.

## Safe To Defer

1. Template automation for mandatory labels (`surface:*`, `type:*`, `lane:*`, `severity:*`, `status:*`).
2. Measured proof assets replacing `not-measured` placeholders.
3. Maintainer query/view automation for triage state management.
4. Full public docs-site nav implementation beyond current README + Phase 9 docs surfaces.

# Acceptance Checklist

- [x] Severity-ranked bug list included.
- [x] Drift list for docs vs repo truth included.
- [x] Drift list for docs vs support-evidence truth included.
- [x] Link-check and path-check summary included.
- [x] `fast fixes`, `risky fixes`, and `safe to defer` sections included.
- [x] Trivial, clearly-correct fixes were patched directly in repo.
- [x] Strategic/risky changes were left as explicit review items with rationale.

# Next Handoff

Recommended next 3 actions:

1. Keep `docs/examples/` as the canonical examples home and fill it with measured proof or clearer starter-only framing.
2. Decide whether `docs/evidence/*` and `docs/site/getting-started` are being created now; if not, downgrade references from active docs to roadmap notes.
3. Separate public Phase 9 pages from internal planning/status artifacts so outsider navigation does not mix product docs with execution logs.
