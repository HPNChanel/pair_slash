import {
  isPathWithinRoot,
} from "../semantics.ts";
import {
  removeInstallState,
  writeInstallState,
} from "../state.ts";
import {
  compileCodexPack,
} from "@pairslash/compiler-codex";
import {
  compileCopilotPack,
} from "@pairslash/compiler-copilot";
import {
  ensureDir,
  exists,
  readFileNormalized,
  sha256,
  writeTextFile,
} from "@pairslash/spec-core";
import {
  spawnSync,
} from "node:child_process";
import {
  lstatSync,
  realpathSync,
  rmSync,
} from "node:fs";
import {
  dirname,
  join,
  resolve,
} from "node:path";
import {
  buildMutationJournal,
  resolveJournalPath,
  rollbackInstallJournal,
  writeJournal,
} from "./journal.ts";
import {
  updateStateAfterWrite,
} from "./state.ts";

export const SYSTEM_PACK_ID = "_pairslash";

export const REASON_CODE_INSTALL_STATE_INVALID = "install-state-invalid";

export const REASON_CODE_INSTALL_STATE_METADATA_MISMATCH = "install-state-metadata-mismatch";

export const REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE = "managed-pack-requires-update";

export const REASON_CODE_RECONCILE_IDENTICAL = "reconcile-unmanaged-identical";

export const REASON_CODE_RECONCILE_OVERRIDE = "reconcile-unmanaged-override-preserved";

export const REASON_CODE_UNMANAGED_CONFLICT = "unmanaged-conflict-blocking";

export const REASON_CODE_MANAGED_OVERRIDE = "managed-override-preserved";

export const REASON_CODE_MANAGED_ORPHAN_OVERRIDE = "managed-orphan-override-preserved";

export const REASON_CODE_OWNERSHIP_METADATA_CONFLICT = "ownership-metadata-conflict";

export const REASON_CODE_UPDATE_CONFLICT = "update-conflict-blocking";

export const REASON_CODE_UNINSTALL_PRESERVE_UNMANAGED = "uninstall-preserve-unmanaged";

export const POLICY_PRECEDENCE = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

export const MUTATING_OPERATION_KINDS = new Set(["create", "replace", "remove"]);

export const CONFIG_MUTATION_SURFACES = new Set(["config", "context", "metadata", "hook", "mcp", "agent"]);

export const RISKY_MUTATION_SURFACES = new Set(["config", "metadata", "hook", "mcp", "agent"]);

export function uniqueSorted(values: any): any[] {
  return [...new Set(values.filter(Boolean))].sort((left: any, right: any) => left.localeCompare(right));
}

export function compilePackForRuntime(options) {
  return options.runtime === "codex_cli"
    ? compileCodexPack(options)
    : compileCopilotPack(options);
}

export function currentDigest(filePath) {
  const content = readFileNormalized(filePath);
  return sha256(typeof content === "string" ? content : content);
}

export function safeCurrentDigest(filePath) {
  try {
    return { ok: true, digest: currentDigest(filePath) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function findManifestEntry(selection, packId) {
  return selection.find((entry) => entry.manifest.pack.id === packId) ?? null;
}

export function isVersionOrDigestMatch(value, statePack) {
  return value === statePack.version || value === statePack.manifest_digest;
}

export function findExistingParentPath(path) {
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

export function safeLstat(path) {
  try {
    return { ok: true, stat: lstatSync(path) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function safeRealpath(path) {
  try {
    const resolvedPath = typeof realpathSync.native === "function"
      ? realpathSync.native(path)
      : realpathSync(path);
    return { ok: true, path: resolvedPath };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function parseSimpleCommand(command) {
  if (typeof command !== "string" || command.trim() === "") {
    return null;
  }
  if (/[\"'`|&;<>$()]/.test(command)) {
    return null;
  }
  const tokens = command.trim().split(/\s+/);
  if (tokens.length === 0) {
    return null;
  }
  return {
    file: tokens[0],
    args: tokens.slice(1),
  };
}

export function isCurrentNodeVersionCheck(parsed) {
  if (!parsed) {
    return false;
  }
  const file = parsed.file.toLowerCase();
  if (file !== "node" && file !== "node.exe") {
    return false;
  }
  return parsed.args.length === 1 && ["--version", "-v"].includes(parsed.args[0]);
}

export function runCheckCommand(command) {
  const parsed = parseSimpleCommand(command);
  if (isCurrentNodeVersionCheck(parsed)) {
    return {
      status: 0,
      stdout: `${process.version}\n`,
      stderr: "",
      error: null,
    };
  }
  if (parsed) {
    return spawnSync(parsed.file, parsed.args, {
      encoding: "utf8",
    });
  }
  return spawnSync(command, {
    shell: true,
    encoding: "utf8",
  });
}

export function getPlannedOperation(operations, packId, relativePath) {
  return (
    operations.find(
      (operation) =>
        operation.pack_id === packId && operation.relative_path === relativePath,
    ) ?? null
  );
}

export function buildPackInstallDir(adapter, repoRoot, target, packId, skillRoot, emit = "skill") {
  return emit === "plugin"
    ? adapter.resolvePluginInstallDir({ repoRoot, target }, packId)
    : adapter.resolvePackInstallDir({ repoRoot, target, skillRoot }, packId);
}

// Plugin emit has no user-scope file placement; return null instead of
// letting adapter resolution throw, so blocked plans still render.

export function resolveInstallRootForEmit(adapter, { repoRoot, target, skillRoot, emit }) {
  if (emit !== "plugin") {
    return adapter.resolveInstallRoot({ repoRoot, target, skillRoot });
  }
  return target === "repo" ? adapter.resolvePluginRoot({ repoRoot, target }) : null;
}

export function applyWriteOperations(envelope) {
  for (const compiledPack of envelope.compiledPacks) {
    const installDir = buildPackInstallDir(
      envelope.adapter,
      envelope.repoRoot,
      envelope.target,
      compiledPack.pack_id,
      envelope.skillRoot,
      envelope.emit,
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

export function hasMutatingOperations(plan) {
  return plan.operations.some((operation) =>
    ["create", "replace", "remove", "write_state"].includes(operation.kind),
  );
}

export function applyRemoveOperations(envelope) {
  for (const operation of envelope.plan.operations) {
    if (operation.kind !== "remove") {
      continue;
    }
    rmSync(operation.absolute_path, { force: true });
    cleanupEmptyDirectories(dirname(operation.absolute_path), envelope.plan.install_root);
  }
}

export function buildDefaultNextState({ envelope, transactionId }) {
  return {
    state: updateStateAfterWrite(envelope, transactionId),
    removeStateFile: false,
  };
}

export function applyMutationWithRollback(envelope, action, finalizeState = buildDefaultNextState) {
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
    skillRoot: envelope.skillRoot,
    emit: envelope.emit,
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

export function cleanupEmptyDirectories(startDir, stopDir) {
  let current = startDir;
  while (isPathWithinRoot(stopDir, current)) {
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

export function finalizeInstallResult({ envelope, state, journalPath }) {
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
