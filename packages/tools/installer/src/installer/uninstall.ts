import {
  getRuntimeAdapter,
} from "../runtime.ts";
import {
  buildReviewRemediationAction,
} from "../semantics.ts";
import {
  findStatePack,
} from "../state.ts";
import {
  exists,
  normalizeEmitMode,
  normalizeSkillRoot,
  normalizeTarget,
  relativeFrom,
  walkFiles,
} from "@pairslash/spec-core";
import {
  inspectInstallDirBoundary,
  resolveUninstallRuntime,
  resolveUpdateEnvironment,
} from "./environment.ts";
import {
  REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
  REASON_CODE_UNMANAGED_CONFLICT,
  SYSTEM_PACK_ID,
  applyMutationWithRollback,
  safeCurrentDigest,
  safeLstat,
} from "./helpers.ts";
import {
  buildOperation,
  createPlan,
} from "./plan.ts";
import {
  buildStateAfterUninstall,
} from "./state.ts";

export function buildUninstallOperations({ selectedPacks, warnings, installRoot }: { selectedPacks: any[]; warnings: string[]; installRoot: string }) {
  const operations: any[] = [];

  for (const pack of selectedPacks) {
    const boundaryIssue = inspectInstallDirBoundary({
      installRoot,
      installDir: pack.install_dir,
    });
    if (boundaryIssue) {
      operations.push(
        buildOperation("blocked_conflict", {
          packId: pack.id,
          relativePath: ".",
          absolutePath: pack.install_dir,
          ownership: "unmanaged",
          reason: `${boundaryIssue.reason}: ${boundaryIssue.detail}`,
          reasonCode: REASON_CODE_UNMANAGED_CONFLICT,
          remediationActions: [
            buildReviewRemediationAction({
              actionId: `review-install-dir:${pack.id}`,
              summary: "Fix the unmanaged install directory path before uninstalling this pack.",
              path: pack.install_dir,
              appliesToActions: ["doctor", "uninstall"],
              reasonCodes: [REASON_CODE_UNMANAGED_CONFLICT],
              preferred: true,
            }),
          ],
        }),
      );
      continue;
    }
    const trackedPaths = new Set(pack.files.map((file: any) => file.absolute_path));
    let containerRetained = false;

    for (const file of pack.files) {
      if (!file.owned_by_pairslash) {
        containerRetained = true;
        operations.push(
          buildOperation("skip_unmanaged", {
            packId: pack.id,
            relativePath: file.relative_path,
            absolutePath: file.absolute_path,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "user",
            overrideEligible: file.override_eligible,
            reason: "file preserved because PairSlash did not create it",
            reasonCode: file.reconciled_reason_code ?? REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
            managementMode: file.management_mode ?? "reconciled_unmanaged",
            remediationActions: [
              buildReviewRemediationAction({
                actionId: `review-unmanaged:${pack.id}:${file.relative_path}`,
                summary: "Review the unmanaged file that uninstall will preserve.",
                path: file.absolute_path,
                appliesToActions: ["doctor", "uninstall"],
                reasonCodes: [file.reconciled_reason_code ?? REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED],
              }),
            ],
          }),
        );
        continue;
      }

      if (!exists(file.absolute_path)) {
        warnings.push(`orphan-missing:${pack.id}/${file.relative_path}: tracked file already absent on disk`);
        operations.push(
          buildOperation("skip_unmanaged", {
            packId: pack.id,
            relativePath: file.relative_path,
            absolutePath: file.absolute_path,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "pairslash",
            overrideEligible: file.override_eligible,
            reason: "tracked managed file already missing; uninstall will detach receipt only",
          }),
        );
        continue;
      }

      const digest = safeCurrentDigest(file.absolute_path);
      if (!digest.ok) {
        containerRetained = true;
        warnings.push(`detach-unknown:${pack.id}/${file.relative_path}: managed path is not a regular readable file`);
        operations.push(
          buildOperation("skip_unmanaged", {
            packId: pack.id,
            relativePath: file.relative_path,
            absolutePath: file.absolute_path,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "pairslash",
            overrideEligible: file.override_eligible,
            reason: "managed path is not a regular readable file and will be preserved",
          }),
        );
        continue;
      }

      if (digest.digest !== file.current_digest) {
        containerRetained = true;
        warnings.push(`detach-preserved:${pack.id}/${file.relative_path}: local edits detected; file will be kept`);
        operations.push(
          buildOperation("skip_unmanaged", {
            packId: pack.id,
            relativePath: file.relative_path,
            absolutePath: file.absolute_path,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: "pairslash",
            overrideEligible: file.override_eligible,
            reason: "local edits detected; file will be preserved and detached",
          }),
        );
        continue;
      }

      operations.push(
        buildOperation("remove", {
          packId: pack.id,
          relativePath: file.relative_path,
          absolutePath: file.absolute_path,
          assetKind: file.asset_kind,
          installSurface: file.install_surface,
          ownership: "pairslash",
          overrideEligible: file.override_eligible,
          reason: "PairSlash-managed unchanged file scheduled for removal",
        }),
      );
    }

    if (exists(pack.install_dir)) {
      const installDirStat = safeLstat(pack.install_dir);
      if (!installDirStat.ok || !installDirStat.stat?.isDirectory()) {
        containerRetained = true;
        warnings.push(`orphan-root-invalid:${pack.id}: install root is not a directory and will be preserved`);
        operations.push(
          buildOperation("skip_unmanaged", {
            packId: pack.id,
            relativePath: ".",
            absolutePath: pack.install_dir,
            ownership: "unmanaged",
            reason: "pack install root is not a directory and will be preserved",
            reasonCode: REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
          }),
        );
      } else {
        const unknownFiles = walkFiles(pack.install_dir).filter((absolutePath: any) => !trackedPaths.has(absolutePath));
        for (const absolutePath of unknownFiles) {
          containerRetained = true;
          const relativePath = relativeFrom(pack.install_dir, absolutePath);
          warnings.push(`orphan-unknown:${pack.id}/${relativePath}: unknown file preserved`);
          operations.push(
            buildOperation("skip_unmanaged", {
              packId: pack.id,
              relativePath,
              absolutePath,
              ownership: "unmanaged",
              reason: "unknown file under pack install dir preserved",
              reasonCode: REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED,
            }),
          );
        }
      }
    }

    if (containerRetained && exists(pack.install_dir)) {
      operations.push(
        buildOperation("skip_unmanaged", {
          packId: pack.id,
          relativePath: ".",
          absolutePath: pack.install_dir,
          ownership: "system",
          reason: "container directory retained because preserved or unknown files remain",
        }),
      );
    }
  }

  return operations;
}

export function planUninstall({ repoRoot, runtime, target = "repo", packs = [], skillRoot = "runtime-default", emit = "skill" }: { repoRoot: string; runtime?: string; target?: any; packs?: any; skillRoot?: any; emit?: string }) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedEmit = normalizeEmitMode(emit);
  const normalizedSkillRoot =
    normalizedEmit === "plugin" ? "runtime-default" : normalizeSkillRoot(skillRoot);
  const normalizedRuntime = resolveUninstallRuntime(runtime, repoRoot, normalizedTarget, normalizedSkillRoot, normalizedEmit);
  const adapter = getRuntimeAdapter(normalizedRuntime);
  const warnings: string[] = [];
  const errors: string[] = [];
  const reasonCodes: any[] = [];
  const remediationActions: any[] = [];

  if (normalizedEmit === "plugin" && normalizedTarget !== "repo") {
    errors.push(
      `emit-plugin-user-scope: plugin installs place bundle files under repo-scope plugin directories only; for user scope use the runtime's plugin surface (codex plugin add / copilot plugin install)`,
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

  for (const requestedPack of packs) {
    if (!findStatePack(state, requestedPack)) {
      errors.push(`pack-not-installed:${requestedPack}`);
    }
  }

  const selected = packs.length > 0 ? state.packs.filter((pack: any) => packs.includes(pack.id)) : state.packs;
  const operations = buildUninstallOperations({
    selectedPacks: selected,
    warnings,
    installRoot,
  });

  if (selected.length > 0) {
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
    action: "uninstall",
    runtime: normalizedRuntime,
    target: normalizedTarget,
    skillRoot: normalizedSkillRoot,
    emit: normalizedEmit,
    installRoot,
    statePath,
    operations,
    selectedPacks: selected.map((pack: any) => pack.id),
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
    detection: null,
    statePath,
    state,
    compiledPacks: [],
    plan,
  };
}

export function applyUninstall(envelope: any) {
  if (!envelope.plan.can_apply) {
    throw new Error("uninstall plan contains blocking errors");
  }
  return applyMutationWithRollback(envelope, "uninstall", buildStateAfterUninstall);
}
