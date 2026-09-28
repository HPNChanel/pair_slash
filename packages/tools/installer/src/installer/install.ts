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
  resolveInstallEnvironment,
  runRequiredToolChecks,
} from "./environment.ts";
import {
  REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE,
  REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
  REASON_CODE_RECONCILE_IDENTICAL,
  REASON_CODE_RECONCILE_OVERRIDE,
  REASON_CODE_UNMANAGED_CONFLICT,
  SYSTEM_PACK_ID,
  applyMutationWithRollback,
  buildPackInstallDir,
  resolveInstallRootForEmit,
  safeCurrentDigest,
} from "./helpers.ts";
import {
  buildOperation,
  buildPreviewInstallAction,
  buildPreviewUpdateAction,
  compileSelection,
  createPlan,
  manifestSelection,
} from "./plan.ts";
import {
  buildCandidateTrustReceipts,
} from "./state.ts";

export function buildInstallOperations({
  repoRoot,
  target,
  adapter,
  skillRoot,
  emit = "skill",
  statePath,
  journalDir,
  state,
  compiledPacks,
  warnings,
}) {
  const operations = [];
  const mkdirs = new Set<string>();
  const installRoot = resolveInstallRootForEmit(adapter, { repoRoot, target, skillRoot, emit });

  for (const compiledPack of compiledPacks) {
    const installDir = buildPackInstallDir(adapter, repoRoot, target, compiledPack.pack_id, skillRoot, emit);
    const existingStatePack = findStatePack(state, compiledPack.pack_id);
    if (existingStatePack) {
      operations.push(
        buildOperation("blocked_conflict", {
          packId: compiledPack.pack_id,
          relativePath: ".",
          absolutePath: installDir,
          ownership: "pairslash",
          reason: "pack is already managed by PairSlash; run update instead of install",
          reasonCode: REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE,
          remediationActions: [
            buildPreviewUpdateAction({
              runtime: state.runtime,
              target: state.target,
              packId: compiledPack.pack_id,
              preferred: true,
            }),
          ],
        }),
      );
      continue;
    }
    const boundaryIssue = inspectInstallDirBoundary({
      installRoot,
      installDir,
    });
    if (boundaryIssue) {
      operations.push(
        buildOperation("blocked_conflict", {
          packId: compiledPack.pack_id,
          relativePath: ".",
          absolutePath: installDir,
          ownership: "unmanaged",
          reason: boundaryIssue.reason,
          reasonCode: REASON_CODE_UNMANAGED_CONFLICT,
          reasonDetail: boundaryIssue.detail,
          remediationActions: [
            buildPreviewInstallAction({
              runtime: state.runtime,
              target: state.target,
              packId: compiledPack.pack_id,
              preferred: true,
            }),
            buildReviewRemediationAction({
              actionId: `review-install-dir:${compiledPack.pack_id}`,
              summary: "Fix the unmanaged install directory path before installing this pack.",
              path: installDir,
              appliesToActions: ["doctor", "install"],
              reasonCodes: [REASON_CODE_UNMANAGED_CONFLICT],
            }),
          ],
        }),
      );
      continue;
    }
    if (!exists(installDir)) {
      mkdirs.add(`${compiledPack.pack_id}\u0000${installDir}`);
    }
    for (const file of compiledPack.files) {
      const absolutePath = join(installDir, file.relative_path);
      if (!exists(absolutePath)) {
        operations.push(
          buildOperation("create", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "pairslash",
            overrideEligible: file.override_eligible,
            reason: "missing target file",
          }),
        );
        continue;
      }
      if (file.relative_path === OWNERSHIP_FILE) {
        operations.push(
          buildOperation("blocked_conflict", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "unmanaged",
            overrideEligible: file.override_eligible,
            reason: "unmanaged ownership metadata exists; install must not take over receipt state",
            reasonCode: REASON_CODE_OWNERSHIP_METADATA_CONFLICT,
            remediationActions: [
              buildPreviewInstallAction({
                runtime: state.runtime,
                target: state.target,
                packId: compiledPack.pack_id,
                preferred: true,
              }),
              buildReviewRemediationAction({
                actionId: `review-ownership:${compiledPack.pack_id}`,
                summary: "Review or remove unmanaged ownership metadata before install.",
                path: absolutePath,
                appliesToActions: ["doctor", "install"],
                reasonCodes: [REASON_CODE_OWNERSHIP_METADATA_CONFLICT],
              }),
            ],
          }),
        );
        continue;
      }

      const digest = safeCurrentDigest(absolutePath);
      if (!digest.ok) {
        operations.push(
          buildOperation("blocked_conflict", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "unmanaged",
            overrideEligible: file.override_eligible,
            reason: `existing path is not a writable file: ${digest.error}`,
            reasonCode: REASON_CODE_UNMANAGED_CONFLICT,
            remediationActions: [
              buildPreviewInstallAction({
                runtime: state.runtime,
                target: state.target,
                packId: compiledPack.pack_id,
                preferred: true,
              }),
              buildReviewRemediationAction({
                actionId: `review-unmanaged:${compiledPack.pack_id}:${file.relative_path}`,
                summary: "Review or move the unmanaged path before installing.",
                path: absolutePath,
                appliesToActions: ["doctor", "install"],
                reasonCodes: [REASON_CODE_UNMANAGED_CONFLICT],
              }),
            ],
          }),
        );
        continue;
      }
      if (digest.digest === file.sha256) {
        operations.push(
          buildOperation("reconcile_unmanaged", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "user",
            overrideEligible: file.override_eligible,
            reason: "existing file already matches compiled artifact",
            reasonCode: REASON_CODE_RECONCILE_IDENTICAL,
            managementMode: "reconciled_unmanaged",
            reconcileMode: "identical",
            remediationActions: [
              buildPreviewInstallAction({
                runtime: state.runtime,
                target: state.target,
                packId: compiledPack.pack_id,
                preferred: true,
              }),
              buildReviewRemediationAction({
                actionId: `review-reconciled:${compiledPack.pack_id}:${file.relative_path}`,
                summary: "Leave the identical unmanaged file in place or move it before install.",
                path: absolutePath,
                appliesToActions: ["doctor", "install", "update", "uninstall"],
                reasonCodes: [REASON_CODE_RECONCILE_IDENTICAL],
              }),
            ],
          }),
        );
        continue;
      }
      if (file.override_eligible) {
        warnings.push(
          `preserve-override:${compiledPack.pack_id}/${file.relative_path}: existing content will be preserved`,
        );
        operations.push(
          buildOperation("reconcile_unmanaged", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "user",
            overrideEligible: file.override_eligible,
            reason: "existing unmanaged file preserved as local override",
            reasonCode: REASON_CODE_RECONCILE_OVERRIDE,
            managementMode: "reconciled_unmanaged",
            reconcileMode: "override_preserved",
            remediationActions: [
              buildPreviewInstallAction({
                runtime: state.runtime,
                target: state.target,
                packId: compiledPack.pack_id,
                preferred: true,
              }),
              buildReviewRemediationAction({
                actionId: `review-override:${compiledPack.pack_id}:${file.relative_path}`,
                summary: "Review the unmanaged local override before updating or uninstalling the pack.",
                path: absolutePath,
                appliesToActions: ["doctor", "install", "update", "uninstall"],
                reasonCodes: [REASON_CODE_RECONCILE_OVERRIDE],
              }),
            ],
          }),
        );
        continue;
      }
      operations.push(
        buildOperation("blocked_conflict", {
          packId: compiledPack.pack_id,
          relativePath: file.relative_path,
          absolutePath,
          assetKind: file.asset_kind,
          installSurface: file.install_surface,
          ownership: "unmanaged",
          overrideEligible: file.override_eligible,
          reason: "non-override file already exists and would be clobbered",
          reasonCode: REASON_CODE_UNMANAGED_CONFLICT,
          remediationActions: [
            buildPreviewInstallAction({
              runtime: state.runtime,
              target: state.target,
              packId: compiledPack.pack_id,
              preferred: true,
            }),
            buildReviewRemediationAction({
              actionId: `review-unmanaged:${compiledPack.pack_id}:${file.relative_path}`,
              summary: "Rename, remove, or move the unmanaged path before installing.",
              path: absolutePath,
              appliesToActions: ["doctor", "install"],
              reasonCodes: [REASON_CODE_UNMANAGED_CONFLICT],
            }),
          ],
        }),
      );
    }
  }

  for (const entry of mkdirs) {
    const [packId, absolutePath] = entry.split("\u0000");
    operations.push(
      buildOperation("mkdir", {
        packId,
        absolutePath,
        ownership: "system",
        reason: "install directory will be created",
      }),
    );
  }

  operations.push(
    buildOperation("write_state", {
      packId: SYSTEM_PACK_ID,
      absolutePath: statePath,
      ownership: "system",
      reason: "install state will be written after successful apply",
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

  return operations;
}

export function planInstall({ repoRoot, runtime = "auto", target = "repo", packs = [], skillRoot = "runtime-default", emit = "skill" }) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedEmit = normalizeEmitMode(emit);
  const requestedSkillRoot = normalizeSkillRoot(skillRoot);
  const normalizedSkillRoot = normalizedEmit === "plugin" ? "runtime-default" : requestedSkillRoot;
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
    if (requestedSkillRoot !== "runtime-default") {
      warnings.push(
        `emit-plugin-skill-root: --skill-root has no effect with --emit plugin; plugin layout owns its roots`,
      );
    }
    warnings.push(
      `emit-plugin-manual-activation: PairSlash places plugin bundle files only; enable the plugin through the runtime's plugin surface (copilot plugin install <path> / codex plugin marketplace add + codex plugin add). Runtime settings files are never modified`,
    );
  }

  const { statePath, state, installRoot, journalDir } = resolveInstallEnvironment({
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

  const { selection, errors: selectionErrors } = manifestSelection(repoRoot, packs);
  errors.push(...selectionErrors);

  for (const { manifest } of selection) {
    if (!manifest.install_targets.includes(normalizedTarget)) {
      errors.push(`target-unsupported:${manifest.pack.id}:${normalizedTarget}`);
    }
    if (!manifest.runtime_targets?.[normalizedRuntime]) {
      errors.push(`runtime-mismatch:${manifest.pack.id}:${normalizedRuntime}`);
    }
    if (
      runtimeSelection.detection?.available &&
      !satisfiesRuntimeRange(
        runtimeSelection.detection.version,
        manifest.supported_runtime_ranges?.[normalizedRuntime],
      )
    ) {
      errors.push(
        `runtime-version-unsupported:${manifest.pack.id}: expected ${manifest.supported_runtime_ranges?.[normalizedRuntime]} got ${runtimeSelection.detection.version}`,
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

  const operations = buildInstallOperations({
    repoRoot,
    target: normalizedTarget,
    adapter,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    statePath,
    journalDir,
    state,
    compiledPacks,
    warnings,
  });

  const plan = createPlan({
    action: "install",
    runtime: normalizedRuntime,
    target: normalizedTarget,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    installRoot,
    statePath,
    operations,
    selectedPacks: compiledPacks.map((pack) => pack.pack_id),
    lintReport,
    trustDelta:
      candidateTrustReceipts.size > 0
        ? buildTrustDelta({
            state,
            candidateReceipts: candidateTrustReceipts,
            selectedPackIds: compiledPacks.map((pack) => pack.pack_id),
          })
        : null,
    warnings,
    errors,
    reasonCodes,
    remediationActions,
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

export function applyInstall(envelope) {
  if (!envelope.plan.can_apply) {
    throw new Error("install plan contains blocking errors");
  }
  return applyMutationWithRollback(envelope, "install");
}
