# PairSlash 0.4.0 Release Checklist

This checklist governs scoped release/installability truth. It does not reopen
or close the Phase 3.5 product-validation gate.

Status legend:

- `[x]` automated gate exists and passes on the current branch
- `[ ]` manual gate must be re-confirmed before declaring the release lane complete

## Pass / fail gate

- [x] `pack.manifest.yaml v2` validator, authoritative pack catalog derivation, conformance drift gates, and derived registry sync pass in `packages/core/spec-core/tests/spec-core.test.js` and `packages/core/spec-core/tests/manifest-v2.conformance.test.js`
- [x] compiler v2 stays one-spec-two-runtimes through shared IR coverage in `packages/runtimes/codex/compiler/tests/compiler-codex.test.js` and `packages/runtimes/copilot/compiler/tests/compiler-copilot.test.js`
- [x] `install`, `update`, and `uninstall` exercise preview, rollback, override preservation, repo scope, and user scope in `packages/tools/installer/tests/installer.test.js`
- [x] `doctor` covers runtime/version/path/permission/conflict/tool/MCP checks plus shared lifecycle reason-code parity in `packages/tools/doctor/tests/doctor.test.js`
- [x] `pairslash lint` blocks installability regressions in `packages/tools/lint-bridge/tests/lint-bridge.test.js`
- [x] CLI wiring for `preview`, `install`, `update`, `uninstall`, `doctor`, and `lint` is covered in `packages/tools/cli/tests/cli.test.js`
- [x] compat-lab keeps the multi-archetype Phase 6 fixture corpus, deterministic compiler/config goldens, and fixture snapshots in `packages/tools/compat-lab/tests/compat-lab.test.js`
- [x] compat-lab acceptance covers macOS, Linux, and Windows prep lanes in `packages/tools/compat-lab/tests/acceptance.test.js`
- [x] behavioral eval coverage protects workflow selection, policy gates, compatibility errors, preview behavior, degraded lanes, and no-silent-fallback in `packages/tools/compat-lab/tests/evals.test.js`
- [x] public compatibility docs stay generated and in sync in `packages/tools/compat-lab/tests/matrix.test.js`
- [x] release-trust bundle structure, checksum verification, and signed-bundle verification coverage exist in `packages/core/spec-core/tests/release-trust.test.js`
- [ ] Do not declare Phase 4 complete if any managed command mutates without preview or dry-run support
- [ ] Do not declare Phase 4 complete if uninstall removes unmanaged or user-edited content
- [ ] Do not declare Phase 4 complete if `doctor`, `preview install`, `install`, `update`, and `uninstall` disagree on stale install-state, managed reinstall redirect, or reconciled unmanaged ownership semantics

## Blockers

- [ ] Block release if `npm run test:release` fails
- [ ] Block release if `npm run test:release:ship` fails
- [ ] Block release if `trust/first-party-keys.json` is absent or has no active key
- [ ] Block release if `trust/pack-authority.yaml` is absent
- [ ] Block release if release-trust structural verification is removed from `npm run test:release`
- [ ] Block signed release publication if protected CI cannot build and verify a signed release-trust bundle
- [ ] Block signed release publication if protected CI does not set `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1`
- [ ] Block release if `docs-private/releases/release-candidate-evidence-0.4.0.md` is absent or fails `node scripts/verify-release-candidate-evidence.mjs`
- [ ] Block release if `npm run test:support` fails
- [ ] Block release if `docs/phase-12/authoritative-program-charter.md` is absent
- [ ] Block release if `docs/releases/scoped-release-verdict.md` is absent or drifts from the current branch gate result
- [ ] Block release if `docs/releases/legal-packaging-status.md` is absent
- [ ] Block release if top-level `LICENSE` is absent
- [ ] Block release if root or PairSlash-owned package manifests drift from the repository SPDX license
- [ ] Block release if the current legal posture requires `NOTICE` and the file is absent
- [ ] Block release if public docs imply product-validation exit while `docs/validation/phase-3-5/verdict.md` remains `Gate status: NO-GO`
- [ ] Block release if `README.md`, `docs/phase-9/README.md`, or `docs/phase-9/onboarding-path.md` drift from the official phase sentence in `docs/phase-12/authoritative-program-charter.md`
- [ ] Block release if docs claim live runtime compatibility beyond `docs/compatibility/runtime-verification.md` and `docs/evidence/live-runtime/` evidence
- [ ] Block release if a new runtime is mentioned outside Codex CLI and GitHub Copilot CLI
- [ ] Block release if messaging drifts beyond `docs/validation/phase-3-5/messaging-narrative.md` or `docs/releases/public-claim-policy.md`
- [ ] Block release if public install docs imply package-manager publication while root or workspace manifests remain `private: true`

## Failure handling (release trust)

- [ ] If `trust-keyring:no-active-keys:pairslash` appears, restore at least one non-revoked key in `trust/first-party-keys.json`
- [ ] If `trust-policy:publisher-missing:pairslash` or `trust-policy:keyring-path-missing:pairslash` appears, fix `trust/trust-policy.yaml`
- [ ] If `pack-authority:*` bootstrap failures appear, repair `trust/pack-authority.yaml` before rerunning release gates
- [ ] If `missing checksum set` or checksum mismatch errors appear, rebuild trust artifacts from source (`npm run release:trust:build`) and reverify
- [ ] If `duplicate checksum entry` or `invalid checksum entry path` appears, regenerate `checksums.json` from a clean trust output directory and rerun verification
- [ ] If `missing release signature` or `missing public key` appears on a signed lane, rotate/fix signing secrets and rerun protected CI
- [ ] If `unexpected release signature artifact` appears, treat the trust directory as stale/tampered, delete it, rebuild (`npm run release:trust:build`), then reverify
- [ ] If release candidate evidence verification fails, refresh `docs-private/releases/release-candidate-evidence-0.4.0.md` with the protected candidate run id, artifact details, and signed verify result before rerunning ship gates
- [ ] Capture failing command output and attach it to the release candidate record before overriding any checklist item

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
- [ ] Linux Copilot and macOS Codex lane promotions still require fresh canonical `/skills` evidence before public support wording can rise

## Final smoke tests

- [x] `npm run test`
- [x] `npm run test:acceptance -- --lane macos`
- [x] `npm run test:acceptance -- --lane linux`
- [x] `npm run test:acceptance -- --lane windows-prep`
- [x] `npm run sync:compat-lab -- --check`
- [ ] `npm run test:release`
- [ ] `npm run test:release:ship`
- [ ] `npm run test:support`
- [ ] `node scripts/build-release-trust.mjs --out .pairslash/tmp/release-checklist-trust`
- [ ] `node scripts/verify-release-trust.mjs --trust-dir .pairslash/tmp/release-checklist-trust --mode structural`
- [ ] Protected CI signed bundle build + verify completed for the release candidate when live-signed publication is intended
- [ ] `.github/workflows/release-trust-candidate.yml` passed for the candidate with signed artifact upload
- [ ] `docs-private/releases/release-candidate-evidence-0.4.0.md` includes the protected candidate run id, artifact name, verify result, key id, and commit/tag binding
- [x] `node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo`
- [x] `node packages/tools/cli/src/bin/pairslash.js doctor --runtime copilot --target user`
- [x] `node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo`
- [x] `node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target user`

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
- [x] `docs/releases/legal-packaging-status.md`
- [x] `docs/releases/public-claim-policy.md`
- [x] `LICENSE`
- [x] `docs/architecture/pack-manifest-v2-practical-spec.md`
- [x] `docs/architecture/compiler-v2-implement-oriented.md`
- [x] `docs/workflows/phase-4-install-commands.md`
- [x] `docs/workflows/phase-4-quickstart.md`
- [x] `docs/workflows/phase-4-doctor-troubleshooting.md`
- [x] `docs/reporting.md`
- [x] `docs/support/phase-7-support-ops.md`
- [x] `docs/support/bundle-intake-policy.md`
- [x] `docs/support/triage-playbook.md`
- [x] `docs/support/repro-assets.md`
- [x] `docs/phase-9/issue-taxonomy.md`
- [x] `docs/phase-9/maintainer-playbook.md`
- [x] `docs/maintainers/README.md`
- [x] `docs/compatibility/compatibility-matrix.md`
- [x] `docs/compatibility/runtime-surface-matrix.yaml`
- [x] `docs/compatibility/runtime-verification.md`
- [x] `docs/evidence/live-runtime/README.md`
- [x] `docs/troubleshooting/compat-lab-bug-repro.md`
- [x] `docs/runtime-mapping/README.md`
- [x] `docs/runtime-mapping/codex-cli.md`
- [x] `docs/runtime-mapping/copilot-cli.md`
- [x] `docs/runtime-mapping/pilot-acceptance.md`
- [x] `docs/releases/changelog-0.4.0.md`
- [x] `docs/releases/upgrade-notes-0.4.0.md`
- [x] `docs-private/releases/release-checklist-0.4.0.md`
- [x] `docs-private/releases/release-candidate-evidence-0.4.0.md`
- [x] `docs-private/releases/phase-4-acceptance-checklist.md`
- [x] `packages/tools/compat-lab/fixtures/README.md`
