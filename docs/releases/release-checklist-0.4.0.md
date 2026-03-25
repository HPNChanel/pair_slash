# PairSlash 0.4.0 Phase 4 Release Checklist

Status legend:

- `[x]` automated gate exists and passes on the current branch
- `[ ]` manual gate must be re-confirmed before declaring Phase 4 complete

## Pass / fail gate

- [x] `pack.manifest.yaml v2` validator, schemas, and registry discovery pass in `packages/spec-core/tests/spec-core.test.js`
- [x] compiler v2 stays one-spec-two-runtimes through shared IR coverage in `packages/compiler-codex/tests/compiler-codex.test.js` and `packages/compiler-copilot/tests/compiler-copilot.test.js`
- [x] `install`, `update`, and `uninstall` exercise preview, rollback, override preservation, repo scope, and user scope in `packages/installer/tests/installer.test.js`
- [x] `doctor` covers runtime/version/path/permission/conflict/tool/MCP checks in `packages/doctor/tests/doctor.test.js`
- [x] `lint --phase4` blocks installability regressions in `packages/lint-bridge/tests/lint-bridge.test.js`
- [x] CLI wiring for `preview`, `install`, `update`, `uninstall`, `doctor`, and `lint` is covered in `packages/cli/tests/cli.test.js`
- [x] compat-lab bootstrap keeps 5 fixtures and deterministic Codex/Copilot goldens in `packages/compat-lab/tests/compat-lab.test.js`
- [x] Phase 4 acceptance slice covers macOS, Linux, and Windows prep in `packages/compat-lab/tests/acceptance.test.js`
- [ ] Do not declare Phase 4 complete if any managed command mutates without preview or dry-run support
- [ ] Do not declare Phase 4 complete if uninstall removes unmanaged or user-edited content

## Blockers

- [ ] Block release if `npm run test:phase4:release` fails
- [ ] Block release if `docs/validation/phase-3-5/verdict.md` is absent or remains `Gate status: NO-GO`
- [ ] Block release if `docs/validation/phase-3-5/evidence-log.md` has no recorded benchmark evidence
- [ ] Block release if docs claim live runtime compatibility beyond `docs/compatibility/runtime-verification.md` evidence
- [ ] Block release if a new runtime is mentioned outside Codex CLI and GitHub Copilot CLI
- [ ] Block release if messaging drifts beyond `docs/validation/phase-3-5/messaging-narrative.md`

## Deferred to Phase 5 / 6

- [ ] Phase 5: replace bridge lint with full contract/policy enforcement
- [ ] Phase 5: extend override policy only after a safe merged-file contract exists
- [ ] Phase 6: add live runtime matrix, auth/session checks, and real MCP interaction coverage
- [ ] Phase 6: expand compat-lab beyond bootstrap fixtures and fake runtime lanes
- [ ] Phase 6: promote acceptance slice into full compat-lab with richer fixture coverage and issue triage tooling

## Final smoke tests

- [x] `npm run test:phase4`
- [x] `npm run test:phase4:acceptance -- --lane macos`
- [x] `npm run test:phase4:acceptance -- --lane linux`
- [x] `npm run test:phase4:acceptance -- --lane windows-prep`
- [x] `npm run test:phase4:release`
- [ ] `node packages/cli/src/bin/pairslash.js doctor --runtime codex --target repo`
- [ ] `node packages/cli/src/bin/pairslash.js doctor --runtime copilot --target user`
- [ ] `node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo`
- [ ] `node packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user`

## Minimum docs that must ship

- [x] `docs/validation/phase-3-5/README.md`
- [x] `docs/validation/phase-3-5/problem-statement.md`
- [x] `docs/validation/phase-3-5/benchmark-tasks.md`
- [x] `docs/validation/phase-3-5/scoring-rubric.md`
- [x] `docs/validation/phase-3-5/runbook.md`
- [x] `docs/validation/phase-3-5/evidence-log.md`
- [x] `docs/validation/phase-3-5/messaging-narrative.md`
- [x] `docs/validation/phase-3-5/verdict.md`
- [x] `docs/architecture/pack-manifest-v2-practical-spec.md`
- [x] `docs/architecture/compiler-v2-implement-oriented.md`
- [x] `docs/workflows/phase-4-install-commands.md`
- [x] `docs/workflows/phase-4-quickstart.md`
- [x] `docs/workflows/phase-4-doctor-troubleshooting.md`
- [x] `docs/runtime-mapping/README.md`
- [x] `docs/runtime-mapping/codex-cli.md`
- [x] `docs/runtime-mapping/copilot-cli.md`
- [x] `docs/runtime-mapping/pilot-acceptance.md`
- [x] `docs/releases/release-checklist-0.4.0.md`
- [x] `docs/releases/phase-4-acceptance-checklist.md`
- [x] `packages/compat-lab/fixtures/README.md`
