# PairSlash Legal and Packaging Status

Last updated: 2026-04-03
Truth class: legal-package
Claim scope: current-repo-metadata-and-packaging-boundary

This file owns the current legal/package publicness boundary only.
It does not own the official phase statement, runtime-support truth, or
product-validation truth.

## Current legal truth

- `.pairslash/project-memory/00-project-charter.yaml` records
  `license_status: apache-2.0-repo-source`.
- The repo ships a top-level `LICENSE` file with Apache-2.0 text.
- Root `package.json` and PairSlash-owned package manifests declare
  `"license": "Apache-2.0"`.
- The repo has no top-level `NOTICE` file.
- Current legal posture does not require `NOTICE`: PairSlash is shipping a
  source-licensed repository with repo-local install guidance, not a
  published package-manager distribution with an additional notice chain.

## Current packaging truth

- Root `package.json` is `private: true`.
- PairSlash-owned packages under `packages/core/*`, `packages/runtimes/*/*`,
  `packages/tools/*`, and current `packages/advanced/*` remain `private: true`.
- The supported install surface is repo-local CLI usage from this checkout via
  `npm run pairslash -- ...`.
- `@pairslash/cli` is the user-facing executable surface in the repo, but it
  is not currently a published package-manager artifact.
- Package-manager publication is not part of the current public surface.
- Signed release-trust bundles are release artifacts only. They do not turn
  the repo into a published package-manager surface.
- Runtime install paths such as `.agents/skills/` and `.github/skills/` are
  derived install artifacts, not canonical source.

## Current public-claim truth for this boundary

Safe today:

- The PairSlash source repository is licensed under Apache-2.0.
- PairSlash can be used from a repo checkout through the repo-local CLI
  entrypoint.
- PairSlash ships managed installability and trust-boundary behavior inside the
  current repository.
- Package-manager publication is not claimed today.
- The absence of a top-level `NOTICE` file is intentional under the current
  legal and packaging posture.
- Signed release-trust verification does not change the package-publicness
  boundary.

Not safe today:

- Saying PairSlash is already published as a public npm package.
- Saying every `@pairslash/*` package is intended for direct external
  consumption.
- Saying Apache-2.0 source licensing means package-manager publication already
  exists.
- Saying derived runtime install artifacts are the source distribution.

## Evidence required before changing this boundary

- A manifest posture change for any artifact whose publishability changes
  (`private`, `publishConfig`, and consumer-facing package boundary metadata).
- Any required attribution or notice files for the selected legal posture or
  distribution shape.
- Docs sync across `README.md`, contributor-facing wording, release wording,
  the public-claim policy, and the charter references.
- Consumer-facing release evidence for any package promoted beyond repo-local
  usage.
- `npm run test` and the relevant release-readiness gates passing on the
  current branch.

## Current decision

Keep PairSlash source public under Apache-2.0 while retaining a repo-local,
non-published packaging posture until a specific package publication scope is
explicitly chosen and shipped together with matching metadata, docs, and
release evidence.
