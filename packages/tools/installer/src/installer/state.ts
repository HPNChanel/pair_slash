import {
  getRuntimeAdapter,
} from "../runtime.ts";
import {
  buildEmptyState,
  findStatePack,
  loadInstallState,
} from "../state.ts";
import {
  assessPackTrust,
  normalizeEmitMode,
  normalizeRuntime,
  normalizeSkillRoot,
  normalizeTarget,
} from "@pairslash/spec-core";
import {
  join,
} from "node:path";
import {
  buildPackInstallDir,
  cloneState,
  currentDigest,
  getPlannedOperation,
} from "./helpers.ts";

export function buildCandidateTrustReceipts({
  repoRoot,
  selection,
  compiledPacks,
  state,
  warnings,
  errors,
}: { repoRoot: string; selection?: any; compiledPacks?: any; state?: any; warnings: string[]; errors: string[] }) {
  const receipts = new Map();
  for (const { manifestPath, manifest } of selection) {
    const compiledPack = compiledPacks.find((entry: any) => entry.pack_id === manifest.pack.id);
    if (!compiledPack) {
      continue;
    }
    const currentStatePack = findStatePack(state, manifest.pack.id);
    const receipt = assessPackTrust({
      repoRoot,
      manifestPath,
      manifest,
      compiledPack,
      currentVersion: currentStatePack?.version ?? null,
    });
    receipts.set(manifest.pack.id, receipt);
    if (receipt.policy_action === "deny") {
      errors.push(`trust-denied:${manifest.pack.id}: ${receipt.summary}`);
    } else if (receipt.policy_action === "ask") {
      warnings.push(`trust-review:${manifest.pack.id}: ${receipt.summary}`);
    }
    if (receipt.version_policy?.blocking) {
      errors.push(`version-policy-block:${manifest.pack.id}: ${receipt.version_policy.summary}`);
    } else if (receipt.version_policy?.status === "warn") {
      warnings.push(`version-policy-warn:${manifest.pack.id}: ${receipt.version_policy.summary}`);
    }
  }
  return receipts;
}

export function buildStatePack({ compiledPack, installDir, operations, previousStatePack, trustReceipt = null, emit = "skill" }: { compiledPack?: any; installDir?: any; operations?: any; previousStatePack?: any; trustReceipt?: any; emit?: string }) {
  const timestamp = new Date().toISOString();
  const files = compiledPack.files.map((file: any) => {
    const absolutePath = join(installDir, file.relative_path);
    const op = getPlannedOperation(operations, compiledPack.pack_id, file.relative_path);
    const previousFile = previousStatePack?.files?.find(
      (entry: any) => entry.relative_path === file.relative_path,
    );
    const digest = currentDigest(absolutePath);
    const matchedCompiled = digest === file.sha256;
    const ownedByPairslash =
      op?.kind === "create" || op?.kind === "replace"
        ? file.owner === "pairslash"
        : previousFile
          ? previousFile.owned_by_pairslash
          : false;
    const managementMode =
      op?.management_mode ??
      previousFile?.management_mode ??
      (ownedByPairslash ? "pairslash_owned" : "reconciled_unmanaged");
    const reconciledReasonCode =
      op?.reason_code && managementMode === "reconciled_unmanaged"
        ? op.reason_code
        : previousFile?.reconciled_reason_code ?? null;
    return {
      asset_id: file.asset_id,
      generator: file.generator,
      required: file.required,
      declared_owner: file.owner,
      uninstall_behavior: file.uninstall_behavior,
      relative_path: file.relative_path,
      absolute_path: absolutePath,
      source_digest: file.sha256,
      current_digest: digest,
      owned_by_pairslash: ownedByPairslash,
      management_mode: managementMode,
      ...(reconciledReasonCode ? { reconciled_reason_code: reconciledReasonCode } : {}),
      override_eligible: file.override_eligible,
      local_override: !matchedCompiled,
      asset_kind: file.asset_kind,
      install_surface: file.install_surface,
      runtime_selector: file.runtime_selector,
      generated: file.generated,
      write_authority_guarded: file.write_authority_guarded,
      last_operation: op?.kind ?? null,
    };
  });
  return {
    id: compiledPack.pack_id,
    version: compiledPack.version,
    previous_version: previousStatePack?.version ?? null,
    install_mode: emit,
    install_dir: installDir,
    manifest_digest: compiledPack.manifest_digest,
    compiler_version: compiledPack.compiler_version,
    trust_receipt: trustReceipt,
    updated_at: timestamp,
    files,
  };
}

export function updateStateAfterWrite(envelope: any, transactionId: any = null) {
  const nextState = cloneState(envelope.state);
  for (const compiledPack of envelope.compiledPacks) {
    const installDir = buildPackInstallDir(
      envelope.adapter,
      envelope.repoRoot,
      envelope.target,
      compiledPack.pack_id,
      envelope.skillRoot,
      envelope.emit,
    );
    const previousStatePack = findStatePack(nextState, compiledPack.pack_id);
    const nextPack = buildStatePack({
      compiledPack,
      installDir,
      operations: envelope.plan.operations,
      previousStatePack,
      trustReceipt: envelope.candidateTrustReceipts?.get(compiledPack.pack_id) ?? null,
      emit: envelope.emit,
    });
    nextState.packs = nextState.packs.filter((pack: any) => pack.id !== compiledPack.pack_id);
    nextState.packs.push(nextPack);
  }
  nextState.packs.sort((a: any, b: any) => a.id.localeCompare(b.id));
  nextState.updated_at = new Date().toISOString();
  nextState.last_transaction_id = transactionId;
  return nextState;
}

export function buildStateAfterUninstall({ envelope, transactionId }: { envelope?: any; transactionId?: any }) {
  const nextState = cloneState(envelope.state);
  nextState.packs = nextState.packs.filter((pack: any) => !envelope.plan.selected_packs.includes(pack.id));
  nextState.updated_at = new Date().toISOString();
  nextState.last_transaction_id = transactionId;
  if (nextState.packs.length === 0) {
    const emptyState = buildEmptyState({
      repoRoot: envelope.repoRoot,
      runtime: envelope.runtime,
      target: envelope.target,
      adapter: envelope.adapter,
      skillRoot: envelope.skillRoot,
    });
    emptyState.updated_at = nextState.updated_at;
    emptyState.last_transaction_id = transactionId;
    return {
      state: emptyState,
      removeStateFile: true,
    };
  }
  return {
    state: nextState,
    removeStateFile: false,
  };
}

export function loadStateForDoctor({ repoRoot, runtime, target, skillRoot, emit = "skill" }: { repoRoot: string; runtime?: string; target?: any; skillRoot?: any; emit?: string }) {
  const normalizedRuntime = normalizeRuntime(runtime);
  const normalizedTarget = normalizeTarget(target);
  const normalizedSkillRoot = normalizeSkillRoot(skillRoot);
  const normalizedEmit = normalizeEmitMode(emit);
  const adapter = getRuntimeAdapter(normalizedRuntime);
  return loadInstallState({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    skillRoot: normalizedEmit === "plugin" ? "runtime-default" : normalizedSkillRoot,
    emit: normalizedEmit,
  });
}
