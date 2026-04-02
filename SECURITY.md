# Security Policy

PairSlash is an OSS trust layer for terminal-native AI workflows. Security handling in this repo is explicit, local-first, and evidence-bound. Do not rely on undocumented claims, unsigned artifacts, or runtime parity assumptions that the repo does not currently prove.

## Supported Scope

- Current security process applies to the two supported runtimes only: Codex CLI and GitHub Copilot CLI.
- `/skills` remains the canonical workflow entrypoint.
- Global Project Memory remains explicit-write-only. Reports that depend on hidden writes, implicit promotion, or background mutation are treated as design regressions.

## Reporting a Vulnerability

1. Do not open a public issue for a live exploit or secret leak.
2. Capture a local support bundle when it helps reproduce the issue:
   - `npm run pairslash -- debug --latest --bundle --format json`
   - or `npm run pairslash -- trace export --latest --support-bundle --include-doctor --format json`
3. Email the maintainer contact configured for the current release or repository profile with:
   - affected version or commit
   - runtime and target lane
   - impact summary
   - reproduction steps
   - support bundle if safe to share

If no private contact is available, open a minimal public issue that says a private security report is needed and withhold exploit details.

## Maintainer Process

1. Acknowledge the report.
2. Reproduce locally with the provided runtime, target, preview/install/doctor evidence, and support bundle when available.
3. Classify impact and affected release train.
4. Prepare a fix and a patch release or documented mitigation.
5. Publish an advisory only after a patched artifact or concrete mitigation exists.

## Disclosure Rules

- No hidden telemetry is enabled by default for triage.
- No silent server-side verification or background scanning is assumed.
- Advisory text must distinguish:
  - implemented fix
  - deterministic-lab evidence
  - live-evidence-backed claims
  - publicly supported claims

## Release Discipline

- Prefer the smallest patch that restores trust without widening product scope.
- Preserve preview-first, rollback-safe install/update behavior.
- Do not claim enterprise-grade hardening unless release artifacts, trust verification, and disclosure evidence are actually present.

See [patch-train.md](/D:/FOR_WORK/WORK_PROJECT/pair_slash/docs/security/patch-train.md) for the maintainer patch flow.
