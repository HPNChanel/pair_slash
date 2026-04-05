# PairSlash Phase 4 Acceptance Checklist

This historical file path remains for continuity, but the checklist now tracks
the Phase 6 compat-lab acceptance slice that backs `npm run test:acceptance`.

## Automation baseline

- [ ] `npm run test:compat`
- [ ] `npm run test:acceptance -- --lane macos --report-out artifacts/compat-lab-acceptance-macos.json`
- [ ] `npm run test:acceptance -- --lane linux --report-out artifacts/compat-lab-acceptance-linux.json`
- [ ] `npm run test:acceptance -- --lane windows-prep --report-out artifacts/compat-lab-acceptance-windows-prep.json`

## Required scenarios

- [ ] Fresh install repo-scope reaches `/skills` readiness on the macOS Codex lane.
- [ ] Fresh install user-scope reaches `/skills` readiness on the Linux Copilot lane.
- [ ] Update preserves a valid local override on both full-apply lanes.
- [ ] Uninstall removes only PairSlash-owned assets and leaves unmanaged files untouched.
- [ ] Doctor catches a broken setup and returns a blocking verdict where appropriate.

## Metrics and artifacts

- [ ] Acceptance JSON exists for every lane.
- [ ] Each report contains `install_success`, `doctor_success`, `time_to_first_success_ms`, `issue_codes`, and `repro_key`.
- [ ] `repo-basic-readonly` remains the pilot fixture for first-success coverage while compat-lab keeps broader fixture lanes for drift and policy regressions.
- [ ] Windows prep report keeps `install_success = null` and `time_to_first_success_ms = null`.

## Docs that must line up

- [ ] `docs/workflows/phase-4-quickstart.md`
- [ ] `docs/workflows/install-guide.md`
- [ ] `docs/compatibility/compatibility-matrix.md`
- [ ] `docs/compatibility/runtime-verification.md`
- [ ] `docs/evidence/live-runtime/README.md`
- [ ] `docs/troubleshooting/compat-lab-bug-repro.md`
- [ ] `docs/runtime-mapping/pilot-acceptance.md`
- [ ] `docs/releases/release-checklist-0.4.0.md`

## Noted follow-up after Phase 6

- [ ] Interactive `/skills` capture and auth/session checks still rely on manual live evidence
- [ ] Real MCP liveness checks remain outside deterministic release-gating
- [ ] Windows live install evidence remains prep-only until the public matrix is promoted
