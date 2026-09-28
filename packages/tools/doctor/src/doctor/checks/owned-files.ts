import {
  buildInstallStateMetadataMismatches,
} from "@pairslash/installer";
import {
  exists,
} from "@pairslash/spec-core";
import {
  REASON_CODE_INSTALL_STATE_INVALID,
  REASON_CODE_INSTALL_STATE_METADATA_MISMATCH,
  buildStateReviewAction,
  createCheckResult,
  safeDigest,
  safeStat,
} from "../helpers.ts";

export function runInstallStateLoad(context) {
  if (context.stateError) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: `install state is invalid: ${context.stateError}`,
      remediation: "Remove or repair the invalid install state file, then rerun install or update.",
      evidence: {},
      blockingForInstall: true,
      reasonCodes: [REASON_CODE_INSTALL_STATE_INVALID],
      remediationActions: [
        buildStateReviewAction({
          runtime: context.runtime,
          target: context.target,
          statePath: context.statePath,
          preferred: true,
        }),
      ],
    });
  }
  if (!context.state) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: "skipped because no install state context is available",
      evidence: {},
    });
  }

  const mismatches = buildInstallStateMetadataMismatches({
    state: context.state,
    runtime: context.runtime,
    target: context.target,
    configHome: context.configHome,
    installRoot: context.installRoot,
  });
  if (mismatches.length > 0) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: "install state metadata does not match the current runtime/target paths",
      remediation: "Reinstall for the intended runtime/target or remove stale install state before retrying.",
      evidence: {
        mismatches: mismatches.map((entry) => ({
          field: entry.field,
          expected: entry.expected,
          actual: entry.actual,
        })),
      },
      blockingForInstall: true,
      reasonCodes: [REASON_CODE_INSTALL_STATE_METADATA_MISMATCH],
      remediationActions: [
        buildStateReviewAction({
          runtime: context.runtime,
          target: context.target,
          statePath: context.statePath,
          preferred: true,
        }),
      ],
    });
  }

  if (!context.stateFileExists) {
    return createCheckResult({
      id: "install_state.load",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        state_path: context.statePath,
      },
      summary: "install state is absent, which is valid before first install",
      evidence: {},
    });
  }

  return createCheckResult({
    id: "install_state.load",
    group: "install_state",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      state_path: context.statePath,
    },
    summary: "install state loaded successfully",
    evidence: {
      pack_count: context.state.packs.length,
    },
  });
}

export function runOwnedFilesIntegrity(context) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "install_state.owned_files_integrity",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no installed pack files to verify",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
  for (const pack of context.state.packs) {
    for (const file of pack.files) {
      if (!file.owned_by_pairslash) {
        continue;
      }
      if (!exists(file.absolute_path)) {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "missing managed file",
        });
        continue;
      }
      const stat = safeStat(file.absolute_path);
      if (!stat.ok || !stat.stat.isFile()) {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "managed path is not a regular file",
        });
        continue;
      }
      const digest = safeDigest(file.absolute_path);
      if (!digest.ok) {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: digest.error,
        });
        continue;
      }
      if (digest.digest === file.current_digest) {
        if (file.local_override) {
          warnings.push({
            pack_id: pack.id,
            relative_path: file.relative_path,
            reason: "local override preserved in receipt",
          });
        }
        continue;
      }
      if (file.override_eligible) {
        warnings.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "override-eligible managed file was edited after the last receipt update",
        });
      } else {
        failures.push({
          pack_id: pack.id,
          relative_path: file.relative_path,
          reason: "non-override managed file was edited",
        });
      }
    }
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "install_state.owned_files_integrity",
      group: "install_state",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} managed file integrity issue(s) detected`,
      remediation: "Run `pairslash update --preview` or restore the managed files before applying more changes.",
      evidence: {
        failures,
        warnings,
      },
      blockingForInstall: true,
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "install_state.owned_files_integrity",
      group: "install_state",
      status: "degraded",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} local override or edited managed file(s) were preserved`,
      remediation: "Review preserved local overrides before running update or uninstall.",
      evidence: {
        warnings,
      },
    });
  }
  return createCheckResult({
    id: "install_state.owned_files_integrity",
    group: "install_state",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "tracked managed files match install state receipts",
    evidence: {},
  });
}
