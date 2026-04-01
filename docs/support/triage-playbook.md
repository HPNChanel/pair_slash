# Reality Scan

This playbook operationalizes Phase 9 support using repository truth:

- Taxonomy source: `docs/phase-9/issue-taxonomy.md`
- Maintainer model source: `docs/phase-9/maintainer-playbook.md`
- Public support claims: `docs/compatibility/compatibility-matrix.md`
- Live support evidence: `docs/compatibility/runtime-verification.md`
- Shipped scope cap: `docs/releases/phase-5-shipped-scope.md`
- Claim cap: `docs/validation/phase-3-5/verdict.md`

PairSlash support remains local-first and evidence-aware.

# Decisions

## Triage Flow

1. Confirm the issue template and surface.
2. Capture runtime lane facts: runtime, target, OS/shell, runtime version.
3. Review first-contact evidence from `docs/support/repro-assets.md`.
4. Apply mandatory labels after first maintainer pass:
   - `surface:*`
   - `type:*`
   - `lane:*`
   - `severity:*`
   - `status:*`
5. Decide category:
   - `type:support`
   - `type:bug`
   - `type:docs-drift`
   - `type:pack-request`
   - `type:evidence-gap`
6. Request the smallest missing artifact only.
7. Route outcome: fix, docs downgrade, evidence hold, known issue, or close.

## Severity Model

| Severity | Meaning | Default action |
| --- | --- | --- |
| `severity:s0` | Trust boundary risk (hidden write, unsafe uninstall, redaction/share-safety regression) | Maintainer-only escalation |
| `severity:s1` | Default-path blocker in a claimed lane | Prioritize for active milestone |
| `severity:s2` | Recoverable defect or degraded-lane gap | Schedule with workaround and regression guard |
| `severity:s3` | Docs/request/evidence follow-up | Route to contributor-friendly queue |

## Release Hygiene And Regression Handling

- Treat lifecycle and memory regressions as release-gating until a fix or explicit downgrade is merged.
- For `severity:s0` and `severity:s1`, require deterministic regression coverage (test, fixture, or compat-lab case) before close.
- Do not promote support claims from a single green issue; promotion must follow runtime verification updates.
- If a release candidate changes installer, doctor, trace, or memory surfaces, run targeted smoke checks for both runtimes.

## Evidence Alignment Notes For Docs And Support Claims

- Public language must use only compatibility labels: `stable-tested`, `degraded`, `prep`, `known-broken`.
- Doctor output is local diagnosis, not public support promotion.
- Compat-lab is deterministic maintainer repro, not proof of broad user value.
- If docs and runtime behavior conflict, file as `type:docs-drift` first, then decide whether code is also wrong.
- If an ask exceeds proven support breadth, classify as `type:evidence-gap` and hold wording.

## When The Issue Is A Docs/Support-Claim Mismatch

Route to `type:docs-drift` when:

- README/onboarding wording overclaims lane support.
- Docs flatten nuanced states into plain "supported."
- Docs imply hidden memory behavior, autopilot behavior, or third-runtime scope.

Route to `type:evidence-gap` when:

- Reporter asks for parity that is not backed by runtime verification evidence.
- The lane is still `prep` or outside recorded runtime evidence.

# File/Path Plan

- Intake templates: `.github/ISSUE_TEMPLATE/`
- Contributor entrypoint: `CONTRIBUTING.md`
- Evidence requirements: `docs/support/repro-assets.md`
- Maintainer model source: `docs/phase-9/maintainer-playbook.md`
- Taxonomy source: `docs/phase-9/issue-taxonomy.md`
- Support operations baseline: `docs/support/phase-7-support-ops.md`

# Risks / Bugs / Drift

- Over-asking artifacts from casual users increases abandonment.
- Under-labeling issues creates triage drift and delayed ownership.
- Claim expansion without evidence causes support debt and docs churn.
- Treating compat-lab as public proof of support breadth overstates reality.

# Acceptance Checklist

- Newcomers can choose the right template without maintainer intervention.
- Maintainers can classify support vs bug vs docs drift vs evidence gap quickly.
- Severity is tied to trust and default-path impact.
- Docs/support language stays bounded by compatibility and runtime evidence.

# Next Handoff

- Add automation to apply baseline labels on issue creation.
- Add a saved maintainer query view keyed by `status:*` and `severity:*`.
- Add a periodic docs-claim audit against compatibility and runtime verification files.

