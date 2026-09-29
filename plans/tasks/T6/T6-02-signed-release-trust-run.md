---
id: T6-02
track: T6
title: R2 — protected signed release-trust-candidate run
status: blocked
depends_on: []
est_size: M
claimed_by: devin
claimed_at: 2026-09-29
completed_at:
evidence: >-
  Signing enforcement re-verified on this branch: REQUIRE_SIGNED=1 is
  enforced fail-closed in scripts/run-release-ship-readiness.mjs and the
  protected workflow .github/workflows/release-trust-candidate.yml; public
  key pairslash-release-2026-04 (Ed25519) is checked in at
  trust/first-party-keys.json. npm run test:release green (structural,
  unsigned). Dated gap note recorded in
  docs/releases/scoped-release-verdict.md (2026-09-29).
blocked_reason: >-
  The Ed25519 private key is not provisioned as GitHub Actions secrets and
  no protected release-trust-candidate run has executed — signing custody is
  a maintainer action. Run-sheet: (1) generate/confirm the first-party
  keypair offline, public key already committed
  (pairslash-release-2026-04); (2) store PAIRSLASH_RELEASE_TRUST_PRIVATE_KEY
  and PAIRSLASH_RELEASE_TRUST_KEY_ID in the repo's protected environment
  secrets; (3) dispatch release-trust-candidate.yml on the release ref;
  (4) download the uploaded signed bundle artifact and run
  npm run release:trust:verify against it locally; (5) record checksums and
  run id in docs-private/releases/release-candidate-evidence-0.4.0.md;
  (6) then flip scoped-release-verdict.md per its own update rule.
---

## Objective

Complete one successful protected `release-trust-candidate` CI run producing a signed bundle that verifies locally — flipping `scoped-release-verdict.md` from NO-GO on the scoped-installability claim only.

## Context & sources

- Infra exists: `release-trust-candidate.yml` workflow, `npm run release:trust:build|verify`, `release:ship:evidence` recorder, `trust/first-party-keys.json`, `trust/pack-authority.yaml`, `PAIRSLASH_RELEASE_TRUST_*` secrets wiring (fail-closed when absent).
- Missing: a configured signing keypair + GitHub secrets + one green protected run. Human-in-loop for secrets/custody.
- Evidence file: `release-candidate-evidence-0.4.0.md` per upgrade notes convention.

## Files to touch

- `trust/first-party-keys.json` — public key entry (private key NEVER in repo — S1)
- `release-candidate-evidence-0.4.0.md` (maintainer evidence)
- `docs/releases/scoped-release-verdict.md` — only if the run verifies
- Do NOT touch: trust policy semantics, verification code (unless real bug)

## Work steps

1. Generate first-party keypair offline; record public key + key ID in `trust/` files; private key goes to GitHub secrets + offline custody (maintainer action).
2. Verify `release-trust-candidate.yml` enforces `PAIRSLASH_RELEASE_TRUST_REQUIRE_SIGNED=1` on protected lanes — no soft-skip path.
3. Trigger the workflow on `main`; confirm signed bundle uploads.
4. `npm run release:trust:verify -- --trust-dir <artifact>` locally → structural + signature pass.
5. Record candidate run in evidence file (checksums, timestamps).
6. `npm run test:release:ship` green → update `scoped-release-verdict.md` (scoped claim only; explicitly NOT product-validation).

## Constraints (STRICT)

- MUST NOT commit private key material anywhere (S1) — public key only.
- MUST NOT weaken `REQUIRE_SIGNED` to get a green run — unsigned success doesn't count.
- MUST NOT let the verdict claim more than scoped installability (C.6).
- If secrets/custody unavailable → `blocked` listing exact human steps needed.

## Acceptance gates

- [ ] Signed bundle verifies locally OR dated gap recorded
- [ ] `npm run test:release:ship` green (when run exists)
- [ ] Verdict wording stays inside scoped claim

## Evidence to record

- Artifact checksums + verification output; verdict diff.

## Rollback

Verdict reverts to NO-GO if any subsequent commit breaks `test:release` (verdict's own update rule).
