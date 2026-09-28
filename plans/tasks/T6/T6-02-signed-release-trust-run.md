---
id: T6-02
track: T6
title: R2 — protected signed release-trust-candidate run
status: todo
depends_on: []
est_size: M
claimed_by:
claimed_at:
completed_at:
evidence:
blocked_reason:
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
