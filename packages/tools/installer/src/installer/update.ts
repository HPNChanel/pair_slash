import {
  detectRuntimeSelection,
  getRuntimeAdapter,
  satisfiesRuntimeRange,
} from "../runtime.ts";
import {
  buildReviewRemediationAction,
} from "../semantics.ts";
import {
  findStatePack,
} from "../state.ts";
import {
  OWNERSHIP_FILE,
  buildTrustDelta,
  exists,
  normalizeEmitMode,
  normalizeRuntime,
  normalizeSkillRoot,
  normalizeTarget,
} from "@pairslash/spec-core";
import {
  join,
} from "node:path";
import {
  applyLintPreflight,
  inspectInstallDirBoundary,
  resolveUpdateEnvironment,
  resolveUpdateSelection,
  runRequiredToolChecks,
} from "./environment.ts";
import {
  REASON_CODE_MANAGED_ORPHAN_OVERRIDE,
  REASON_CODE_MANAGED_OVERRIDE,
  REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
  REASON_CODE_RECONCILE_IDENTICAL,
  REASON_CODE_RECONCILE_OVERRIDE,
  REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
  REASON_CODE_UNMANAGED_CONFLICT,
  REASON_CODE_UPDATE_CONFLICT,
  SYSTEM_PACK_ID,
  applyMutationWithRollback,
  buildPackInstallDir,
  findManifestEntry,
  isVersionOrDigestMatch,
  resolveInstallRootForEmit,
  safeCurrentDigest,
} from "./helpers.ts";
import {
  buildOperation,
  buildPreviewInstallAction,
  buildPreviewUpdateAction,
  compileSelection,
  createPlan,
} from "./plan.ts";
import {
  buildCandidateTrustReceipts,
} from "./state.ts";

export function buildUpdateBlockedOperation({
  packId,
  installDir,
  relativePath = ".",
  absolutePath = null,
  ownership = "unmanaged",
  reason,
  reasonCode = REASON_CODE_UPDATE_CONFLICT,
  remediationActions = [],
}) {
  return buildOperation("blocked_conflict", {
    packId,
    relativePath,
    absolutePath: absolutePath ?? join(installDir, relativePath),
    ownership,
    reason,
    reasonCode,
    remediationActions,
  });
}

export function validateManagedOwnershipFile({ existingStatePack, errors, operations, runtime, target }) {
  const remediationActions = [
    buildPreviewUpdateAction({
      runtime,
      target,
      packId: existingStatePack.id,
      preferred: true,
    }),
    buildReviewRemediationAction({
      actionId: `review-ownership:${existingStatePack.id}`,
      summary: "Review the managed ownership receipt before updating.",
      path: join(existingStatePack.install_dir, OWNERSHIP_FILE),
      appliesToActions: ["doctor", "update"],
      reasonCodes: [REASON_CODE_OWNERSHIP_METADATA_CONFLICT],
    }),
  ];
  const ownershipStateFile = existingStatePack.files.find(
    (file) => file.relative_path === OWNERSHIP_FILE,
  );
  if (!ownershipStateFile) {
    errors.push(`ownership-mismatch:${existingStatePack.id}:${OWNERSHIP_FILE}: missing from receipt`);
    operations.push(
      buildUpdateBlockedOperation({
        packId: existingStatePack.id,
        installDir: existingStatePack.install_dir,
        relativePath: OWNERSHIP_FILE,
        ownership: "pairslash",
        reason: "ownership metadata missing from install receipt",
        reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
        remediationActions,
      }),
    );
    return false;
  }

  if (!ownershipStateFile.owned_by_pairslash) {
    errors.push(`ownership-mismatch:${existingStatePack.id}:${OWNERSHIP_FILE}: unmanaged`);
    operations.push(
      buildUpdateBlockedOperation({
        packId: existingStatePack.id,
        installDir: existingStatePack.install_dir,
        relativePath: OWNERSHIP_FILE,
        absolutePath: ownershipStateFile.absolute_path,
        ownership: "user",
        reason: "ownership metadata is not PairSlash-owned and blocks update",
        reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
        remediationActions,
      }),
    );
    return false;
  }

  if (!exists(ownershipStateFile.absolute_path)) {
    errors.push(`ownership-mismatch:${existingStatePack.id}:${OWNERSHIP_FILE}: missing on disk`);
    operations.push(
      buildUpdateBlockedOperation({
        packId: existingStatePack.id,
        installDir: existingStatePack.install_dir,
        relativePath: OWNERSHIP_FILE,
        absolutePath: ownershipStateFile.absolute_path,
        ownership: "pairslash",
        reason: "ownership metadata file is missing and blocks update",
        reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
        remediationActions,
      }),
    );
    return false;
  }

  const digest = safeCurrentDigest(ownershipStateFile.absolute_path);
  if (!digest.ok) {
    errors.push(`ownership-mismatch:${existingStatePack.id}:${OWNERSHIP_FILE}: ${digest.error}`);
    operations.push(
      buildUpdateBlockedOperation({
        packId: existingStatePack.id,
        installDir: existingStatePack.install_dir,
        relativePath: OWNERSHIP_FILE,
        absolutePath: ownershipStateFile.absolute_path,
        ownership: "pairslash",
        reason: `ownership metadata file is unreadable: ${digest.error}`,
        reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
        remediationActions,
      }),
    );
    return false;
  }

  if (digest.digest !== ownershipStateFile.current_digest) {
    errors.push(`ownership-mismatch:${existingStatePack.id}:${OWNERSHIP_FILE}: modified`);
    operations.push(
      buildUpdateBlockedOperation({
        packId: existingStatePack.id,
        installDir: existingStatePack.install_dir,
        relativePath: OWNERSHIP_FILE,
        absolutePath: ownershipStateFile.absolute_path,
        ownership: "pairslash",
        reason: "ownership metadata file was modified locally and blocks update",
        reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
        remediationActions,
      }),
    );
    return false;
  }

  return true;
}

export function buildUpdateOperations({
  repoRoot,
  target,
  adapter,
  skillRoot,
  emit = "skill",
  state,
  compiledPacks,
  selectedPackIds,
  warnings,
  errors,
}: any) {
  const operations = [];
  const installRoot = resolveInstallRootForEmit(adapter, { repoRoot, target, skillRoot, emit });

  for (const packId of selectedPackIds) {
    const existingStatePack = findStatePack(state, packId);
    if (!existingStatePack) {
      operations.push(
        buildOperation("blocked_conflict", {
          packId,
          relativePath: ".",
          absolutePath: buildPackInstallDir(adapter, repoRoot, target, packId, skillRoot, emit),
          ownership: "unmanaged",
          reason: "pack is not managed by PairSlash; run install instead",
          reasonCode: REASON_CODE_UPDATE_CONFLICT,
          remediationActions: [
            buildPreviewInstallAction({
              runtime: state.runtime,
              target: state.target,
              packId,
              preferred: true,
            }),
          ],
        }),
      );
      continue;
    }
    const boundaryIssue = inspectInstallDirBoundary({
      installRoot,
      installDir: existingStatePack.install_dir,
    });
    if (boundaryIssue) {
      errors.push(`update-install-dir-untrusted:${packId}: ${boundaryIssue.reason}`);
      operations.push(
        buildUpdateBlockedOperation({
          packId,
          installDir: existingStatePack.install_dir,
          reason: `${boundaryIssue.reason}: ${boundaryIssue.detail}`,
          reasonCode: REASON_CODE_UPDATE_CONFLICT,
          remediationActions: [
            buildPreviewUpdateAction({
              runtime: state.runtime,
              target: state.target,
              packId,
              preferred: true,
            }),
            buildReviewRemediationAction({
              actionId: `review-install-dir:${packId}`,
              summary: "Fix the managed install directory path before updating this pack.",
              path: existingStatePack.install_dir,
              appliesToActions: ["doctor", "update"],
              reasonCodes: [REASON_CODE_UPDATE_CONFLICT],
            }),
          ],
        }),
      );
      continue;
    }
    if (!validateManagedOwnershipFile({
      existingStatePack,
      errors,
      operations,
      runtime: state.runtime,
      target: state.target,
    })) {
      continue;
    }

    const compiledPack = compiledPacks.find((entry) => entry.pack_id === packId);
    if (!compiledPack) {
      operations.push(
        buildUpdateBlockedOperation({
          packId,
          installDir: existingStatePack.install_dir,
          reason: "target manifest could not be compiled for update",
        }),
      );
      continue;
    }

    const compiledPaths = new Set(compiledPack.files.map((file) => file.relative_path));
    for (const stateFile of existingStatePack.files) {
      if (compiledPaths.has(stateFile.relative_path)) {
        continue;
      }

      const digest = exists(stateFile.absolute_path) ? safeCurrentDigest(stateFile.absolute_path) : null;
      if (!stateFile.owned_by_pairslash) {
        operations.push(
          buildOperation("skip_unmanaged", {
            packId,
            relativePath: stateFile.relative_path,
            absolutePath: stateFile.absolute_path,
            assetKind: stateFile.asset_kind,
            installSurface: stateFile.install_surface,
            ownership: "user",
            overrideEligible: stateFile.override_eligible,
            reason: "file no longer exists upstream but was not created by PairSlash",
            reasonCode: stateFile.reconciled_reason_code ?? REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
            managementMode: stateFile.management_mode ?? "reconciled_unmanaged",
            remediationActions: [
              buildReviewRemediationAction({
                actionId: `review-unmanaged:${packId}:${stateFile.relative_path}`,
                summary: "Review the unmanaged file that PairSlash will continue to preserve.",
                path: stateFile.absolute_path,
                appliesToActions: ["doctor", "update", "uninstall"],
                reasonCodes: [stateFile.reconciled_reason_code ?? REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED],
              }),
            ],
          }),
        );
        continue;
      }

      if (!exists(stateFile.absolute_path)) {
        operations.push(
          buildOperation("blocked_conflict", {
            packId,
            relativePath: stateFile.relative_path,
            absolutePath: stateFile.absolute_path,
            assetKind: stateFile.asset_kind,
            installSurface: stateFile.install_surface,
            ownership: "pairslash",
            overrideEligible: stateFile.override_eligible,
            reason: "managed file is missing locally and blocks orphan cleanup",
            reasonCode: REASON_CODE_UPDATE_CONFLICT,
            remediationActions: [
              buildPreviewUpdateAction({
                runtime: state.runtime,
                target: state.target,
                packId,
                preferred: true,
              }),
            ],
          }),
        );
        continue;
      }

      if (!digest.ok) {
        operations.push(
          buildOperation("blocked_conflict", {
            packId,
            relativePath: stateFile.relative_path,
            absolutePath: stateFile.absolute_path,
            assetKind: stateFile.asset_kind,
            installSurface: stateFile.install_surface,
            ownership: "pairslash",
            overrideEligible: stateFile.override_eligible,
            reason: `existing path is not a writable file: ${digest.error}`,
            reasonCode: REASON_CODE_UPDATE_CONFLICT,
            remediationActions: [
              buildPreviewUpdateAction({
                runtime: state.runtime,
                target: state.target,
                packId,
                preferred: true,
              }),
            ],
          }),
        );
        continue;
      }

      if (digest.digest === stateFile.current_digest) {
        operations.push(
          buildOperation("remove", {
            packId,
            relativePath: stateFile.relative_path,
            absolutePath: stateFile.absolute_path,
            assetKind: stateFile.asset_kind,
            installSurface: stateFile.install_surface,
            ownership: "pairslash",
            overrideEligible: stateFile.override_eligible,
            reason: "managed file removed because it no longer exists in compiled pack",
          }),
        );
        continue;
      }

      if (stateFile.override_eligible) {
        warnings.push(`preserve-override:${packId}/${stateFile.relative_path}: orphaned local override preserved`);
        operations.push(
          buildOperation("preserve_override", {
            packId,
            relativePath: stateFile.relative_path,
            absolutePath: stateFile.absolute_path,
            assetKind: stateFile.asset_kind,
            installSurface: stateFile.install_surface,
            ownership: "pairslash",
            overrideEligible: stateFile.override_eligible,
            reason: "orphaned override-eligible file was edited locally and is preserved",
            reasonCode: REASON_CODE_MANAGED_ORPHAN_OVERRIDE,
            remediationActions: [
              buildPreviewUpdateAction({
                runtime: state.runtime,
                target: state.target,
                packId,
                preferred: true,
              }),
            ],
          }),
        );
        continue;
      }

      operations.push(
        buildOperation("blocked_conflict", {
          packId,
          relativePath: stateFile.relative_path,
          absolutePath: stateFile.absolute_path,
          assetKind: stateFile.asset_kind,
          installSurface: stateFile.install_surface,
          ownership: "pairslash",
          overrideEligible: stateFile.override_eligible,
          reason: "orphaned non-override managed file was modified locally and blocks update",
          reasonCode: REASON_CODE_UPDATE_CONFLICT,
          remediationActions: [
            buildPreviewUpdateAction({
              runtime: state.runtime,
              target: state.target,
              packId,
              preferred: true,
            }),
          ],
        }),
      );
    }

    for (const file of compiledPack.files) {
      const absolutePath = join(existingStatePack.install_dir, file.relative_path);
      const stateFile = existingStatePack.files.find((entry) => entry.relative_path === file.relative_path);
      const ownership = stateFile
        ? stateFile.owned_by_pairslash
          ? "pairslash"
          : "user"
        : "unmanaged";

      if (file.relative_path === OWNERSHIP_FILE && !stateFile) {
        operations.push(
          buildOperation("blocked_conflict", {
            packId,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership,
            overrideEligible: file.override_eligible,
            reason: "ownership metadata is not tracked in receipt and blocks update",
            reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
            remediationActions: [
              buildPreviewUpdateAction({
                runtime: state.runtime,
                target: state.target,
                packId,
                preferred: true,
              }),
            ],
          }),
        );
        continue;
      }

      if (!exists(absolutePath)) {
        if (file.relative_path === OWNERSHIP_FILE) {
          operations.push(
            buildOperation("blocked_conflict", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "ownership metadata file is missing and blocks update",
              reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
              remediationActions: [
                buildPreviewUpdateAction({
                  runtime: state.runtime,
                  target: state.target,
                  packId,
                  preferred: true,
                }),
              ],
            }),
          );
          continue;
        }
        operations.push(
          buildOperation("create", {
            packId,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "pairslash",
            overrideEligible: file.override_eligible,
            reason: "compiled file missing from target install dir",
          }),
        );
        continue;
      }

      const digest = safeCurrentDigest(absolutePath);
      if (!digest.ok) {
        operations.push(
          buildOperation("blocked_conflict", {
            packId,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership,
            overrideEligible: file.override_eligible,
            reason: `existing path is not a writable file: ${digest.error}`,
            reasonCode: REASON_CODE_UPDATE_CONFLICT,
            remediationActions: [
              buildPreviewUpdateAction({
                runtime: state.runtime,
                target: state.target,
                packId,
                preferred: true,
              }),
            ],
          }),
        );
        continue;
      }

      if (digest.digest === file.sha256) {
        if (stateFile?.owned_by_pairslash === false) {
          operations.push(
            buildOperation("reconcile_unmanaged", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "unmanaged file already matches compiled artifact",
              reasonCode: REASON_CODE_RECONCILE_IDENTICAL,
              managementMode: "reconciled_unmanaged",
              reconcileMode: "identical",
              remediationActions: [
                buildPreviewUpdateAction({
                  runtime: state.runtime,
                  target: state.target,
                  packId,
                  preferred: true,
                }),
              ],
            }),
          );
          continue;
        }
        operations.push(
          buildOperation("skip_identical", {
            packId,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership,
            overrideEligible: file.override_eligible,
            reason: "existing file already matches compiled artifact",
          }),
        );
        continue;
      }

      if (!stateFile) {
        if (file.override_eligible) {
          warnings.push(`preserve-override:${packId}/${file.relative_path}: existing unmanaged file preserved`);
          operations.push(
            buildOperation("reconcile_unmanaged", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "existing unmanaged file preserved as local override",
              reasonCode: REASON_CODE_RECONCILE_OVERRIDE,
              managementMode: "reconciled_unmanaged",
              reconcileMode: "override_preserved",
              remediationActions: [
                buildPreviewUpdateAction({
                  runtime: state.runtime,
                  target: state.target,
                  packId,
                  preferred: true,
                }),
              ],
            }),
          );
        } else {
          operations.push(
            buildOperation("blocked_conflict", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "unmanaged conflicting file blocks update",
              reasonCode: REASON_CODE_UNMANAGED_CONFLICT,
              remediationActions: [
                buildPreviewInstallAction({
                  runtime: state.runtime,
                  target: state.target,
                  packId,
                  preferred: true,
                }),
              ],
            }),
          );
        }
        continue;
      }

      if (!stateFile.owned_by_pairslash) {
        if (file.override_eligible) {
          warnings.push(`preserve-override:${packId}/${file.relative_path}: existing unmanaged file preserved`);
          operations.push(
            buildOperation("reconcile_unmanaged", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "existing unmanaged file preserved as local override",
              reasonCode: REASON_CODE_RECONCILE_OVERRIDE,
              managementMode: "reconciled_unmanaged",
              reconcileMode: "override_preserved",
              remediationActions: [
                buildPreviewUpdateAction({
                  runtime: state.runtime,
                  target: state.target,
                  packId,
                  preferred: true,
                }),
              ],
            }),
          );
        } else {
          operations.push(
            buildOperation("blocked_conflict", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "unmanaged conflicting file blocks update",
              reasonCode: REASON_CODE_UNMANAGED_CONFLICT,
              remediationActions: [
                buildPreviewInstallAction({
                  runtime: state.runtime,
                  target: state.target,
                  packId,
                  preferred: true,
                }),
              ],
            }),
          );
        }
        continue;
      }

      if (digest.digest === stateFile.current_digest) {
        operations.push(
          buildOperation("replace", {
            packId,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "pairslash",
            overrideEligible: file.override_eligible,
            reason: "upstream compiled artifact changed and local file still matches last managed digest",
          }),
        );
        continue;
      }

      if (file.override_eligible) {
        warnings.push(`preserve-override:${packId}/${file.relative_path}: valid local override preserved`);
        operations.push(
          buildOperation("preserve_override", {
            packId,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "pairslash",
            overrideEligible: file.override_eligible,
            reason: "valid local override preserved during update",
            reasonCode: REASON_CODE_MANAGED_OVERRIDE,
            remediationActions: [
              buildPreviewUpdateAction({
                runtime: state.runtime,
                target: state.target,
                packId,
                preferred: true,
              }),
            ],
          }),
        );
        continue;
      }

      operations.push(
        buildOperation("blocked_conflict", {
          packId,
          relativePath: file.relative_path,
          absolutePath,
          assetKind: file.asset_kind,
          installSurface: file.install_surface,
          ownership: "pairslash",
          overrideEligible: file.override_eligible,
          reason: "local modification on non-override file blocks update",
          reasonCode: REASON_CODE_UPDATE_CONFLICT,
          remediationActions: [
            buildPreviewUpdateAction({
              runtime: state.runtime,
              target: state.target,
              packId,
              preferred: true,
            }),
          ],
        }),
      );
    }
  }

  return operations;
}

export function planUpdate({
  repoRoot,
  runtime,
  target = "repo",
  packs = [],
  from = null,
  to = null,
  skillRoot = "runtime-default",
  emit = "skill",
}) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedEmit = normalizeEmitMode(emit);
  const normalizedSkillRoot =
    normalizedEmit === "plugin" ? "runtime-default" : normalizeSkillRoot(skillRoot);
  const runtimeSelection = detectRuntimeSelection(runtime);
  if (runtimeSelection.ambiguous) {
    throw new Error(
      runtime === "auto"
        ? runtimeSelection.candidates.length === 0
          ? "runtime-unavailable:auto: no supported runtime detected"
          : `runtime-ambiguous: detected ${runtimeSelection.candidates.join(", ")}`
        : `unsupported runtime: ${runtime}`,
    );
  }

  const normalizedRuntime = normalizeRuntime(runtimeSelection.runtime ?? runtime);
  const adapter = runtimeSelection.adapter ?? getRuntimeAdapter(normalizedRuntime);
  const warnings = [];
  const errors = [];
  const reasonCodes = [];
  const remediationActions = [];

  if (!runtimeSelection.detection?.available) {
    errors.push(
      `runtime-unavailable:${normalizedRuntime}: ${
        runtimeSelection.detection?.error ?? "runtime not detected"
      }`,
    );
  }

  if (normalizedEmit === "plugin") {
    if (normalizedTarget !== "repo") {
      errors.push(
        `emit-plugin-user-scope: plugin installs place bundle files under repo-scope plugin directories only; for user scope use the runtime's plugin surface (codex plugin add / copilot plugin install)`,
      );
    }
    warnings.push(
      `emit-plugin-manual-activation: PairSlash places plugin bundle files only; enable the plugin through the runtime's plugin surface (copilot plugin install <path> / codex plugin marketplace add + codex plugin add). Runtime settings files are never modified`,
    );
  }

  const { statePath, state, installRoot, journalDir } = resolveUpdateEnvironment({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    errors,
    reasonCodes,
    remediationActions,
  });

  const { selectedPackIds, selection } = resolveUpdateSelection({
    repoRoot,
    state,
    requestedPacks: packs,
    to,
    errors,
  });

  for (const packId of selectedPackIds) {
    const statePack = findStatePack(state, packId);
    if (!statePack || !from) {
      continue;
    }
    if (!isVersionOrDigestMatch(from, statePack)) {
      errors.push(`from-mismatch:${packId}: expected ${from} got ${statePack.version}/${statePack.manifest_digest}`);
    }
  }

  for (const packId of selectedPackIds) {
    const statePack = findStatePack(state, packId);
    const manifestEntry = findManifestEntry(selection, packId);
    if (!statePack || !manifestEntry) {
      continue;
    }
    const { manifest } = manifestEntry;
    if (!manifest.install_targets.includes(normalizedTarget)) {
      errors.push(`target-unsupported:${packId}:${normalizedTarget}`);
    }
    if (!manifest.runtime_targets?.[normalizedRuntime]) {
      errors.push(`runtime-mismatch:${packId}:${normalizedRuntime}`);
    }
    if (
      runtimeSelection.detection?.available &&
      !satisfiesRuntimeRange(
        runtimeSelection.detection.version,
        manifest.supported_runtime_ranges?.[normalizedRuntime],
      )
    ) {
      errors.push(
        `runtime-version-unsupported:${packId}: expected ${manifest.supported_runtime_ranges?.[normalizedRuntime]} got ${runtimeSelection.detection.version}`,
      );
    }
    runRequiredToolChecks(manifest, errors);
  }
  const lintReport =
    errors.length === 0
      ? applyLintPreflight({
          repoRoot,
          packs: selection.map((entry) => entry.manifest.pack.id),
          runtime: normalizedRuntime,
          target: normalizedTarget,
          errors,
          warnings,
        })
      : null;

  const compiledPacks =
    errors.length === 0
      ? compileSelection({
          repoRoot,
          runtime: normalizedRuntime,
          selection,
          errors,
          emit: normalizedEmit,
        })
      : [];
  const candidateTrustReceipts =
    errors.length === 0
      ? buildCandidateTrustReceipts({
          repoRoot,
          selection,
          compiledPacks,
          state,
          warnings,
          errors,
        })
      : new Map();

  const operations = buildUpdateOperations({
    repoRoot,
    target: normalizedTarget,
    adapter,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    state,
    compiledPacks,
    selectedPackIds,
    warnings,
    errors,
    reasonCodes,
    remediationActions,
  });

  if (selectedPackIds.length > 0) {
    operations.push(
      buildOperation("write_state", {
        packId: SYSTEM_PACK_ID,
        absolutePath: statePath,
        ownership: "system",
        reason: "install state will be updated after successful apply",
      }),
    );
    operations.push(
      buildOperation("write_journal", {
        packId: SYSTEM_PACK_ID,
        absolutePath: journalDir,
        ownership: "system",
        reason: "transaction journal will be created during apply",
      }),
    );
  }

  const plan = createPlan({
    action: "update",
    runtime: normalizedRuntime,
    target: normalizedTarget,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    installRoot,
    statePath,
    operations,
    selectedPacks: selectedPackIds,
    lintReport,
    trustDelta:
      candidateTrustReceipts.size > 0
        ? buildTrustDelta({
            state,
            candidateReceipts: candidateTrustReceipts,
            selectedPackIds,
          })
        : null,
    warnings,
    errors,
  });
  return {
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    adapter,
    detection: runtimeSelection.detection,
    statePath,
    state,
    lintReport,
    compiledPacks,
    candidateTrustReceipts,
    plan,
  };
}

export function applyUpdate(envelope) {
  if (!envelope.plan.can_apply) {
    throw new Error("update plan contains blocked conflicts");
  }
  return applyMutationWithRollback(envelope, "update");
}
