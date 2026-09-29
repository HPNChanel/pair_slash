import process from "node:process";
import { resolve, sep } from "node:path";

function runtimeFlag(runtime: string | undefined) {
  return runtime === "codex_cli" ? "codex" : "copilot";
}

export function normalizeManagementMode(file: any) {
  if (file?.management_mode === "pairslash_owned" || file?.management_mode === "reconciled_unmanaged") {
    return file.management_mode;
  }
  return file?.owned_by_pairslash ? "pairslash_owned" : "reconciled_unmanaged";
}

export function normalizeInstallStateRecord(state: any) {
  if (!state || !Array.isArray(state.packs)) {
    return state;
  }
  return {
    ...state,
    packs: state.packs.map((pack: any) => ({
      ...pack,
      files: Array.isArray(pack.files)
        ? pack.files.map((file: any) => {
            const managementMode = normalizeManagementMode(file);
            const reconciledReasonCode =
              file?.reconciled_reason_code ??
              (managementMode === "reconciled_unmanaged"
                ? file.local_override
                  ? "reconcile-unmanaged-override-preserved"
                  : "reconcile-unmanaged-identical"
                : null);
            return {
              ...file,
              management_mode: managementMode,
              ...(reconciledReasonCode ? { reconciled_reason_code: reconciledReasonCode } : {}),
            };
          })
        : [],
    })),
  };
}

export function buildLifecycleCommand({
  action,
  runtime,
  target,
  packId = null,
  dryRun = false,
  apply = false,
}: { action?: any; runtime?: string; target?: any; packId?: string | null; dryRun?: any; apply?: any }) {
  const parts = [
    "node packages/tools/cli/src/bin/pairslash.js",
    action,
  ];
  if (packId) {
    parts.push(packId);
  }
  parts.push("--runtime", runtimeFlag(runtime), "--target", target);
  if (dryRun) {
    parts.push("--dry-run");
  }
  if (apply) {
    parts.push("--apply", "--yes");
  }
  return parts.join(" ");
}

export function buildRunCommandRemediationAction({
  actionId,
  summary,
  command,
  appliesToActions = [],
  reasonCodes = [],
  safeWithoutWrite = true,
  requiresPreview = false,
  preferred = false,
}: { actionId?: any; summary?: any; command?: string; appliesToActions?: any; reasonCodes?: any; safeWithoutWrite?: any; requiresPreview?: any; preferred?: any }) {
  return {
    action_id: actionId,
    action_kind: "run_command",
    summary,
    command,
    safe_without_write: safeWithoutWrite,
    requires_preview: requiresPreview,
    applies_to_actions: appliesToActions.slice().sort((left: any, right: any) => left.localeCompare(right)),
    reason_codes: [...new Set(reasonCodes.filter(Boolean))].sort((left: any, right: any) => left.localeCompare(right)),
    preferred,
  };
}

export function buildReviewRemediationAction({
  actionId,
  summary,
  path = null,
  appliesToActions = [],
  reasonCodes = [],
  preferred = false,
}: { actionId?: any; summary?: any; path?: string | null; appliesToActions?: any; reasonCodes?: any; preferred?: any }) {
  return {
    action_id: actionId,
    action_kind: "review_manual",
    summary,
    command: null,
    ...(path ? { path } : {}),
    safe_without_write: true,
    requires_preview: false,
    applies_to_actions: appliesToActions.slice().sort((left: any, right: any) => left.localeCompare(right)),
    reason_codes: [...new Set(reasonCodes.filter(Boolean))].sort((left: any, right: any) => left.localeCompare(right)),
    preferred,
  };
}

export function dedupeRemediationActions(actions: any = []) {
  const seen = new Set();
  return actions
    .filter(Boolean)
    .filter((action: any) => {
      const key = JSON.stringify({
        action_id: action.action_id ?? null,
        action_kind: action.action_kind ?? null,
        command: action.command ?? null,
        path: action.path ?? null,
        reason_codes: action.reason_codes ?? [],
      });
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left: any, right: any) =>
      [
        left.preferred ? "0" : "1",
        left.action_kind ?? "",
        left.command ?? "",
        left.path ?? "",
        left.action_id ?? "",
      ]
        .join("\u0000")
        .localeCompare(
          [
            right.preferred ? "0" : "1",
            right.action_kind ?? "",
            right.command ?? "",
            right.path ?? "",
            right.action_id ?? "",
          ].join("\u0000"),
        ),
    );
}

export function collectLifecycleReasonCodes({
  reasonCodes = [],
  operations = [],
  checks = [],
  issues = [],
}: { reasonCodes?: any; operations?: any; checks?: any; issues?: any[] }) {
  return [
    ...new Set(
      [
        ...reasonCodes,
        ...operations.flatMap((operation: any) => operation.reason_code ?? []),
        ...checks.flatMap((check: any) => check.reason_codes ?? []),
        ...issues.flatMap((issue: any) => issue.reason_codes ?? []),
      ].filter(Boolean),
    ),
  ].sort((left: any, right: any) => left.localeCompare(right));
}

export function buildInstallStateMetadataMismatches({
  state,
  runtime,
  target,
  configHome,
  installRoot,
}: { state?: any; runtime?: string; target?: any; configHome?: any; installRoot?: string }) {
  const mismatches: any[] = [];
  if (state.runtime !== runtime) {
    mismatches.push({
      field: "runtime",
      expected: runtime,
      actual: state.runtime,
    });
  }
  if (state.target !== target) {
    mismatches.push({
      field: "target",
      expected: target,
      actual: state.target,
    });
  }
  if (!arePathValuesEqual(state.config_home, configHome)) {
    mismatches.push({
      field: "config_home",
      expected: configHome,
      actual: state.config_home,
    });
  }
  if (!arePathValuesEqual(state.install_root, installRoot)) {
    mismatches.push({
      field: "install_root",
      expected: installRoot,
      actual: state.install_root,
    });
  }
  return mismatches;
}

export function normalizePathForCompare(pathValue: any) {
  if (typeof pathValue !== "string" || pathValue.trim() === "") {
    return pathValue;
  }
  const resolved = resolve(pathValue);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isPathWithinRoot(rootPath: any, candidatePath: any) {
  const normalizedRoot = normalizePathForCompare(rootPath);
  const normalizedCandidate = normalizePathForCompare(candidatePath);
  if (typeof normalizedRoot !== "string" || typeof normalizedCandidate !== "string") {
    return false;
  }
  if (normalizedRoot === normalizedCandidate) {
    return true;
  }
  return normalizedCandidate.startsWith(
    normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`,
  );
}

function arePathValuesEqual(left: any, right: any) {
  if (typeof left !== "string" || typeof right !== "string") {
    return left === right;
  }
  return normalizePathForCompare(left) === normalizePathForCompare(right);
}
