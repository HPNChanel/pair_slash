import { readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import { runLintBridge } from "@pairslash/lint-bridge";
import {
  INSTALL_JOURNAL_DIR,
  INSTALL_JOURNAL_SCHEMA_VERSION,
  OWNERSHIP_FILE,
  PREVIEW_OPERATION_KINDS,
  PREVIEW_PLAN_SCHEMA_VERSION,
  SUPPORTED_RUNTIMES,
  ensureDir,
  exists,
  loadPackManifest,
  loadPackManifestRecords,
  normalizeRuntime,
  normalizeTarget,
  readFileNormalized,
  relativeFrom,
  selectPackManifestRecords,
  sha256,
  stableJson,
  validateInstallJournal,
  validatePreviewPlan,
  walkFiles,
  writeTextFile,
} from "@pairslash/spec-core";

import { getRuntimeAdapter, detectRuntimeSelection, satisfiesRuntimeRange } from "./runtime.js";
import {
  buildEmptyState,
  findStatePack,
  loadInstallState,
  removeInstallState,
  resolveStatePath,
  writeInstallState,
} from "./state.js";

const SYSTEM_PACK_ID = "_pairslash";

function compilePackForRuntime(options) {
  return options.runtime === "codex_cli"
    ? compileCodexPack(options)
    : compileCopilotPack(options);
}

function manifestSelection(repoRoot, requestedPacks = []) {
  const records = loadPackManifestRecords(repoRoot);
  const { valid, invalid, missing } = selectPackManifestRecords(records, requestedPacks);
  const errors = [];

  for (const record of invalid) {
    errors.push(`manifest-invalid:${record.packId}: ${record.error}`);
  }
  for (const packId of missing) {
    errors.push(`pack-not-found: ${packId}`);
  }

  return {
    selection: valid.map((record) => ({
      manifestPath: record.manifestPath,
      manifest: record.manifest,
    })),
    errors,
  };
}

function createSummary(operations) {
  const base = Object.fromEntries(PREVIEW_OPERATION_KINDS.map((kind) => [kind, 0]));
  for (const operation of operations) {
    base[operation.kind] += 1;
  }
  return base;
}

function sortOperations(operations) {
  return operations
    .slice()
    .sort((left, right) =>
      [
        left.pack_id ?? "",
        left.absolute_path ?? "",
        left.relative_path ?? "",
        left.kind ?? "",
      ]
        .join("\u0000")
        .localeCompare(
          [
            right.pack_id ?? "",
            right.absolute_path ?? "",
            right.relative_path ?? "",
            right.kind ?? "",
          ].join("\u0000"),
        ),
    );
}

function createPlan({
  action,
  runtime,
  target,
  installRoot,
  statePath,
  operations,
  selectedPacks,
  warnings = [],
  errors = [],
}) {
  const sortedOperations = sortOperations(operations);
  const plan = {
    kind: "preview-plan",
    schema_version: PREVIEW_PLAN_SCHEMA_VERSION,
    action,
    runtime,
    target,
    install_root: installRoot,
    state_path: statePath,
    can_apply:
      errors.length === 0 &&
      sortedOperations.every((operation) => operation.kind !== "blocked_conflict"),
    requires_confirmation: ["install", "update", "uninstall"].includes(action),
    selected_packs: selectedPacks.slice().sort((a, b) => a.localeCompare(b)),
    summary: createSummary(sortedOperations),
    warnings: warnings.slice().sort((a, b) => a.localeCompare(b)),
    errors: errors.slice().sort((a, b) => a.localeCompare(b)),
    operations: sortedOperations,
  };
  const validationErrors = validatePreviewPlan(plan);
  if (validationErrors.length > 0) {
    throw new Error(`invalid ${action} preview plan :: ${validationErrors.join("; ")}`);
  }
  return plan;
}

function buildOperation(
  kind,
  {
    packId,
    relativePath = null,
    absolutePath,
    reason,
    assetKind = null,
    installSurface = null,
    ownership = null,
    overrideEligible = null,
  },
) {
  return {
    kind,
    pack_id: packId,
    ...(relativePath ? { relative_path: relativePath } : {}),
    absolute_path: absolutePath,
    ...(assetKind ? { asset_kind: assetKind } : {}),
    ...(installSurface ? { install_surface: installSurface } : {}),
    ...(ownership ? { ownership } : {}),
    ...(typeof overrideEligible === "boolean" ? { override_eligible: overrideEligible } : {}),
    reason,
  };
}

function currentDigest(filePath) {
  const content = readFileNormalized(filePath);
  return sha256(typeof content === "string" ? content : content);
}

function safeCurrentDigest(filePath) {
  try {
    return { ok: true, digest: currentDigest(filePath) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function compileSelection({ repoRoot, runtime, selection, errors }) {
  const compiled = [];
  for (const { manifestPath, manifest } of selection) {
    try {
      compiled.push(
        compilePackForRuntime({
          repoRoot,
          manifestPath,
          runtime,
        }),
      );
    } catch (error) {
      errors.push(`compile-failed:${manifest.pack.id}: ${error.message}`);
    }
  }
  return compiled.sort((left, right) => left.pack_id.localeCompare(right.pack_id));
}

function buildPackInstallDir(adapter, repoRoot, target, packId) {
  return adapter.resolvePackInstallDir({ repoRoot, target }, packId);
}

function getPlannedOperation(operations, packId, relativePath) {
  return (
    operations.find(
      (operation) =>
        operation.pack_id === packId && operation.relative_path === relativePath,
    ) ?? null
  );
}

function buildStatePack({ compiledPack, installDir, operations, previousStatePack }) {
  const timestamp = new Date().toISOString();
  const files = compiledPack.files.map((file) => {
    const absolutePath = join(installDir, file.relative_path);
    const op = getPlannedOperation(operations, compiledPack.pack_id, file.relative_path);
    const previousFile = previousStatePack?.files?.find(
      (entry) => entry.relative_path === file.relative_path,
    );
    const digest = currentDigest(absolutePath);
      const matchedCompiled = digest === file.sha256;
      const ownedByPairslash =
        op?.kind === "create" || op?.kind === "replace"
          ? file.owner === "pairslash"
          : previousFile
            ? previousFile.owned_by_pairslash
            : false;
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
    install_dir: installDir,
    manifest_digest: compiledPack.manifest_digest,
    compiler_version: compiledPack.compiler_version,
    updated_at: timestamp,
    files,
  };
}

function applyWriteOperations(envelope) {
  for (const compiledPack of envelope.compiledPacks) {
    const installDir = buildPackInstallDir(
      envelope.adapter,
      envelope.repoRoot,
      envelope.target,
      compiledPack.pack_id,
    );
    ensureDir(installDir);
    for (const file of compiledPack.files) {
      const operation = getPlannedOperation(
        envelope.plan.operations,
        compiledPack.pack_id,
        file.relative_path,
      );
      if (!operation || !["create", "replace"].includes(operation.kind)) {
        continue;
      }
      writeTextFile(join(installDir, file.relative_path), file.content);
    }
  }
}

function updateStateAfterWrite(envelope, transactionId = null) {
  const nextState = cloneState(envelope.state);
  for (const compiledPack of envelope.compiledPacks) {
    const installDir = buildPackInstallDir(
      envelope.adapter,
      envelope.repoRoot,
      envelope.target,
      compiledPack.pack_id,
    );
    const previousStatePack = findStatePack(nextState, compiledPack.pack_id);
    const nextPack = buildStatePack({
      compiledPack,
      installDir,
      operations: envelope.plan.operations,
      previousStatePack,
    });
    nextState.packs = nextState.packs.filter((pack) => pack.id !== compiledPack.pack_id);
    nextState.packs.push(nextPack);
  }
  nextState.packs.sort((a, b) => a.id.localeCompare(b.id));
  nextState.updated_at = new Date().toISOString();
  nextState.last_transaction_id = transactionId;
  return nextState;
}

function findCompiledFile(compiledPack, relativePath) {
  return compiledPack.files.find((file) => file.relative_path === relativePath) ?? null;
}

function findManifestEntry(selection, packId) {
  return selection.find((entry) => entry.manifest.pack.id === packId) ?? null;
}

function isVersionOrDigestMatch(value, statePack) {
  return value === statePack.version || value === statePack.manifest_digest;
}

function findExistingParentPath(path) {
  let current = resolve(path);
  while (!exists(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
  return current;
}

function runRequiredToolChecks(manifest, errors) {
  for (const tool of manifest.required_tools ?? []) {
    if (!tool.required_for?.includes("install")) {
      continue;
    }
    const result = spawnSync(tool.check_command, {
      shell: true,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      errors.push(
        `missing-tool:${manifest.pack.id}:${tool.id}: ${
          result.stderr?.trim() || result.stdout?.trim() || "tool check failed"
        }`,
      );
    }
  }
}

function applyLintPreflight({ repoRoot, packs, runtime, target, errors, warnings }) {
  if (packs.length === 0) {
    return null;
  }
  const report = runLintBridge({
    repoRoot,
    packs,
    runtime,
    target,
  });
  for (const issue of report.issues) {
    if (issue.result === "error") {
      errors.push(
        `lint-error:${issue.code}:${issue.pack_id ?? "global"}:${issue.runtime}: ${issue.message}`,
      );
      continue;
    }
    if (issue.result === "warning") {
      warnings.push(
        `lint-warning:${issue.code}:${issue.pack_id ?? "global"}:${issue.runtime}: ${issue.message}`,
      );
    }
  }
  return report;
}

function resolveInstallEnvironment({ repoRoot, runtime, target, adapter, errors }) {
  let state;
  let statePath;
  try {
    const loaded = loadInstallState({ repoRoot, runtime, target, adapter });
    state = loaded.state;
    statePath = loaded.statePath;
  } catch (error) {
    errors.push(`state-invalid: ${error.message}`);
    statePath = resolveStatePath({ repoRoot, runtime, target });
    state = buildEmptyState({ repoRoot, runtime, target, adapter });
  }

  const installRoot = adapter.resolveInstallRoot({ repoRoot, target });
  const journalDir = resolve(repoRoot, ".pairslash", INSTALL_JOURNAL_DIR);
  const permissionTargets = [
    findExistingParentPath(installRoot),
    findExistingParentPath(dirname(statePath)),
    findExistingParentPath(journalDir),
  ];
  for (const permissionTarget of permissionTargets) {
    const permission = adapter.checkWritablePath(permissionTarget);
    if (!permission.writable) {
      errors.push(`permission-denied:${permissionTarget}: ${permission.error}`);
    }
  }

  return {
    state,
    statePath,
    installRoot,
    journalDir,
  };
}

function resolveUpdateEnvironment({ repoRoot, runtime, target, adapter, errors }) {
  const installRoot = adapter.resolveInstallRoot({ repoRoot, target });
  const configHome = adapter.resolveConfigHome({ repoRoot, target });
  const journalDir = resolve(repoRoot, ".pairslash", INSTALL_JOURNAL_DIR);
  const statePath = resolveStatePath({ repoRoot, runtime, target });

  let state = buildEmptyState({ repoRoot, runtime, target, adapter });
  try {
    const loaded = loadInstallState({ repoRoot, runtime, target, adapter });
    state = loaded.state;
  } catch (error) {
    errors.push(`state-invalid: ${error.message}`);
  }

  if (state.runtime !== runtime) {
    errors.push(`runtime-mismatch:state expected ${runtime} got ${state.runtime}`);
  }
  if (state.target !== target) {
    errors.push(`target-mismatch:state expected ${target} got ${state.target}`);
  }
  if (state.install_root !== installRoot) {
    errors.push(`install-root-mismatch: expected ${installRoot} got ${state.install_root}`);
  }
  if (state.config_home !== configHome) {
    errors.push(`config-home-mismatch: expected ${configHome} got ${state.config_home}`);
  }

  const permissionTargets = [
    findExistingParentPath(installRoot),
    findExistingParentPath(dirname(statePath)),
    findExistingParentPath(journalDir),
  ];
  for (const permissionTarget of permissionTargets) {
    const permission = adapter.checkWritablePath(permissionTarget);
    if (!permission.writable) {
      errors.push(`permission-denied:${permissionTarget}: ${permission.error}`);
    }
  }

  return {
    state,
    statePath,
    installRoot,
    configHome,
    journalDir,
  };
}

function resolveUninstallRuntime(requestedRuntime, repoRoot, target) {
  const normalized = normalizeRuntime(requestedRuntime);
  if (normalized && normalized !== "auto") {
    return normalized;
  }

  const candidates = SUPPORTED_RUNTIMES.filter((runtime) =>
    exists(resolveStatePath({ repoRoot, runtime, target })),
  );
  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length === 0) {
    throw new Error("runtime-unavailable:auto: no managed uninstall state found");
  }
  throw new Error(`runtime-ambiguous: uninstall state exists for ${candidates.join(", ")}`);
}

function resolveUpdateSelection({
  repoRoot,
  state,
  requestedPacks,
  to,
  errors,
}) {
  const selectedPackIds = requestedPacks.length > 0 ? requestedPacks : state.packs.map((pack) => pack.id);

  if (selectedPackIds.length === 0) {
    return {
      selectedPackIds,
      selection: [],
    };
  }

  for (const requestedPack of requestedPacks) {
    if (!findStatePack(state, requestedPack)) {
      errors.push(`pack-not-installed:${requestedPack}`);
    }
  }

  if (!to) {
    const { selection, errors: selectionErrors } = manifestSelection(repoRoot, selectedPackIds);
    errors.push(
      ...selectionErrors.map((error) =>
        error.startsWith("pack-not-found:")
          ? `manifest-not-found:${error.slice("pack-not-found: ".length)}`
          : error,
      ),
    );
    return {
      selectedPackIds,
      selection,
    };
  }

  if (selectedPackIds.length !== 1) {
    errors.push(`update-source-unsupported:${to}: --to requires exactly one selected pack`);
    return {
      selectedPackIds,
      selection: [],
    };
  }

  const manifestPath = resolve(repoRoot, to);
  if (!exists(manifestPath)) {
    errors.push(
      /\.(yaml|yml)$/i.test(to) ? `manifest-not-found:${to}` : `update-source-unsupported:${to}`,
    );
    return {
      selectedPackIds,
      selection: [],
    };
  }

  let manifest;
  try {
    manifest = loadPackManifest(manifestPath);
  } catch (error) {
    errors.push(`manifest-invalid:${manifestPath}: ${error.message}`);
    return {
      selectedPackIds,
      selection: [],
    };
  }
  const expectedPackId = selectedPackIds[0];
  if (manifest.pack.id !== expectedPackId) {
    errors.push(`manifest-pack-mismatch:${expectedPackId}: got ${manifest.pack.id}`);
    return {
      selectedPackIds,
      selection: [],
    };
  }

  return {
    selectedPackIds,
    selection: [{ manifestPath, manifest }],
  };
}

function buildInstallOperations({
  repoRoot,
  target,
  adapter,
  statePath,
  journalDir,
  state,
  compiledPacks,
  warnings,
}) {
  const operations = [];
  const mkdirs = new Set();

  for (const compiledPack of compiledPacks) {
    const installDir = buildPackInstallDir(adapter, repoRoot, target, compiledPack.pack_id);
    if (!exists(installDir)) {
      mkdirs.add(`${compiledPack.pack_id}\u0000${installDir}`);
    }
    const existingStatePack = findStatePack(state, compiledPack.pack_id);
    for (const file of compiledPack.files) {
      const absolutePath = join(installDir, file.relative_path);
      const stateFile = existingStatePack?.files?.find(
        (entry) => entry.relative_path === file.relative_path,
      );
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

      const digest = safeCurrentDigest(absolutePath);
      if (!digest.ok) {
        operations.push(
          buildOperation("blocked_conflict", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: stateFile?.owned_by_pairslash ? "pairslash" : "unmanaged",
            overrideEligible: file.override_eligible,
            reason: `existing path is not a writable file: ${digest.error}`,
          }),
        );
        continue;
      }
      if (digest.digest === file.sha256) {
        operations.push(
          buildOperation("skip_identical", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: stateFile?.owned_by_pairslash ? "pairslash" : "unmanaged",
            overrideEligible: file.override_eligible,
            reason: "existing file already matches compiled artifact",
          }),
        );
        continue;
      }
      if (file.override_eligible) {
        warnings.push(
          `preserve-override:${compiledPack.pack_id}/${file.relative_path}: existing content will be preserved`,
        );
        operations.push(
          buildOperation("preserve_override", {
            packId: compiledPack.pack_id,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership: stateFile?.owned_by_pairslash ? "pairslash" : "user",
            overrideEligible: file.override_eligible,
            reason: stateFile
              ? "existing managed file differs from compiled artifact"
              : "existing unmanaged file preserved as local override",
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
          ownership: stateFile?.owned_by_pairslash ? "pairslash" : "unmanaged",
          overrideEligible: file.override_eligible,
          reason: "non-override file already exists and would be clobbered",
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

function cleanupEmptyDirectories(startDir, stopDir) {
  let current = startDir;
  while (current.startsWith(stopDir)) {
    if (!exists(current)) {
      break;
    }
    try {
      rmSync(current, { recursive: false });
    } catch {
      break;
    }
    current = dirname(current);
    if (current === stopDir) {
      break;
    }
  }
}

function resolveJournalPath({ repoRoot, runtime, target }) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "T");
  const suffix = Math.random().toString(16).slice(2, 8);
  return resolve(
    repoRoot,
    ".pairslash",
    INSTALL_JOURNAL_DIR,
    `${target}-${runtime}-${stamp}-${suffix}.json`,
  );
}

function buildMutationJournal(envelope, journalPath, action) {
  const steps = [];
  for (const operation of envelope.plan.operations) {
    if (operation.kind === "create") {
      steps.push({
        kind: "create",
        path: operation.absolute_path,
        created_by_transaction: true,
      });
      continue;
    }
    if (operation.kind === "remove") {
      steps.push({
        kind: "remove",
        path: operation.absolute_path,
        created_by_transaction: false,
        backup_content: exists(operation.absolute_path)
          ? readFileSync(operation.absolute_path, "utf8")
          : "",
      });
      continue;
    }
    if (operation.kind === "replace") {
      steps.push({
        kind: "replace",
        path: operation.absolute_path,
        created_by_transaction: false,
        backup_content: readFileSync(operation.absolute_path, "utf8"),
      });
    }
  }

  const stateStep = {
    kind: "write_state",
    path: envelope.statePath,
    created_by_transaction: !exists(envelope.statePath),
  };
  if (exists(envelope.statePath)) {
    try {
      stateStep.backup_content = readFileSync(envelope.statePath, "utf8");
    } catch {
      // Leave backup_content empty for pre-existing non-file paths.
    }
  }
  steps.push({
    ...stateStep,
  });

  const journal = {
    kind: "install-journal",
    schema_version: INSTALL_JOURNAL_SCHEMA_VERSION,
    action,
    runtime: envelope.runtime,
    target: envelope.target,
    transaction_id: sha256(`${journalPath}\n${envelope.runtime}\n${envelope.target}`).slice(0, 16),
    journal_path: journalPath,
    state_path: envelope.statePath,
    install_root: envelope.plan.install_root,
    status: "pending",
    started_at: new Date().toISOString(),
    steps,
  };

  const errors = validateInstallJournal(journal);
  if (errors.length > 0) {
    throw new Error(`invalid ${action} journal :: ${errors.join("; ")}`);
  }
  writeTextFile(journalPath, stableJson(journal));
  return journal;
}

function writeJournal(journal) {
  writeTextFile(journal.journal_path, stableJson(journal));
}

function rollbackInstallJournal(journal, envelope) {
  const reversed = journal.steps.slice().reverse();
  for (const step of reversed) {
    if (step.kind === "create") {
      rmSync(step.path, { force: true });
      cleanupEmptyDirectories(dirname(step.path), envelope.plan.install_root);
      continue;
    }
    if (step.kind === "replace") {
      writeTextFile(step.path, step.backup_content ?? "");
      continue;
    }
    if (step.kind === "remove") {
      writeTextFile(step.path, step.backup_content ?? "");
      continue;
    }
    if (step.kind === "write_state") {
      if (step.backup_content != null) {
        writeTextFile(step.path, step.backup_content);
      } else if (step.created_by_transaction) {
        rmSync(step.path, { force: true });
      }
    }
  }
}

function finalizeInstallResult({ envelope, state, journalPath }) {
  return {
    kind: "install-result",
    action: envelope.plan.action,
    runtime: envelope.runtime,
    target: envelope.target,
    state_path: envelope.statePath,
    journal_path: journalPath,
    selected_packs: envelope.plan.selected_packs,
    summary: envelope.plan.summary,
    state,
  };
}

function hasMutatingOperations(plan) {
  return plan.operations.some((operation) =>
    ["create", "replace", "remove", "write_state"].includes(operation.kind),
  );
}

function applyRemoveOperations(envelope) {
  for (const operation of envelope.plan.operations) {
    if (operation.kind !== "remove") {
      continue;
    }
    rmSync(operation.absolute_path, { force: true });
    cleanupEmptyDirectories(dirname(operation.absolute_path), envelope.plan.install_root);
  }
}

function buildDefaultNextState({ envelope, transactionId }) {
  return {
    state: updateStateAfterWrite(envelope, transactionId),
    removeStateFile: false,
  };
}

function applyMutationWithRollback(envelope, action, finalizeState = buildDefaultNextState) {
  if (!hasMutatingOperations(envelope.plan)) {
    return finalizeInstallResult({
      envelope,
      state: envelope.state,
      journalPath: null,
    });
  }

  const journalPath = resolveJournalPath({
    repoRoot: envelope.repoRoot,
    runtime: envelope.runtime,
    target: envelope.target,
  });
  const journal = buildMutationJournal(envelope, journalPath, action);

  try {
    applyRemoveOperations(envelope);
    applyWriteOperations(envelope);
    const { state: nextState, removeStateFile = false } = finalizeState({
      envelope,
      transactionId: journal.transaction_id,
    });
    if (removeStateFile) {
      removeInstallState(envelope.statePath);
    } else {
      writeInstallState(envelope.statePath, nextState);
    }
    journal.status = "committed";
    journal.committed_at = new Date().toISOString();
    writeJournal(journal);
    return finalizeInstallResult({
      envelope,
      state: nextState,
      journalPath,
    });
  } catch (error) {
    let rollbackFailure = null;
    try {
      rollbackInstallJournal(journal, envelope);
      journal.status = "rolled_back";
      journal.rolled_back_at = new Date().toISOString();
      journal.error_message = error.message;
      writeJournal(journal);
    } catch (rollbackError) {
      rollbackFailure = rollbackError;
      journal.status = "rollback_failed";
      journal.error_message = `${error.message} :: rollback ${rollbackError.message}`;
      writeJournal(journal);
    }
    if (rollbackFailure) {
      throw new Error(`${action} failed and rollback was incomplete: ${journal.error_message}`);
    }
    throw new Error(`${action} failed and rolled back: ${error.message}`);
  }
}

export function planInstall({ repoRoot, runtime = "auto", target = "repo", packs = [] }) {
  const normalizedTarget = normalizeTarget(target);
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

  if (!runtimeSelection.detection?.available) {
    errors.push(
      `runtime-unavailable:${normalizedRuntime}: ${
        runtimeSelection.detection?.error ?? "runtime not detected"
      }`,
    );
  }

  const { statePath, state, installRoot, journalDir } = resolveInstallEnvironment({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    errors,
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
        })
      : [];

  const operations = buildInstallOperations({
    repoRoot,
    target: normalizedTarget,
    adapter,
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
    installRoot,
    statePath,
    operations,
    selectedPacks: compiledPacks.map((pack) => pack.pack_id),
    warnings,
    errors,
  });

  return {
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    detection: runtimeSelection.detection,
    statePath,
    state,
    lintReport,
    compiledPacks,
    plan,
  };
}

export function applyInstall(envelope) {
  if (!envelope.plan.can_apply) {
    throw new Error("install plan contains blocking errors");
  }
  return applyMutationWithRollback(envelope, "install");
}

function buildUpdateBlockedOperation({
  packId,
  installDir,
  relativePath = ".",
  absolutePath = null,
  ownership = "unmanaged",
  reason,
}) {
  return buildOperation("blocked_conflict", {
    packId,
    relativePath,
    absolutePath: absolutePath ?? join(installDir, relativePath),
    ownership,
    reason,
  });
}

function validateManagedOwnershipFile({ existingStatePack, errors, operations }) {
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
      }),
    );
    return false;
  }

  return true;
}

function buildUpdateOperations({
  repoRoot,
  target,
  adapter,
  state,
  compiledPacks,
  selectedPackIds,
  warnings,
  errors,
}) {
  const operations = [];

  for (const packId of selectedPackIds) {
    const existingStatePack = findStatePack(state, packId);
    if (!existingStatePack) {
      operations.push(
        buildOperation("blocked_conflict", {
          packId,
          relativePath: ".",
          absolutePath: buildPackInstallDir(adapter, repoRoot, target, packId),
          ownership: "unmanaged",
          reason: "pack is not managed by PairSlash; run install instead",
        }),
      );
      continue;
    }
    if (!validateManagedOwnershipFile({ existingStatePack, errors, operations })) {
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
          }),
        );
        continue;
      }

      if (digest.digest === file.sha256) {
        operations.push(
          buildOperation(stateFile?.owned_by_pairslash === false ? "skip_unmanaged" : "skip_identical", {
            packId,
            relativePath: file.relative_path,
            absolutePath,
            assetKind: file.asset_kind,
            installSurface: file.install_surface,
            ownership,
            overrideEligible: file.override_eligible,
            reason:
              stateFile?.owned_by_pairslash === false
                ? "unmanaged file already matches compiled artifact"
                : "existing file already matches compiled artifact",
          }),
        );
        continue;
      }

      if (!stateFile) {
        if (file.override_eligible) {
          warnings.push(`preserve-override:${packId}/${file.relative_path}: existing unmanaged file preserved`);
          operations.push(
            buildOperation("preserve_override", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "existing unmanaged file preserved as local override",
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
            }),
          );
        }
        continue;
      }

      if (!stateFile.owned_by_pairslash) {
        if (file.override_eligible) {
          warnings.push(`preserve-override:${packId}/${file.relative_path}: existing unmanaged file preserved`);
          operations.push(
            buildOperation("preserve_override", {
              packId,
              relativePath: file.relative_path,
              absolutePath,
              assetKind: file.asset_kind,
              installSurface: file.install_surface,
              ownership,
              overrideEligible: file.override_eligible,
              reason: "existing unmanaged file preserved as local override",
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
}) {
  const normalizedTarget = normalizeTarget(target);
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

  if (!runtimeSelection.detection?.available) {
    errors.push(
      `runtime-unavailable:${normalizedRuntime}: ${
        runtimeSelection.detection?.error ?? "runtime not detected"
      }`,
    );
  }

  const { statePath, state, installRoot, journalDir } = resolveUpdateEnvironment({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    errors,
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
        })
      : [];

  const operations = buildUpdateOperations({
    repoRoot,
    target: normalizedTarget,
    adapter,
    state,
    compiledPacks,
    selectedPackIds,
    warnings,
    errors,
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
    installRoot,
    statePath,
    operations,
    selectedPacks: selectedPackIds,
    warnings,
    errors,
  });
  return {
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    detection: runtimeSelection.detection,
    statePath,
    state,
    lintReport,
    compiledPacks,
    plan,
  };
}

export function applyUpdate(envelope) {
  if (!envelope.plan.can_apply) {
    throw new Error("update plan contains blocked conflicts");
  }
  return applyMutationWithRollback(envelope, "update");
}

function buildStateAfterUninstall({ envelope, transactionId }) {
  const nextState = cloneState(envelope.state);
  nextState.packs = nextState.packs.filter((pack) => !envelope.plan.selected_packs.includes(pack.id));
  nextState.updated_at = new Date().toISOString();
  nextState.last_transaction_id = transactionId;
  if (nextState.packs.length === 0) {
    const emptyState = buildEmptyState({
      repoRoot: envelope.repoRoot,
      runtime: envelope.runtime,
      target: envelope.target,
      adapter: envelope.adapter,
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

function buildUninstallOperations({ state, selectedPacks, warnings }) {
  const operations = [];

  for (const pack of selectedPacks) {
    const trackedPaths = new Set(pack.files.map((file) => file.absolute_path));
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
      const unknownFiles = walkFiles(pack.install_dir).filter((absolutePath) => !trackedPaths.has(absolutePath));
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
          }),
        );
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

export function planUninstall({ repoRoot, runtime, target = "repo", packs = [] }) {
  const normalizedTarget = normalizeTarget(target);
  const normalizedRuntime = resolveUninstallRuntime(runtime, repoRoot, normalizedTarget);
  const adapter = getRuntimeAdapter(normalizedRuntime);
  const warnings = [];
  const errors = [];
  const { statePath, state, installRoot, journalDir } = resolveUpdateEnvironment({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    errors,
  });

  for (const requestedPack of packs) {
    if (!findStatePack(state, requestedPack)) {
      errors.push(`pack-not-installed:${requestedPack}`);
    }
  }

  const selected = packs.length > 0 ? state.packs.filter((pack) => packs.includes(pack.id)) : state.packs;
  const operations = buildUninstallOperations({
    state,
    selectedPacks: selected,
    warnings,
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
    installRoot,
    statePath,
    operations,
    selectedPacks: selected.map((pack) => pack.id),
    warnings,
    errors,
  });
  return {
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
    detection: null,
    statePath,
    state,
    compiledPacks: [],
    plan,
  };
}

export function applyUninstall(envelope) {
  if (!envelope.plan.can_apply) {
    throw new Error("uninstall plan contains blocking errors");
  }
  return applyMutationWithRollback(envelope, "uninstall", buildStateAfterUninstall);
}

export function loadStateForDoctor({ repoRoot, runtime, target }) {
  const normalizedRuntime = normalizeRuntime(runtime);
  const normalizedTarget = normalizeTarget(target);
  const adapter = getRuntimeAdapter(normalizedRuntime);
  return loadInstallState({
    repoRoot,
    runtime: normalizedRuntime,
    target: normalizedTarget,
    adapter,
  });
}

export { resolveStatePath };
export { detectRuntimeSelection, satisfiesRuntimeRange };
