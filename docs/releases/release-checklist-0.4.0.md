# PairSlash 0.4.0 Release Checklist

This checklist governs scoped release/installability truth. It does not reopen
or close the Phase 3.5 product-validation gate.

Status legend:

- `[x]` automated gate exists and passes on the current branch
- `[ ]` manual gate must be re-confirmed before declaring the release lane complete

## Pass / fail gate

- [x] `pack.manifest.yaml v2` validator, schemas, and registry discovery pass in `packages/core/spec-core/tests/spec-core.test.js`
- [x] compiler v2 stays one-spec-two-runtimes through shared IR coverage in `packages/runtimes/codex/compiler/tests/compiler-codex.test.js` and `packages/runtimes/copilot/compiler/tests/compiler-copilot.test.js`
- [x] `install`, `update`, and `uninstall` exercise preview, rollback, override preservation, repo scope, and user scope in `packages/tools/installer/tests/installer.test.js`
- [x] `doctor` covers runtime/version/path/permission/conflict/tool/MCP checks in `packages/tools/doctor/tests/doctor.test.js`
- [x] `pairslash lint` blocks installability regressions in `packages/tools/lint-bridge/tests/lint-bridge.test.js`
- [x] CLI wiring for `preview`, `install`, `update`, `uninstall`, `doctor`, and `lint` is covered in `packages/tools/cli/tests/cli.test.js`
- [x] compat-lab keeps the multi-archetype Phase 6 fixture corpus, deterministic compiler/config goldens, and fixture snapshots in `packages/tools/compat-lab/tests/compat-lab.test.js`
- [x] compat-lab acceptance covers macOS, Linux, and Windows prep lanes in `packages/tools/compat-lab/tests/acceptance.test.js`
- [x] behavioral eval coverage protects workflow selection, policy gates, compatibility errors, preview behavior, degraded lanes, and no-silent-fallback in `packages/tools/compat-lab/tests/evals.test.js`
- [x] public compatibility docs stay generated and in sync in `packages/tools/compat-lab/tests/matrix.test.js`
- [ ] Do not declare Phase 4 complete if any managed command mutates without preview or dry-run support
- [ ] Do not declare Phase 4 complete if uninstall removes unmanaged or user-edited content

## Blockers

- [ ] Block release if `npm run test:release` fails
- [ ] Block release if `docs/phase-12/authoritative-program-charter.md` is absent
- [ ] Block release if `docs/releases/scoped-release-verdict.md` is absent or remains `Gate status: NO-GO`
- [ ] Block release if public docs imply product-validation exit while `docs/validation/phase-3-5/verdict.md` remains `Gate status: NO-GO`
- [ ] Block release if `README.md`, `docs/phase-9/README.md`, or `docs/phase-9/onboarding-path.md` drift from the official phase sentence in `docs/phase-12/authoritative-program-charter.md`
- [ ] Block release if docs claim live runtime compatibility beyond `docs/compatibility/runtime-verification.md` evidence
- [ ] Block release if a new runtime is mentioned outside Codex CLI and GitHub Copilot CLI
- [ ] Block release if messaging drifts beyond `docs/validation/phase-3-5/messaging-narrative.md` or `docs/releases/public-claim-policy.md`

## Shipped hardening after Phase 4 baseline

- [x] Phase 5: replace bridge lint with full contract/policy enforcement
- [ ] Phase 5: extend override policy only after a safe merged-file contract exists
- [x] Phase 6: ship a public compatibility matrix plus runtime verification guidance
- [x] Phase 6: expand compat-lab beyond bootstrap fixtures into a multi-archetype regression corpus
- [x] Phase 6: promote the acceptance slice into full compat-lab coverage with behavior evals and release/nightly gates

## Noted follow-up after Phase 6

- [ ] Live auth/session capture is still manual evidence rather than a deterministic compat-lab gate
- [ ] Real MCP liveness remains outside deterministic release-gating coverage
- [ ] Windows live install evidence is still prep-only in the public compatibility matrix

## Final smoke tests

- [x] `npm run test`
- [x] `npm run test:acceptance -- --lane macos`
- [x] `npm run test:acceptance -- --lane linux`
- [x] `npm run test:acceptance -- --lane windows-prep`
- [x] `npm run sync:compat-lab -- --check`
- [x] `npm run test:release`
- [ ] `node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo`
- [ ] `node packages/tools/cli/src/bin/pairslash.js doctor --runtime copilot --target user`
- [ ] `node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo`
- [ ] `node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user`

## Minimum docs that must ship

- [x] `docs/validation/phase-3-5/README.md`
- [x] `docs/validation/phase-3-5/problem-statement.md`
- [x] `docs/validation/phase-3-5/benchmark-tasks.md`
- [x] `docs/validation/phase-3-5/scoring-rubric.md`
- [x] `docs/validation/phase-3-5/runbook.md`
- [x] `docs/validation/phase-3-5/evidence-log.md`
- [x] `docs/validation/phase-3-5/messaging-narrative.md`
- [x] `docs/validation/phase-3-5/verdict.md`
- [x] `docs/phase-12/authoritative-program-charter.md`
- [x] `docs/releases/scoped-release-verdict.md`
- [x] `docs/releases/public-claim-policy.md`
- [x] `docs/architecture/pack-manifest-v2-practical-spec.md`
- [x] `docs/architecture/compiler-v2-implement-oriented.md`
- [x] `docs/workflows/phase-4-install-commands.md`
- [x] `docs/workflows/phase-4-quickstart.md`
- [x] `docs/workflows/phase-4-doctor-troubleshooting.md`
- [x] `docs/compatibility/compatibility-matrix.md`
- [x] `docs/compatibility/runtime-surface-matrix.yaml`
- [x] `docs/compatibility/runtime-verification.md`
- [x] `docs/troubleshooting/compat-lab-bug-repro.md`
- [x] `docs/runtime-mapping/README.md`
- [x] `docs/runtime-mapping/codex-cli.md`
- [x] `docs/runtime-mapping/copilot-cli.md`
- [x] `docs/runtime-mapping/pilot-acceptance.md`
- [x] `docs/releases/release-checklist-0.4.0.md`
- [x] `docs/releases/phase-4-acceptance-checklist.md`
- [x] `packages/tools/compat-lab/fixtures/README.md`
