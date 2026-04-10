# PairSlash Runtime Verification

Use this runbook when you are collecting manual live evidence for the public
compatibility matrix. Compat-lab automation is deterministic and release-gating,
but it does not replace live `/skills` verification.

Canonical lane records live under `docs/evidence/live-runtime/`.
Each lane record must separate deterministic evidence, fake/shim evidence, and
live evidence before the matrix is updated.
Each lane also needs a YAML sidecar with freshness, required evidence class,
host profile count, and negative evidence when present.

Do not use this page as the install guide. Start with
`docs/workflows/install-guide.md`.

If a live verification step fails and you need support, use `docs/reporting.md`
and capture a local support bundle before sharing anything externally.

Live runtime verification can widen support truth only.
It does not publish any `@pairslash/*` package, change `NOTICE` requirements,
or alter the repo-local packaging boundary recorded in
`docs/releases/legal-packaging-status.md`.
It also does not assign workflow maturity on its own; workflow maturity remains
governed by `docs/architecture/phase-18-workflow-maturity-charter.md`.

## A. Live Verification Philosophy

- `Verified`: the matrix and lane sidecars already separate deterministic,
  fake/shim, and live evidence.
- `Verified`: `/skills` is the canonical front door for both supported runtimes.
- `Verified`: `live_smoke` is real-host evidence only, but it does not justify
  `preview` or `stable-tested`.
- `Verified`: one-off proof is not enough for `stable-tested`.
- `Missing`: a live run is not valid unless it records host profile, runtime
  version, exact command capture, artifact paths, and a write-back into the
  exact lane sidecar.

What counts as `live_smoke`:

- Real-host runtime availability checks.
- `doctor` on the exact runtime, target, and OS lane.
- `preview install` on the exact runtime, target, and OS lane.
- Explicit blocked or failed install behavior on a real host.
- Partial direct-invocation behavior that does not include canonical `/skills`.

What counts as `live_verification`:

- Real-host managed install apply on the exact lane.
- Canonical `/skills` listing capture on the exact lane.
- `pairslash-plan` executed through `/skills`.
- `pairslash-memory-write-global` executed through `/skills` with visible
  preview-before-write and explicit confirmation boundary.
- Evidence written back into the exact lane registry files.

What counts as `repeated_live_verification`:

- Two or more `live_verification` runs.
- Distinct host profiles.
- Distinct run dates.
- Both runs still fresh under current matrix freshness rules.

Manual run vs scripted run boundary:

- Scripted steps are allowed for host profile capture, runtime version capture,
  `doctor`, `preview install`, and `install --apply --yes`.
- Manual observation is still required for canonical `/skills` listing,
  workflow selection from `/skills`, workflow response capture, and
  `pairslash-memory-write-global` preview-gate observation.
- Do not substitute compat-lab, fake runtimes, shim acceptance, or `codex exec`
  for canonical picker proof.

## B. Runbook - Codex CLI

Lane default for public support work today: `codex_cli` / `repo`.

### Preconditions

- Real Codex CLI host, not compat-lab shims.
- Repo root is the current working directory.
- Target lane and current support label are confirmed in
  `docs/compatibility/compatibility-matrix.md`.
- Install root and config home are writable for the selected target.

### Host profile capture

Record at minimum:

- host profile id
- OS
- shell
- runtime executable path
- runtime version
- target
- config home
- install root

### Required commands

Run and capture artifacts for:

```bash
npm run pairslash -- doctor --runtime codex --target repo --format json
npm run pairslash -- preview install pairslash-plan --runtime codex --target repo --format json
npm run pairslash -- install pairslash-plan --runtime codex --target repo --apply --yes
```

### Canonical entrypoint verification

After install apply:

1. Launch Codex CLI from repo root.
2. Open `/skills`.
3. Capture evidence that `pairslash-plan` is visible in the canonical picker.
4. Run `pairslash-plan` through `/skills`.
5. Ask for a repo plan and capture the visible response.
6. Run `pairslash-memory-write-global` through `/skills`.
7. Capture evidence that preview appears before any write and that explicit
   confirmation is required.
8. Confirm rejected or blocked previews do not silently fall back.

### Expected outputs

- `doctor` returns a machine-readable `doctor-report`.
- `preview install` returns a machine-readable preview plan or explicit block.
- `install --apply --yes` completes without hidden writes outside PairSlash
  ownership.
- `/skills` shows PairSlash workflows on the exact lane.
- `pairslash-plan` behaves as a read-oriented workflow.
- `pairslash-memory-write-global` preserves preview-first write authority.

### Optional direct invocation verification

- Direct invocation may be recorded only as supplemental evidence for a
  documented Codex surface.
- Direct invocation never substitutes for canonical `/skills` proof.
- `codex exec` is capped at `live_smoke` because it cannot prove the
  interactive picker.

### Expected failure classes

- `runtime_unavailable`
- `canonical_picker_missing`
- `pack_not_visible`
- `install_fail`
- `workflow_fail`
- `direct_invocation_fail`

### Evidence minimum bar

- Repo target: install apply, canonical picker, workflow execution, and
  memory-write preview gate.
- Pack capability: `pairslash-plan` proves read path; `pairslash-memory-write-global`
  proves preview-first write authority.
- Canonical picker: required for any promotion above `degraded`.
- Direct invocation: optional supplement only.

## C. Runbook - GitHub Copilot CLI

Lane default for public support work today: `copilot_cli` / `user`.

### Preconditions

- Real GitHub CLI host, not compat-lab shims.
- `gh` is installed and usable on the target machine.
- Copilot CLI surface is available through `gh`.
- Repo root is the current working directory.
- Target lane and current support label are confirmed in
  `docs/compatibility/compatibility-matrix.md`.

### Host profile capture

Record at minimum:

- host profile id
- OS
- shell
- runtime executable path
- runtime version
- target
- config home
- install root

### Required tool presence

Capture:

```bash
gh --version
gh copilot --help
```

If either command fails, record negative evidence and stop promotion work for
that lane.

### Required commands

Run and capture artifacts for:

```bash
npm run pairslash -- doctor --runtime copilot --target user --format json
npm run pairslash -- preview install pairslash-plan --runtime copilot --target user --format json
npm run pairslash -- install pairslash-plan --runtime copilot --target user --apply --yes
```

### Canonical entrypoint verification

After install apply:

1. Launch GitHub Copilot CLI from repo root.
2. Open `/skills`.
3. Capture evidence that `pairslash-plan` is visible in the canonical picker.
4. Run `pairslash-plan` through `/skills`.
5. Ask for a repo plan and capture the visible response.
6. Run `pairslash-memory-write-global` through `/skills`.
7. Capture evidence that preview appears before any write and that explicit
   confirmation is required.
8. Confirm rejected or blocked previews do not silently fall back.

### Expected outputs

- `gh --version` and `gh copilot --help` both succeed.
- `doctor` returns a machine-readable `doctor-report`.
- `preview install` returns a machine-readable preview plan or explicit block.
- `install --apply --yes` completes into the Copilot install root for the
  exact target.
- `/skills` shows PairSlash workflows on the exact lane.
- `pairslash-plan` and `pairslash-memory-write-global` both work through the
  canonical picker path.

### Direct invocation policy

- Copilot prompt-mode direct invocation remains blocked for public support.
- Do not record prompt-mode direct invocation as a support-promotion artifact.
- If only prompt-mode behavior is observed, the lane does not move beyond its
  current support label.

### Expected failure classes

- `runtime_unavailable`
- `gh_unavailable`
- `canonical_picker_missing`
- `pack_not_visible`
- `preview_fail`
- `install_fail`
- `workflow_fail`

### Evidence minimum bar

- User target: `gh` presence, install apply, canonical picker, workflow
  execution, and memory-write preview gate.
- Canonical picker: required for any lane promotion.
- Direct invocation: blocked.

## D. Artifact Checklist

Each live run must capture:

- lane id
- evidence id
- host profile id
- OS and shell
- runtime executable path and runtime version
- target
- config home and install root
- exact command strings
- entrypoint path used
- verdict
- `doctor-report` path
- preview plan or transcript path
- install apply transcript path
- canonical `/skills` capture
- workflow transcript
- related negative evidence, if any

Write artifacts back into:

- `docs/evidence/live-runtime/<lane>.md`
- `docs/evidence/live-runtime/<lane>.yaml`
- `docs/compatibility/runtime-surface-matrix.yaml`
- `docs/compatibility/compatibility-matrix.md`

## E. Verdict Assignment Rules

- Assign `live_smoke` only when the run is real-host but lacks canonical
  end-to-end `/skills` proof.
- Assign `live_verification` only when the exact lane has managed install apply,
  canonical `/skills`, workflow execution, and memory-write preview-gate proof.
- Assign `repeated_live_verification` only when two or more fresh
  `live_verification` runs exist on distinct host profiles and distinct dates.
- Keep `degraded` when real evidence exists but canonical `/skills` is missing,
  partial, or caveated.
- Keep `prep` when only deterministic coverage or smoke exists.
- Use negative live records when a real-host failure blocks the exact lane or
  documented surface.

## F. Recertification Cadence

- Re-run live verification before a release cut that widens or reaffirms public
  support wording.
- Re-run after runtime version changes, installer changes, runtime-mapping
  changes, or a negative live record on the same lane.
- Treat stale evidence as recertification-required.
- Treat expired evidence as insufficient for public promotion until refreshed.
- Do not treat one successful local run as permanent support proof.

## G. Windows/Copilot Promotion Gate

- Windows stays `prep` until a real Windows host records install apply,
  canonical `/skills`, and workflow execution on the exact lane.
- Windows `doctor` and `preview install` are useful smoke only. They are not
  enough for promotion.
- Copilot cannot promote without checked-in `gh` availability proof,
  canonical picker proof, and exact runtime-path proof.
- If only Codex evidence exists, write support truth as Codex-only lane support.
  Do not widen Copilot wording by analogy.

## H. Failure And Rollback Communication Template

Use this when a live run fails or a lane must be demoted:

```md
Live Verification Failure

- Lane:
- Evidence ID:
- Runtime:
- Runtime version:
- Target:
- OS / shell:
- Host profile ID:
- Entrypoint used:
- Command:
- Expected:
- Actual:
- Verdict:
- Failure type:
- Artifact paths:
- Matrix impact:
- Rollback note:
```

Escalation commands:

```bash
npm run pairslash -- debug --latest --runtime <codex|copilot> --bundle --format text
npm run pairslash -- trace export --session <session-id> --runtime <codex|copilot> --support-bundle --include-doctor --format text
```

Review `privacy-note.txt` and `bundle-manifest.json` before attaching anything
outside the machine.
