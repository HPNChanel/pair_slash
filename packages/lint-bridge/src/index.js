import { basename, join, resolve } from "node:path";
import process from "node:process";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import * as runtimeCodexAdapter from "@pairslash/runtime-codex-adapter";
import * as runtimeCopilotAdapter from "@pairslash/runtime-copilot-adapter";
import {
  LINT_REPORT_SCHEMA_VERSION,
  OWNERSHIP_FILE,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  discoverPackManifestPaths,
  loadYamlFile,
  normalizeRuntime,
  normalizeTarget,
  validateLintReport,
  validatePackManifestV2,
} from "@pairslash/spec-core";

const ISSUE_RESULTS = new Set(["error", "warning", "note"]);
const SEMVER_RANGE_PATTERN = /^(>=\s*)?\d+\.\d+\.\d+$/;

const RUNTIME_COMPILE = {
  codex_cli: compileCodexPack,
  copilot_cli: compileCopilotPack,
};

const RUNTIME_ADAPTERS = {
  codex_cli: runtimeCodexAdapter,
  copilot_cli: runtimeCopilotAdapter,
};

function normalizeRuntimeScope(requestedRuntime) {
  if (!requestedRuntime || requestedRuntime === "all" || requestedRuntime === "auto") {
    return { runtimeScope: "all", runtimes: SUPPORTED_RUNTIMES.slice() };
  }
  const normalized = normalizeRuntime(requestedRuntime);
  if (!SUPPORTED_RUNTIMES.includes(normalized)) {
    throw new Error(`unsupported runtime scope: ${requestedRuntime}`);
  }
  return { runtimeScope: normalized, runtimes: [normalized] };
}

function createCheck({
  code,
  result = "pass",
  packId = null,
  runtime = "shared",
  target,
  path = null,
  message,
  remediation = null,
}) {
  return {
    code,
    result,
    pack_id: packId,
    runtime,
    target,
    path,
    message,
    remediation,
  };
}

function sortChecks(checks) {
  return checks.slice().sort((left, right) =>
    [
      left.pack_id ?? "",
      left.runtime,
      left.code,
      left.path ?? "",
      left.message,
      left.result,
    ]
      .join("\u0000")
      .localeCompare(
        [
          right.pack_id ?? "",
          right.runtime,
          right.code,
          right.path ?? "",
          right.message,
          right.result,
        ].join("\u0000"),
      ),
  );
}

function parseManifestEntries(repoRoot) {
  return discoverPackManifestPaths(repoRoot).map((manifestPath) => {
    const fallbackPackId = basename(resolve(manifestPath, ".."));
    try {
      const manifest = loadYamlFile(manifestPath);
      return {
        manifestPath,
        packId:
          typeof manifest?.pack?.id === "string" && manifest.pack.id.trim() !== ""
            ? manifest.pack.id
            : fallbackPackId,
        manifest,
        parseError: null,
      };
    } catch (error) {
      return {
        manifestPath,
        packId: fallbackPackId,
        manifest: null,
        parseError: error.message,
      };
    }
  });
}

function selectManifestEntries(entries, requestedPacks, checks, target) {
  if (requestedPacks.length === 0) {
    return entries.slice().sort((left, right) =>
      `${left.packId}\u0000${left.manifestPath}`.localeCompare(`${right.packId}\u0000${right.manifestPath}`),
    );
  }

  const deduped = [...new Set(requestedPacks)];
  const selected = [];
  for (const packId of deduped) {
    const entry = entries.find((item) => item.packId === packId);
    if (!entry) {
      checks.push(
        createCheck({
          code: "LINT-MANIFEST-000",
          result: "error",
          packId,
          target,
          message: `requested pack ${packId} was not found`,
          remediation: "Use a valid pack id or remove the pack selector.",
        }),
      );
      continue;
    }
    selected.push(entry);
  }
  return selected.sort((left, right) =>
    `${left.packId}\u0000${left.manifestPath}`.localeCompare(`${right.packId}\u0000${right.manifestPath}`),
  );
}

function applyManifestValidation(entry, checks, target) {
  if (entry.parseError) {
    checks.push(
      createCheck({
        code: "LINT-MANIFEST-001",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `manifest parse failed: ${entry.parseError}`,
        remediation: "Fix YAML syntax in pack.manifest.yaml.",
      }),
    );
    return false;
  }

  const errors = validatePackManifestV2(entry.manifest);
  if (errors.length > 0) {
    for (const errorMessage of errors) {
      checks.push(
        createCheck({
          code: "LINT-MANIFEST-001",
          result: "error",
          packId: entry.packId,
          target,
          path: entry.manifestPath,
          message: errorMessage,
          remediation: "Fix manifest v2 fields to satisfy schema and policy constraints.",
        }),
      );
    }
    return false;
  }

  checks.push(
    createCheck({
      code: "LINT-MANIFEST-001",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: "manifest v2 validation passed",
    }),
  );
  return true;
}

function applyRuntimeRangeRule(entry, checks, target) {
  const invalid = [];
  for (const runtime of SUPPORTED_RUNTIMES) {
    const range = entry.manifest.supported_runtime_ranges?.[runtime];
    if (typeof range !== "string" || !SEMVER_RANGE_PATTERN.test(range.trim())) {
      invalid.push(`${runtime}=${range ?? "missing"}`);
    }
  }
  if (invalid.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-RUNTIME-001",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `supported_runtime_ranges contains non-parseable values: ${invalid.join(", ")}`,
        remediation: "Use exact x.y.z or >=x.y.z semver format.",
      }),
    );
    return;
  }
  checks.push(
    createCheck({
      code: "LINT-RUNTIME-001",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: "runtime ranges are parseable",
    }),
  );
}

function applyNamingRule(entry, checks, target) {
  const packId = entry.packId;
  const codexInvocation = entry.manifest.runtime_targets?.codex_cli?.direct_invocation;
  const copilotInvocation = entry.manifest.runtime_targets?.copilot_cli?.direct_invocation;
  const codexDir = entry.manifest.runtime_targets?.codex_cli?.skill_directory_name;
  const copilotDir = entry.manifest.runtime_targets?.copilot_cli?.skill_directory_name;
  const workflowClass = entry.manifest.pack?.workflow_class;
  const authority = entry.manifest.memory_permissions?.authority_mode;
  const problems = [];

  if (entry.manifest.pack?.canonical_entrypoint !== "/skills") {
    problems.push("canonical entrypoint must be /skills");
  }
  if (codexInvocation !== `$${packId}`) {
    problems.push(`codex direct invocation must be $${packId}`);
  }
  if (copilotInvocation !== `/${packId}`) {
    problems.push(`copilot direct invocation must be /${packId}`);
  }
  if (codexDir !== packId || copilotDir !== packId) {
    problems.push("runtime skill_directory_name must match pack.id");
  }
  if (workflowClass === "write-authority" && authority !== "write-authority") {
    problems.push("write-authority workflow_class requires memory authority_mode write-authority");
  }

  if (problems.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-NAMING-001",
        result: "error",
        packId,
        target,
        path: entry.manifestPath,
        message: problems.join("; "),
        remediation: "Align naming and workflow fields with one-spec-two-runtimes conventions.",
      }),
    );
    return;
  }

  checks.push(
    createCheck({
      code: "LINT-NAMING-001",
      result: "pass",
      packId,
      target,
      path: entry.manifestPath,
      message: "entrypoint and runtime naming are consistent",
    }),
  );
}

function applyToolsRule(entry, checks, target) {
  const requiredTools = entry.manifest.required_tools ?? [];
  const capabilities = entry.manifest.capabilities ?? [];
  if (["shell_exec", "test_exec"].some((flag) => capabilities.includes(flag)) && requiredTools.length === 0) {
    checks.push(
      createCheck({
        code: "LINT-TOOLS-002",
        result: "warning",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: "shell_exec/test_exec capability is declared without required_tools entries",
        remediation: "Declare required_tools used for runtime execution validation.",
      }),
    );
  } else {
    checks.push(
      createCheck({
        code: "LINT-TOOLS-001",
        result: "pass",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: "required_tools declaration is present and coherent",
      }),
    );
  }
}

function applyMcpRule(entry, checks, target) {
  const capabilities = entry.manifest.capabilities ?? [];
  const servers = entry.manifest.required_mcp_servers ?? [];
  const hasClientCapability = capabilities.includes("mcp_client");
  if (servers.length > 0 && !hasClientCapability) {
    checks.push(
      createCheck({
        code: "LINT-MCP-001",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: "required_mcp_servers is declared but mcp_client capability is missing",
        remediation: "Add mcp_client capability or remove required_mcp_servers.",
      }),
    );
    return;
  }
  if (hasClientCapability && servers.length === 0) {
    checks.push(
      createCheck({
        code: "LINT-MCP-002",
        result: "warning",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: "mcp_client capability is enabled but required_mcp_servers is empty",
        remediation: "Declare required MCP servers to keep doctor/install checks explicit.",
      }),
    );
    return;
  }
  checks.push(
    createCheck({
      code: "LINT-MCP-001",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: "MCP declaration is coherent",
    }),
  );
}

function applyMemoryRule(entry, checks, target) {
  const permissions = entry.manifest.memory_permissions ?? {};
  const capabilities = entry.manifest.capabilities ?? [];
  const problems = [];
  if (permissions.explicit_write_only !== true) {
    problems.push("explicit_write_only must be true");
  }
  if (permissions.global_project_memory === "write" && permissions.authority_mode !== "write-authority") {
    problems.push("global_project_memory=write requires authority_mode=write-authority");
  }
  if (permissions.global_project_memory === "write" && !capabilities.includes("memory_write_global")) {
    problems.push("global_project_memory=write requires memory_write_global capability");
  }
  if (problems.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-MEM-001",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: problems.join("; "),
        remediation: "Align memory permissions with explicit-write-only and authority constraints.",
      }),
    );
    return;
  }
  checks.push(
    createCheck({
      code: "LINT-MEM-001",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: "memory permission declarations are coherent",
    }),
  );
}

function applyInstallTargetRule(entry, checks, target) {
  if (!entry.manifest.install_targets?.includes(target)) {
    checks.push(
      createCheck({
        code: "LINT-TARGET-001",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `install target ${target} is not supported by this pack`,
        remediation: "Update install_targets or lint/install against a supported scope.",
      }),
    );
    return;
  }
  checks.push(
    createCheck({
      code: "LINT-TARGET-001",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: `install target ${target} is supported`,
    }),
  );
}

function applyOwnershipManifestRule(entry, checks, target) {
  const ownership = entry.manifest.ownership ?? {};
  const issues = [];
  if (ownership.ownership_file !== OWNERSHIP_FILE) {
    issues.push(`ownership_file must be ${OWNERSHIP_FILE}`);
  }
  if (!Array.isArray(ownership.generated_files) || !ownership.generated_files.includes(OWNERSHIP_FILE)) {
    issues.push("ownership.generated_files must include pairslash.install.json");
  }
  if (ownership.safe_delete_policy !== "pairslash-owned-only") {
    issues.push("safe_delete_policy must be pairslash-owned-only");
  }
  if (issues.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-OWN-001",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: issues.join("; "),
        remediation: "Complete ownership metadata to guarantee safe uninstall/update behavior.",
      }),
    );
    return;
  }
  checks.push(
    createCheck({
      code: "LINT-OWN-001",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: "ownership metadata declaration is complete",
    }),
  );
}

function applyCrossPackMetadataRules(validEntries, checks, target, runtimes) {
  const packIdOwners = new Map();
  const packDirOwners = new Map();
  for (const entry of validEntries) {
    if (packIdOwners.has(entry.packId)) {
      checks.push(
        createCheck({
          code: "LINT-ASSET-002",
          result: "error",
          packId: entry.packId,
          target,
          path: entry.manifestPath,
          message: `duplicate pack.id also declared in ${packIdOwners.get(entry.packId)}`,
          remediation: "Use globally unique pack.id.",
        }),
      );
    } else {
      packIdOwners.set(entry.packId, entry.manifestPath);
    }

    const packDir = entry.manifest.assets?.pack_dir;
    if (packDirOwners.has(packDir)) {
      checks.push(
        createCheck({
          code: "LINT-ASSET-002",
          result: "error",
          packId: entry.packId,
          target,
          path: entry.manifestPath,
          message: `assets.pack_dir conflicts with ${packDirOwners.get(packDir)}`,
          remediation: "Use unique assets.pack_dir for each pack.",
        }),
      );
    } else {
      packDirOwners.set(packDir, entry.manifestPath);
    }
  }

  for (const runtime of runtimes) {
    const invocationOwners = new Map();
    for (const entry of validEntries) {
      const invocation = entry.manifest.runtime_targets?.[runtime]?.direct_invocation;
      if (invocationOwners.has(invocation)) {
        checks.push(
          createCheck({
            code: "LINT-NAMING-002",
            result: "error",
            packId: entry.packId,
            runtime,
            target,
            path: entry.manifestPath,
            message: `direct invocation ${invocation} conflicts with pack ${invocationOwners.get(invocation)}`,
            remediation: "Keep runtime direct invocation unique per lane.",
          }),
        );
      } else {
        invocationOwners.set(invocation, entry.packId);
      }
    }
  }
}

function isSortedByRelativePath(files) {
  for (let index = 1; index < files.length; index += 1) {
    if (files[index - 1].relative_path.localeCompare(files[index].relative_path) > 0) {
      return false;
    }
  }
  return true;
}

function applyCompileRules({
  repoRoot,
  target,
  runtimes,
  validEntries,
  checks,
}) {
  const compiledArtifacts = [];
  for (const entry of validEntries) {
    for (const runtime of runtimes) {
      if (!entry.manifest.runtime_targets?.[runtime]) {
        checks.push(
          createCheck({
            code: "LINT-RUNTIME-002",
            result: "error",
            packId: entry.packId,
            runtime,
            target,
            path: entry.manifestPath,
            message: `manifest does not define runtime target for ${runtime}`,
            remediation: "Declare runtime target to preserve one-spec-two-runtimes.",
          }),
        );
        continue;
      }

      const compileFn = RUNTIME_COMPILE[runtime];
      try {
        const first = compileFn({ repoRoot, manifestPath: entry.manifestPath });
        const second = compileFn({ repoRoot, manifestPath: entry.manifestPath });
        if (first.digest !== second.digest) {
          checks.push(
            createCheck({
              code: "LINT-DET-001",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "compiler output digest drifted across two runs",
              remediation: "Remove non-deterministic emit inputs and keep stable sort keys.",
            }),
          );
        } else {
          checks.push(
            createCheck({
              code: "LINT-DET-001",
              result: "pass",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "compiler digest stable across two runs",
            }),
          );
        }

        if (!isSortedByRelativePath(first.files)) {
          checks.push(
            createCheck({
              code: "LINT-DET-002",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "compiled files are not in stable lexical order",
              remediation: "Sort runtime emitted files by relative_path before final digest.",
            }),
          );
        } else {
          checks.push(
            createCheck({
              code: "LINT-DET-002",
              result: "pass",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "compiled files are in stable lexical order",
            }),
          );
        }

        const ownershipFile = first.files.find((file) => file.relative_path === OWNERSHIP_FILE);
        if (!ownershipFile) {
          checks.push(
            createCheck({
              code: "LINT-OWN-002",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "compiled output is missing pairslash.install.json",
              remediation: "Ensure compiler always emits ownership metadata file.",
            }),
          );
        } else {
          checks.push(
            createCheck({
              code: "LINT-OWN-002",
              result: "pass",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "compiled output includes ownership metadata",
            }),
          );
        }

        compiledArtifacts.push({
          packId: entry.packId,
          runtime,
          compiledPack: first,
        });
      } catch (error) {
        checks.push(
          createCheck({
            code: "LINT-DET-001",
            result: "error",
            packId: entry.packId,
            runtime,
            target,
            path: entry.manifestPath,
            message: `compile failed: ${error.message}`,
            remediation: "Fix runtime emitter contract and source assets before install/update.",
          }),
        );
      }
    }
  }
  return compiledArtifacts;
}

function applyOutputConflictRule({ repoRoot, target, compiledArtifacts, checks }) {
  const owners = new Map();
  for (const artifact of compiledArtifacts) {
    const adapter = RUNTIME_ADAPTERS[artifact.runtime];
    const installDir = adapter.resolvePackInstallDir({ repoRoot, target }, artifact.packId);
    for (const file of artifact.compiledPack.files) {
      const absolutePath = resolve(join(installDir, file.relative_path));
      const pathKey = process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;
      if (owners.has(pathKey)) {
        const existing = owners.get(pathKey);
        checks.push(
          createCheck({
            code: "LINT-ASSET-002",
            result: "error",
            packId: artifact.packId,
            runtime: artifact.runtime,
            target,
            path: absolutePath,
            message: `output path conflicts with ${existing.runtime}/${existing.packId}`,
            remediation: "Rename conflicting runtime asset path to keep install plan deterministic.",
          }),
        );
      } else {
        owners.set(pathKey, { packId: artifact.packId, runtime: artifact.runtime });
      }
    }
  }
}

function summarize(checks, packCount, runtimeCount) {
  const summary = {
    pack_count: packCount,
    runtime_count: runtimeCount,
    check_count: checks.length,
    error_count: 0,
    warning_count: 0,
    note_count: 0,
  };
  for (const check of checks) {
    if (check.result === "error") {
      summary.error_count += 1;
    } else if (check.result === "warning") {
      summary.warning_count += 1;
    } else if (check.result === "note") {
      summary.note_count += 1;
    }
  }
  return summary;
}

function buildNextActions(summary) {
  if (summary.error_count > 0) {
    return [
      "Fix all error-level lint findings before install/update.",
      "Run pairslash lint --phase4 again to verify deterministic output and ownership metadata.",
    ];
  }
  if (summary.warning_count > 0) {
    return [
      "Warnings do not block install by default, but should be addressed before shipping packs.",
    ];
  }
  return ["No blocking lint issues detected for Phase 4 bridge."];
}

export function runLintBridge({ repoRoot, packs = [], runtime = "all", target = "repo" }) {
  const normalizedTarget = normalizeTarget(target);
  if (!SUPPORTED_TARGETS.includes(normalizedTarget)) {
    throw new Error(`unsupported target: ${target}`);
  }

  const { runtimeScope, runtimes } = normalizeRuntimeScope(runtime);
  const checks = [];
  const parsedEntries = parseManifestEntries(repoRoot);
  const selectedEntries = selectManifestEntries(parsedEntries, packs, checks, normalizedTarget);
  const validEntries = [];

  if (selectedEntries.length === 0 && checks.length === 0) {
    checks.push(
      createCheck({
        code: "LINT-SCOPE-001",
        result: "note",
        target: normalizedTarget,
        message: "no pack manifests selected for lint",
        remediation: "Add packs/core/*/pack.manifest.yaml or pass explicit pack ids.",
      }),
    );
  }

  for (const entry of selectedEntries) {
    if (!applyManifestValidation(entry, checks, normalizedTarget)) {
      continue;
    }
    validEntries.push(entry);
    applyRuntimeRangeRule(entry, checks, normalizedTarget);
    applyNamingRule(entry, checks, normalizedTarget);
    applyToolsRule(entry, checks, normalizedTarget);
    applyMcpRule(entry, checks, normalizedTarget);
    applyMemoryRule(entry, checks, normalizedTarget);
    applyInstallTargetRule(entry, checks, normalizedTarget);
    applyOwnershipManifestRule(entry, checks, normalizedTarget);
  }

  applyCrossPackMetadataRules(validEntries, checks, normalizedTarget, runtimes);
  const compiledArtifacts = applyCompileRules({
    repoRoot,
    target: normalizedTarget,
    runtimes,
    validEntries,
    checks,
  });
  applyOutputConflictRule({
    repoRoot,
    target: normalizedTarget,
    compiledArtifacts,
    checks,
  });

  const sortedChecks = sortChecks(checks);
  const issues = sortedChecks.filter((check) => ISSUE_RESULTS.has(check.result));
  const blockingErrors = issues
    .filter((issue) => issue.result === "error")
    .map((issue) => ({
      code: issue.code,
      pack_id: issue.pack_id,
      runtime: issue.runtime,
      message: issue.message,
    }));

  const summary = summarize(sortedChecks, selectedEntries.length, runtimes.length);
  const report = {
    kind: "lint-report",
    schema_version: LINT_REPORT_SCHEMA_VERSION,
    phase: "phase4-bridge",
    generated_at: new Date().toISOString(),
    ok: summary.error_count === 0,
    target: normalizedTarget,
    runtime_scope: runtimeScope,
    summary,
    checks: sortedChecks,
    issues,
    blocking_errors: blockingErrors,
    next_actions: buildNextActions(summary),
  };

  const validationErrors = validateLintReport(report);
  if (validationErrors.length > 0) {
    throw new Error(`invalid lint report :: ${validationErrors.join("; ")}`);
  }
  return report;
}
