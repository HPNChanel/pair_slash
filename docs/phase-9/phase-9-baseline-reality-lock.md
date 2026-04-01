# Reality Scan

## Executive Verdict

As of April 1, 2026, PairSlash can credibly present a narrow Phase 9 public story:

- PairSlash is an OSS trust layer for terminal-native AI workflows.
- It supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- `/skills` is the canonical front door.
- Managed lifecycle commands are preview-first.
- Global Project Memory writes are explicit, previewable, audited, and reviewable.

What it cannot credibly present yet is equally important:

- it cannot claim benchmark-backed product validation or weekly-reuse proof
- it cannot claim runtime parity across lanes
- it cannot claim Windows live install support
- it cannot claim Copilot prompt-mode direct invocation works
- it cannot present the full workflow catalog as one equally mature public surface

Public adoption should lead with repo re-entry and trust, but the first defensible quickstart still starts with `pairslash-plan` because it is the bootstrap pack, the doctor-recommended first workflow, and the path directly exercised by install docs and acceptance coverage today.

Evidence basis used for this lock:

- required docs and code paths listed in the mission
- live CLI checks run on April 1, 2026
- `npm run test:acceptance` passed
- `npm run test`, `npm run sync:compat-lab -- --check`, and `npm run test:release` failed because two compat fixture snapshots are out of date

## Phase 8 Outputs Safe To Surface Publicly vs Not Ready To Surface

| Phase 8 output | Public status | Why this is the right call now |
| --- | --- | --- |
| `/skills` as the canonical entrypoint | Safe to surface | Repeated in `README.md`, runtime-mapping docs, pack manifests, doctor guidance, and docs-surface tests. |
| Preview-first managed lifecycle: `doctor`, `preview install`, `install`, `update`, `uninstall` | Safe to surface | Implemented in `packages/tools/cli`, `packages/tools/installer`, exercised in installer/CLI tests, and covered by compat acceptance. |
| `pairslash-plan` as the first quickstart workflow | Safe to surface | It is the bootstrap pack, the install-guide default, and the workflow doctor recommends first. |
| Explicit Global Project Memory write flow with preview, approval, audit log, and deterministic index update | Safe to surface with narrow wording | `packages/core/memory-engine` and CLI tests support this, but it must be described as explicit write authority, never automatic memory. |
| Local-first support path: `debug`, `trace export`, support bundle, privacy note, issue template | Safe to surface | `docs/support/phase-7-support-ops.md`, `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md`, trace code, and CLI tests all back it. |
| Compatibility semantics: `stable-tested`, `degraded`, `prep`, `known-broken` | Safe to surface with exact lane wording | Generated compatibility docs and matrix tests keep these labels synchronized and narrow. |
| Visible wedge order: `pairslash-onboard-repo` -> memory flow -> review/fix | Safe to surface as narrative order only | Phase 3.5 wedge docs support this as adoption sequencing, not as proven market outcome. |
| Full 11-pack catalog as one equally mature public surface | Not ready to surface | Release channels and risk levels vary, and the formal pack registry still lags the broader catalog. |
| `pairslash-onboard-repo` as the default first install target | Not ready to surface | It is still `canary` and is not the bootstrap install path. |
| Review/fix as autonomous coding or auto-fix | Not ready to surface | Repo truth keeps review first and fix handoff explicit. |
| Windows live install parity | Not ready to surface | Compatibility docs keep Windows in `prep`, and live local checks on April 1, 2026 reinforce that constraint. |
| Copilot prompt-mode direct invocation | Not ready to surface | Compatibility matrix marks it `known-broken`. |
| Product-validation win or weekly-reuse proof | Not ready to surface | Official benchmark evidence log is still empty under the current schema. |
| Release-ready claim for the current branch | Not ready to surface | `npm run sync:compat-lab -- --check` and `npm run test:release` currently fail on out-of-date compat artifacts. |

# Decisions

## Public Claims / Wording Allowed / Wording Forbidden

| Topic | Wording allowed | Wording forbidden |
| --- | --- | --- |
| Category | "PairSlash is the trust layer for terminal-native AI workflows." | "PairSlash is a generic agent platform/framework." |
| Runtime scope | "PairSlash supports exactly two runtimes: Codex CLI and GitHub Copilot CLI." | "PairSlash works anywhere terminal agents run." |
| Entry surface | "`/skills` is the canonical entrypoint on both supported runtimes." | "Direct invocation is an equal public path on every runtime." |
| Memory | "Global Project Memory writes are explicit, previewable, audited, and reviewable." | "PairSlash updates memory automatically in the background." |
| Installability | "Managed install/update/uninstall are preview-first and PairSlash-owned-only." | "Install support is fully uniform across all OS/runtime lanes." |
| Compatibility | "Support claims stay lane-specific: `stable-tested`, `degraded`, `prep`, or `known-broken`." | "Runtime parity is solved." |
| Evidence | "Compat-lab and acceptance provide deterministic installability evidence." | "Compat-lab proves product pull or weekly reuse." |
| Review/fix | "PairSlash keeps review explicit and fix handoff user-approved." | "PairSlash is your autonomous coding copilot." |
| Product scope | "PairSlash is narrow by design and does not add a third runtime to rescue weak evidence." | "PairSlash is a broad workflow layer for every AI product." |

## New User Journey From Landing Page -> Install -> First Workflow -> Support Path

| Stage | What the user should see | Exact CTA | Support-evidence boundary |
| --- | --- | --- | --- |
| Landing page | Repo re-entry first, trust second: get back into a repo faster and keep AI workflows safe enough to trust. | "See how `/skills` works on Codex CLI and GitHub Copilot CLI." | Do not claim benchmark victory; do claim the trust-layer posture and exact runtime scope. |
| Install | One defensible first-run path: doctor first, preview first, apply second. | `pairslash doctor` -> `pairslash preview install pairslash-plan` -> `pairslash install pairslash-plan --apply --yes` | Public docs must preserve lane caveats: macOS Codex strongest, Linux Copilot degraded, Windows prep-only. |
| First workflow | Start from `/skills`, select `pairslash-plan`, and ask for a repo-grounded plan. | "Create a repo plan from the current repo state." | This is the defensible bootstrap path because it is the installed default and doctor guidance today. |
| Visible wedge after first success | Show repo re-entry first, then memory trust, then review/fix. | `pairslash-onboard-repo` -> `pairslash-memory-candidate` -> `pairslash-memory-write-global` -> `pairslash-review` | Present this as the OSS adoption wedge order, not as already-proven market evidence. |
| Support path | When setup or runtime behavior fails, capture local evidence before filing. | `pairslash doctor` -> `pairslash debug --bundle` or `pairslash trace export --support-bundle` -> `.github/ISSUE_TEMPLATE/pairslash-support-bundle.md` | Support remains local-first, explicit, and redaction-aware. |

## Visible OSS Adoption Wedge

- Wedge 1 should be repo re-entry: `pairslash-onboard-repo`.
- Wedge 2 should be the trust-memory moat: `pairslash-memory-candidate -> pairslash-memory-write-global`.
- Wedge 3 should be explicit recurring utility: `pairslash-review` plus explicit fix handoff.
- Quickstart and first-run docs should still start with `pairslash-plan` until onboarding becomes the bootstrap path and has benchmark-backed public proof.

# File/Path Plan

## Repo Paths Recommended For Phase 9 Artifacts

| Artifact surface | Recommended canonical home | Decision | Notes |
| --- | --- | --- | --- |
| Docs site content | `docs/site/` | Create as the public-site root | Keep `README.md` as the short repo gateway, not the full site. |
| Onboarding docs | `docs/site/getting-started/` | Create as the first-user docs home | Seed from `docs/workflows/install-guide.md`, `docs/workflows/phase-4-quickstart.md`, and compatibility docs. |
| Examples | `docs/examples/` | Keep as the examples home | Existing examples are docs-oriented and should stay separate from regression truth. |
| Benchmark evidence | `docs/evidence/benchmarks/` | Create as the public proof home | Keep `packages/tools/compat-lab/` for regression and deterministic lab artifacts only. |
| Live runtime proof | `docs/evidence/live-runtime/` | Create as the lane-proof home | Store sanitized `/skills` captures and exact runtime/OS/version notes here. |
| Issue templates | `.github/ISSUE_TEMPLATE/` | Keep as canonical | Extend the existing support-bundle template rather than moving support intake into docs. |
| Contributor docs | `docs/contributing/` plus root `CONTRIBUTING.md` | Create as canonical contributor guidance | The repo currently has no contributor entrypoint file. |
| Maintainer playbooks | `docs/maintainers/` | Create as canonical maintainer ops home | Consolidate current ops knowledge now split across `docs/support/`, `docs/troubleshooting/`, `docs/releases/`, and workflow files. |

## Before/After Proof Assets That Are Missing

| Missing asset | Current gap | Recommended home | Why Phase 9 needs it |
| --- | --- | --- | --- |
| Repo re-entry before/after proof against raw CLI | `docs/phase-3.5/messaging/before-after-cases.md` is narrative, not benchmark proof | `docs/evidence/benchmarks/onboarding/` | This should become the first public proof asset. |
| Memory happy-path proof bundle | Tests and docs exist, but no public-facing sanitized before/after artifact does | `docs/evidence/benchmarks/memory-happy-path/` | Required before broad trust-memory claims expand. |
| Memory rejection proof bundle | Guardrail logic exists, but no public proof asset shows the rejection value | `docs/evidence/benchmarks/memory-rejection/` | Critical to prove that the guardrail is product value, not friction. |
| Live `/skills` capture on the strongest lane | Runtime-verification docs require live evidence, but no public sanitized capture is checked in | `docs/evidence/live-runtime/codex-macos/` | Needed to substantiate the strongest public install/use claim. |
| Live `/skills` capture on the degraded Copilot lane | Public docs describe the lane, but no public bounded live evidence is checked in | `docs/evidence/live-runtime/copilot-linux/` | Needed before broadening Copilot confidence language. |
| Review/fix before/after proof | Review/fix is still mostly narrative and example-driven | `docs/evidence/benchmarks/review-fix/` | Needed before marketing recurring utility strongly. |
| Support-bundle walkthrough | Support docs and templates exist, but there is no sanitized shareable example bundle walkthrough | `docs/evidence/support/` | Needed so public support docs feel concrete and trustworthy. |

# Risks / Bugs / Drift

## What Phase 9 Must Not Accidentally Overclaim

- Do not treat compat-lab, acceptance lanes, or goldens as proof that users will come back next week.
- Do not market Windows as a live install-supported lane.
- Do not market Copilot prompt-mode direct invocation as working.
- Do not market review/fix as autonomous editing.
- Do not market Global Project Memory as background or automatic.
- Do not market the full workflow catalog as one equally mature public surface.
- Do not repeat "release-ready" language while the current branch still has out-of-date compat artifacts.

## Current Repo Bugs / Drift That Public Docs Must Respect

- `npm run test:acceptance` passed on April 1, 2026 for `macos`, `linux`, and `windows-prep` lanes. That is deterministic installability coverage, not product-validation proof.
- `npm run test` failed on April 1, 2026 because `packages/tools/compat-lab/tests/compat-lab.test.js` detected two out-of-date fixture snapshots:
  - `packages/tools/compat-lab/goldens/fixture-snapshot.repo-monorepo-workspaces.json`
  - `packages/tools/compat-lab/goldens/fixture-snapshot.repo-conflict-existing-runtime.json`
- `npm run sync:compat-lab -- --check` failed on April 1, 2026 on the same two out-of-date artifacts.
- `npm run test:release` failed on April 1, 2026 on the same out-of-date compat artifacts, so current branch release-readiness should not be implied in public copy.
- Live `pairslash doctor --runtime codex --target repo --format json` on the current Windows machine showed two truths at once:
  - the lane is still `prep`
  - install can still be blocked by unmanaged `.agents/skills` collisions in a real repo
- Live `pairslash preview install pairslash-plan --runtime copilot --target user --format json` on the current Windows machine was blocked because `gh` was unavailable locally. That reinforces that public Copilot claims must stay evidence-bound and lane-specific.
- The public workflow catalog currently drifts from the formal registry:
  - `README.md` and pack manifests expose 11 active workflows
  - `packages/core/spec-core/registry/packs.yaml` still formalizes only 5 older registry-backed packs
  - Phase 9 should not use the registry as the public catalog source until that drift is resolved
- `docs/examples/` is explicitly documentation-oriented and non-authoritative. `packages/tools/compat-lab/` remains regression truth, not user-facing proof.
- Official product-validation evidence is still absent: `docs/validation/phase-3-5/evidence-log.md` records no official benchmark runs under the current method.

## Top 7 Documentation/Productization Traps

1. Turning repo re-entry into a generic repo-summary promise and losing the trust-layer differentiation.
2. Confusing the bootstrap workflow (`pairslash-plan`) with the visible adoption wedge (`pairslash-onboard-repo` first).
3. Using compat-lab passes and acceptance lanes as if they proved product demand or weekly reuse.
4. Advertising Windows parity or Copilot direct invocation because the code has runtime bindings for them.
5. Leading with the full workflow catalog instead of a narrow first-user path and exact lane caveats.
6. Letting review/fix messaging drift into "autonomous coding agent" territory.
7. Publishing polished public docs while branch-level generated compatibility artifacts are visibly out of sync.

# Acceptance Checklist

- Public-facing copy stays inside the trust-layer, two-runtime, `/skills`-first frame.
- Getting-started docs use the defensible first-run flow: `doctor -> preview install -> install --apply -> /skills -> pairslash-plan`.
- Compatibility copy uses exact support labels and preserves `known-broken`, `degraded`, and `prep` caveats.
- Examples are presented as docs-oriented examples, not as benchmark or live runtime proof.
- Compat-lab artifacts are presented as regression truth, not as adoption proof.
- Public workflow docs visually distinguish bootstrap/default from canary/high-risk or broader utility surfaces.
- Windows and Copilot prompt-mode caveats remain explicit anywhere installability is discussed.
- Phase 9 content plans include homes for public proof assets before any stronger market claim is introduced.
- Contributor and maintainer docs get canonical homes instead of remaining scattered across ops notes and release docs.

# Next Handoff

## First Three OSS Adoption Assets

| Priority | Asset | Why it comes first | Canonical home |
| --- | --- | --- | --- |
| 1 | Landing hero plus category page | This sets the public claim boundary before any deeper docs are written. | `docs/site/` |
| 2 | Supported-lane getting-started guide | This turns the defensible first-run journey into a repeatable OSS onboarding path. | `docs/site/getting-started/` |
| 3 | Benchmark-backed repo re-entry proof asset | This is the first before/after proof most likely to support adoption without overclaiming. | `docs/evidence/benchmarks/onboarding/` |

## Phase 9 Execution Order

1. Lock the public claim surface first: hero copy, category line, supported runtimes, `/skills`, and exact caveats.
2. Ship the supported-lane getting-started flow around `pairslash-plan`, not the whole workflow catalog.
3. Publish a narrow compatibility and support page that makes `stable-tested`, `degraded`, `prep`, and `known-broken` legible to first-time users.
4. Build the repo re-entry proof asset before broadening any claim about repeated use.
5. Add the memory happy-path and memory rejection proof assets before expanding trust-memory marketing.
6. Split contributor docs and maintainer playbooks into their canonical homes so the public site is not forced to carry operator-only detail.
7. Only after proof assets exist should Phase 9 broaden the visible workflow surface beyond the narrow wedge order of repo re-entry, memory trust, and explicit review/fix.
