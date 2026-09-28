import {
  buildReviewRemediationAction,
  dedupeRemediationActions,
  planInstall,
  satisfiesRuntimeRange,
} from "@pairslash/installer";
import {
  SHARED_AGENTS_SKILL_ROOT_MIN_VERSIONS,
  exists,
  relativeFrom,
} from "@pairslash/spec-core";
import {
  dirname,
} from "node:path";
import {
  REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
  REASON_CODE_RECONCILE_IDENTICAL,
  REASON_CODE_RECONCILE_OVERRIDE,
  REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
  REASON_CODE_UNMANAGED_CONFLICT,
  createCheckResult,
  findExistingParentPath,
  listInstallRootEntries,
  safeStat,
} from "../helpers.ts";

export function runInstallRootCheck(context) {
  if (context.installRoot === null || context.installRoot === undefined) {
    return createCheckResult({
      id: "filesystem.install_root",
      group: "filesystem",
      status: "unsupported",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        install_root: null,
        emit: context.emit,
      },
      summary: "plugin emit mode has no install root at this scope; plugin bundles are repo-scope only",
      remediation: "Use --emit plugin --target repo; user-scope plugin activation stays with the runtime's own plugin commands.",
      evidence: {},
      blockingForInstall: true,
    });
  }
  if (!exists(context.installRoot)) {
    return createCheckResult({
      id: "filesystem.install_root",
      group: "filesystem",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        install_root: context.installRoot,
      },
      summary: "install root does not exist yet",
      remediation: "Run install to create the runtime install root.",
      evidence: {
        parent: findExistingParentPath(context.installRoot),
      },
    });
  }
  const stat = safeStat(context.installRoot);
  if (!stat.ok || !stat.stat.isDirectory()) {
    return createCheckResult({
      id: "filesystem.install_root",
      group: "filesystem",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        install_root: context.installRoot,
      },
      summary: "install root exists but is not a directory",
      remediation: "Remove or relocate the conflicting file so the install root can be a directory.",
      evidence: {
        error: stat.error ?? null,
      },
      blockingForInstall: true,
    });
  }
  return createCheckResult({
    id: "filesystem.install_root",
    group: "filesystem",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      install_root: context.installRoot,
    },
    summary: "install root path is valid",
    evidence: {},
  });
}

export function runWritePermissionCheck(context) {
  const targets = [
    context.installRoot,
    dirname(context.statePath),
    context.configHome,
  ]
    .filter(Boolean)
    .map((path) => findExistingParentPath(path));
  const failures = [];
  for (const path of [...new Set(targets)]) {
    const permission = context.adapter.checkWritablePath(path);
    if (!permission.writable) {
      failures.push({ path, error: permission.error });
    }
  }
  if (failures.length > 0) {
    return createCheckResult({
      id: "filesystem.write_permission",
      group: "filesystem",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        paths: [...new Set(targets)],
      },
      summary: `${failures.length} writable path check(s) failed`,
      remediation: "Fix filesystem permissions or switch to a target scope with write access.",
      evidence: {
        failures,
      },
      blockingForInstall: true,
    });
  }
  return createCheckResult({
    id: "filesystem.write_permission",
    group: "filesystem",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      paths: [...new Set(targets)],
    },
    summary: "required filesystem paths are writable",
    evidence: {},
  });
}

export function runSharedSkillRootSupport(context) {
  const base = {
    id: "install_state.shared_skill_root",
    group: "install_state",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
  };
  const skillRoot = context.skillRoot ?? "runtime-default";
  if (skillRoot !== "shared-agents") {
    return createCheckResult({
      ...base,
      status: "pass",
      summary: "shared .agents/skills root not selected; runtime-default install root in use",
      evidence: { skill_root: skillRoot },
    });
  }
  const minVersion = SHARED_AGENTS_SKILL_ROOT_MIN_VERSIONS[context.runtime];
  const detection = context.detection;
  const detectedVersion = detection?.version ?? null;
  const floorSatisfied =
    detection?.available && detectedVersion && detectedVersion !== "unknown"
      ? satisfiesRuntimeRange(detectedVersion, `>=${minVersion}`)
      : null;
  const evidence = {
    skill_root: skillRoot,
    install_root: context.installRoot,
    runtime: context.runtime,
    detected_version: detectedVersion,
    minimum_version: minVersion,
  };
  if (floorSatisfied === true) {
    return createCheckResult({
      ...base,
      status: "pass",
      summary: `runtime supports the shared .agents/skills root (${context.runtime} ${detectedVersion} >= ${minVersion})`,
      evidence,
    });
  }
  return createCheckResult({
    ...base,
    status: "warn",
    summary:
      floorSatisfied === false
        ? `runtime ${context.runtime} ${detectedVersion} may not scan ${context.installRoot}; .agents/skills project scan requires >= ${minVersion}`
        : `could not verify ${context.runtime} supports the shared .agents/skills root (requires >= ${minVersion}); failing closed`,
    remediation:
      "Either upgrade the runtime or reinstall with the default --skill-root runtime-default surface.",
    evidence,
  });
}

export function runUnmanagedInstallRoot(context) {
  if (context.installRoot === null || context.installRoot === undefined) {
    return createCheckResult({
      id: "conflict.unmanaged_install_root",
      group: "conflict",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no install root at this scope for the selected emit mode; nothing to scan",
      evidence: {},
    });
  }
  const entries = listInstallRootEntries(context.installRoot);
  const trackedNames = new Set((context.state?.packs ?? []).map((pack) => relativeFrom(context.installRoot, pack.install_dir)));
  const installIntentPacks = context.installIntentPacks.length > 0
    ? context.installIntentPacks
    : context.selectedManifests.map((record) => record.packId);
  const selectedNames = new Set(installIntentPacks);
  const unmanaged = entries.filter((entry) => !trackedNames.has(entry.name));
  const reconciledFiles = (context.state?.packs ?? [])
    .flatMap((pack) =>
      pack.files
        .filter((file) => file.management_mode === "reconciled_unmanaged")
        .map((file) => ({
          pack_id: pack.id,
          relative_path: file.relative_path,
          absolute_path: file.absolute_path,
          reason_code: file.reconciled_reason_code ?? REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
        })),
    )
    .sort((left, right) =>
      `${left.pack_id}\u0000${left.relative_path}`.localeCompare(
        `${right.pack_id}\u0000${right.relative_path}`,
      ),
    );
  if (unmanaged.length === 0) {
    if (reconciledFiles.length > 0) {
      return createCheckResult({
        id: "conflict.unmanaged_install_root",
        group: "conflict",
        status: "warn",
        runtime: context.runtime,
        target: context.target,
        inputs: {},
        summary: `${reconciledFiles.length} reconciled unmanaged file(s) remain under PairSlash-managed pack roots`,
        remediation: "Review preserved unmanaged files before update or uninstall.",
        evidence: {
          reconciled_files: reconciledFiles,
        },
        reasonCodes: reconciledFiles.map((file) => file.reason_code),
        remediationActions: dedupeRemediationActions(
          reconciledFiles.map((file) =>
            buildReviewRemediationAction({
              actionId: `review-unmanaged:${file.pack_id}:${file.relative_path}`,
              summary: "Review the unmanaged file that PairSlash preserves.",
              path: file.absolute_path,
              appliesToActions: ["doctor", "update", "uninstall"],
              reasonCodes: [file.reason_code],
            }),
          ),
        ),
      });
    }
    return createCheckResult({
      id: "conflict.unmanaged_install_root",
      group: "conflict",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no unmanaged runtime assets detected under the install root",
      evidence: {},
    });
  }

  const collisions = unmanaged.filter((entry) => selectedNames.has(entry.name));
  const offIntentEntries = unmanaged.filter((entry) => !selectedNames.has(entry.name));
  if (collisions.length > 0) {
    const selectedPackIds = [...selectedNames];
    try {
      const preview = planInstall({
        repoRoot: context.repoRoot,
        runtime: context.runtime,
        target: context.target,
        packs: selectedPackIds,
      });
      const unmanagedOperations = preview.plan.operations.filter((operation) =>
        selectedNames.has(operation.pack_id) &&
        [
          REASON_CODE_RECONCILE_IDENTICAL,
          REASON_CODE_RECONCILE_OVERRIDE,
          REASON_CODE_UNMANAGED_CONFLICT,
          REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
        ].includes(operation.reason_code),
      );
      const blocked = unmanagedOperations.filter((operation) => operation.kind === "blocked_conflict");
      if (blocked.length > 0) {
        return createCheckResult({
          id: "conflict.unmanaged_install_root",
          group: "conflict",
          status: "fail",
          runtime: context.runtime,
          target: context.target,
          inputs: {},
          summary: `${blocked.length} unmanaged install-root path(s) would block install preview`,
          remediation:
            "Run `pairslash preview install` and rename, remove, or reconcile the blocking unmanaged paths before install.",
          evidence: {
            collisions: collisions.map((entry) => entry.absolutePath),
            blocked_conflicts: blocked.map((operation) => ({
              pack_id: operation.pack_id,
              relative_path: operation.relative_path,
              reason: operation.reason,
              reason_code: operation.reason_code ?? null,
            })),
            ignored_non_intent_paths: offIntentEntries.map((entry) => entry.absolutePath),
          },
          blockingForInstall: true,
          reasonCodes: blocked.map((operation) => operation.reason_code ?? REASON_CODE_UNMANAGED_CONFLICT),
          remediationActions: dedupeRemediationActions(
            blocked.flatMap((operation) => operation.remediation_actions ?? []),
          ),
        });
      }

      const reconciled = unmanagedOperations.filter((operation) => operation.kind === "reconcile_unmanaged");
      if (reconciled.length > 0) {
        return createCheckResult({
          id: "conflict.unmanaged_install_root",
          group: "conflict",
          status: "warn",
          runtime: context.runtime,
          target: context.target,
          inputs: {},
          summary: `${collisions.length} unmanaged install-root entr${collisions.length === 1 ? "y" : "ies"} collide with selected pack ids but install preview stays non-blocking`,
          remediation:
            "Keep `pairslash preview install` as the source of truth before apply and review any preserved overrides carefully.",
          evidence: {
            collisions: collisions.map((entry) => entry.absolutePath),
            preview_operations: reconciled.map((operation) => ({
              kind: operation.kind,
              pack_id: operation.pack_id,
              relative_path: operation.relative_path,
              reason: operation.reason,
              reason_code: operation.reason_code ?? null,
              reconcile_mode: operation.reconcile_mode ?? null,
            })),
            ignored_non_intent_paths: offIntentEntries.map((entry) => entry.absolutePath),
          },
          reasonCodes: reconciled.map((operation) => operation.reason_code),
          remediationActions: dedupeRemediationActions(
            reconciled.flatMap((operation) => operation.remediation_actions ?? []),
          ),
        });
      }
    } catch (error) {
      return createCheckResult({
        id: "conflict.unmanaged_install_root",
        group: "conflict",
        status: "warn",
        runtime: context.runtime,
        target: context.target,
        inputs: {},
        summary: "unmanaged install-root entries detected, but install preview could not classify whether they block apply",
        remediation: "Run `pairslash preview install` directly to confirm whether unmanaged paths are blocking or preserved.",
        evidence: {
          collisions: collisions.map((entry) => entry.absolutePath),
          preview_error: error.message,
          ignored_non_intent_paths: offIntentEntries.map((entry) => entry.absolutePath),
        },
      });
    }
  }

  return createCheckResult({
    id: "conflict.unmanaged_install_root",
    group: "conflict",
    status: "warn",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: `${unmanaged.length} unmanaged install root entr${unmanaged.length === 1 ? "y" : "ies"} detected`,
    remediation: "Review unmanaged runtime assets if they might collide with future PairSlash installs.",
    evidence: {
      unmanaged: unmanaged.map((entry) => ({
        name: entry.name,
        absolute_path: entry.absolutePath,
      })),
    },
  });
}
