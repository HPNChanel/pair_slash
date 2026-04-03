# PairSlash Phase 4 Doctor Troubleshooting

Use `pairslash doctor` before install, after install, and before update.
Doctor is the local diagnosis surface for the technically shipped installability
path, not a public support promotion step or a product-validation verdict.

Public support labels live in `docs/compatibility/compatibility-matrix.md`.
Doctor surfaces `support_verdict` and `support_lane` for operator decisions on
the current machine; the compatibility matrix owns public labels such as
`stable-tested`, `degraded`, `prep`, and `known-broken`.

This page shows direct CLI invocation (`node packages/tools/cli/src/bin/pairslash.js ...`) for runtime-neutral docs.
In this repo, use the equivalent shorthand `npm run pairslash -- <args>`.

When doctor surfaces a failure you cannot explain from the report alone, move
to the support flow in `docs/support/phase-7-support-ops.md` and capture a
debug report or support bundle instead of pasting raw logs.

## Verdicts

- `pass`: runtime lane is compatible and no blocking issue was found
- `warn`: install can proceed, but there is a non-blocking issue to review
- `degraded`: runtime lane works with reduced safety or missing optional capability
- `fail`: install/update/use is blocked until the issue is fixed
- `unsupported`: the OS or runtime lane is outside the documented Phase 4 support surface

## How to read doctor without overclaiming

- `pass` or `warn` means the local path can continue; it does not by itself
  promote public support.
- `degraded` means the local path is usable with caveats; public wording still
  stays lane-specific and evidence-bound.
- `fail` or `unsupported` means stop and fix the local issue before
  install/update.
- `support_lane.supported` is a doctor signal, not a public `stable-tested`
  claim.
- `support_lane.unverified` or `support_lane.prep` means implementation or
  preview behavior may exist, but live support evidence remains narrower than
  the implementation surface.

## Operator wording templates

- Blocked due to unmanaged footprint:
  "Install is blocked because PairSlash found an unmanaged runtime footprint
  under the target install root. Use `preview install` as the source of truth,
  then move or remove the unmanaged files if preview reports a blocking
  conflict."
- Degraded runtime lane:
  "This lane is usable with documented caveats, but confidence is reduced.
  Review the reported caveat before install or update, and do not widen public
  support claims beyond the compatibility matrix."
- Prep lane:
  "This is a prep lane. Doctor and preview can confirm local readiness, but
  live install support is not yet publicly claimable."
- Runtime unavailable:
  "The requested runtime is unavailable on this machine or not on `PATH`.
  Install the runtime first, then rerun doctor before attempting install."
- Evidence narrower than implementation:
  "This surface exists in the repo and may be deterministically covered, but
  live runtime evidence is narrower than the implementation. Keep public
  wording at the documented lane level."

## What doctor now answers

- Runtime installed or not, plus manifest compatibility range
- Support lane maturity for the current OS/runtime/target
- Repo-scope and user-scope path and writability matrix in one run
- Config/install root drift, unmanaged collisions, asset placement drift, and local override/update risk
- The next concrete step to reach the first workflow

## Common checks and remediations

- `runtime.detect`
  The requested runtime is unavailable on this machine or not on `PATH`.
  Run `codex --version` or `gh copilot --version`, install the runtime if
  needed, and rerun doctor before attempting install.
- `runtime.version_range`
  Upgrade or downgrade the runtime until it falls inside `supported_runtime_ranges` from the pack manifest.
- `runtime.tested_range`
  Your runtime may satisfy the manifest floor but still sit outside recorded
  live evidence. Treat this as evidence narrower than implementation, not as a
  spec mismatch or public support proof.
- `platform.support_lane`
  Check whether the current OS/runtime/target lane is `supported`,
  `unverified`, `prep`, or `unsupported`. These are doctor signals, not the
  public support labels. Windows remains a prep lane until live evidence is
  recorded.
- `filesystem.config_home`
  Ensure the config-home path is a directory, not a file. Codex uses `.agents/` or `~/.agents/`; Copilot uses `.github/` or `~/.copilot/`.
- `filesystem.write_permission`
  Fix directory permissions before retrying install or update. Doctor reports both repo-scope and user-scope writability, but only the selected target can block install.
- `platform.shell_profile_candidates`
  Review the reported shell profile candidates before adding runtime-specific PATH or env setup. PairSlash only reports them in Phase 4; it does not write them.
- `manifest.naming_conflicts`
  Rename the conflicting pack id or direct invocation so each runtime surface stays unique.
- `dependencies.required_tools`
  Install the declared tool or remove the pack from the install set.
- `dependencies.required_mcp_servers`
  Restore the required MCP fragment or install the missing server configuration.
- `install_state.owned_files_integrity`
  Run `pairslash update --preview` to inspect preserved overrides and blocked conflicts before any apply step.
- `install_state.update_preview_risk`
  Doctor reuses update preview logic to show whether local overrides would be preserved or whether update would block on conflicts.
- `install_state.asset_placement`
  A managed file is present, but not where the runtime-native adapter expects it. Reinstall or fix compiler/runtime drift before trusting update or uninstall.
- `conflict.unmanaged_install_root`
  Use `preview install` as the source of truth. If preview reports a blocked
  conflict, move or remove the unmanaged runtime folder; if preview stays
  non-blocking, treat the unmanaged files as preserved local overrides instead
  of widening the support claim.
- `platform.os_shell_support`
  Use PowerShell, cmd, bash, zsh, or sh on a supported OS before filing a runtime bug.

## Suggested operator flow

```bash
node packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo
node packages/tools/cli/src/bin/pairslash.js doctor --runtime copilot --target user
node packages/tools/cli/src/bin/pairslash.js doctor --runtime auto --target repo --format json
```

If the verdict is `degraded`, review the non-blocking issues before install.
If the verdict is `fail` or `unsupported`, fix the blocking issue first.
Do not force `update` or `uninstall` around a failing doctor result.

Pilot-lane evidence and OS-specific expectations live in
`docs/runtime-mapping/pilot-acceptance.md`.

## Escalate to support bundle

Use these when doctor points at the failure domain but does not explain the full
repro:

```bash
node packages/tools/cli/src/bin/pairslash.js debug --latest --runtime codex --format text
node packages/tools/cli/src/bin/pairslash.js debug --latest --runtime codex --bundle --format text
node packages/tools/cli/src/bin/pairslash.js telemetry summary --format text
```
