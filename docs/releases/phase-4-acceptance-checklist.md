# PairSlash Phase 4 Acceptance Checklist

Use this checklist when closing Phase 4 as an installable product surface.

## Automation baseline

- [ ] `npm run test:phase4`
- [ ] `npm run test:phase4:acceptance -- --lane macos --report-out artifacts/phase4-acceptance-macos.json`
- [ ] `npm run test:phase4:acceptance -- --lane linux --report-out artifacts/phase4-acceptance-linux.json`
- [ ] `npm run test:phase4:acceptance -- --lane windows-prep --report-out artifacts/phase4-acceptance-windows-prep.json`

## Required scenarios

- [ ] Fresh install repo-scope reaches `/skills` readiness on the macOS Codex lane.
- [ ] Fresh install user-scope reaches `/skills` readiness on the Linux Copilot lane.
- [ ] Update preserves a valid local override on both full-apply lanes.
- [ ] Uninstall removes only PairSlash-owned assets and leaves unmanaged files untouched.
- [ ] Doctor catches a broken setup and returns a blocking verdict where appropriate.

## Metrics and artifacts

- [ ] Acceptance JSON exists for every lane.
- [ ] Each report contains `install_success`, `doctor_success`, `time_to_first_success_ms`, `issue_codes`, and `repro_key`.
- [ ] `repo-basic-readonly` remains the pilot fixture for first-success coverage.
- [ ] Windows prep report keeps `install_success = null` and `time_to_first_success_ms = null`.

## Docs that must line up

- [ ] `docs/workflows/phase-4-quickstart.md`
- [ ] `docs/workflows/install-guide.md`
- [ ] `docs/runtime-mapping/pilot-acceptance.md`
- [ ] `docs/releases/release-checklist-0.4.0.md`

## Deferred to Phase 6

- [ ] Live runtime matrix beyond the current pilot lanes
- [ ] Interactive `/skills` capture and auth/session checks
- [ ] Real MCP liveness checks
- [ ] Larger compat-lab fixture catalog and richer reproducibility tooling
