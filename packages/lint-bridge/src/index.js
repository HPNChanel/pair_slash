import { join, resolve } from "node:path";
import process from "node:process";
import { existsSync } from "node:fs";

import { compileCodexPack } from "@pairslash/compiler-codex";
import { compileCopilotPack } from "@pairslash/compiler-copilot";
import {
  CONTRACT_ENGINE_ERROR_CODES,
  buildContractEnvelope,
  parseContractEnvelope,
} from "@pairslash/contract-engine";
import { evaluatePolicy } from "@pairslash/policy-engine";
import * as runtimeCodexAdapter from "@pairslash/runtime-codex-adapter";
import * as runtimeCopilotAdapter from "@pairslash/runtime-copilot-adapter";
import {
  CONTRACT_ENVELOPE_SCHEMA_VERSION,
  LINT_REPORT_SCHEMA_VERSION,
  OWNERSHIP_FILE,
  POLICY_VERDICT_SCHEMA_VERSION,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  loadPackManifestRecords,
  normalizeRuntime,
  normalizeTarget,
  selectPackManifestRecords,
  validateRuntimeRange,
  validateLintReport,
} from "@pairslash/spec-core";

const ISSUE_RESULTS = new Set(["error", "warning", "note"]);
const REQUIRED_CONTRACT_SECTIONS = [
  "input_contract",
  "output_contract",
  "failure_contract",
  "memory_contract",
  "tool_contract",
];
const REQUIRED_MEMORY_WRITE_FIELDS = [
  "kind",
  "title",
  "statement",
  "evidence",
  "scope",
  "confidence",
  "action",
  "tags",
  "source_refs",
  "updated_by",
  "timestamp",
];
const KNOWN_MCP_SERVER_IDS = new Set([
  "filesystem",
  "repo-memory",
  "github",
  "browser",
  "postgres",
  "redis",
  "slack",
  "jira",
]);
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

function unique(values) {
  return [...new Set(values)];
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
  return loadPackManifestRecords(repoRoot);
}

function selectManifestEntries(entries, requestedPacks, checks, target) {
  const { selected, missing } = selectPackManifestRecords(entries, requestedPacks, {
    includeInvalid: true,
  });
  for (const packId of missing) {
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
  }
  return selected;
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

  const errors = entry.validationErrors ?? [];
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
  if ((entry.normalizationWarnings ?? []).length > 0) {
    for (const warning of entry.normalizationWarnings) {
      checks.push(
        createCheck({
          code: "LINT-MANIFEST-002",
          result: "warning",
          packId: entry.packId,
          target,
          path: entry.manifestPath,
          message: warning,
          remediation: "Rewrite the manifest using canonical pack.manifest.yaml v2.1.0 fields.",
        }),
      );
    }
  }
  return true;
}

function applyRuntimeRangeRule(entry, checks, target) {
  const invalid = [];
  for (const runtime of SUPPORTED_RUNTIMES) {
    const range = entry.manifest.supported_runtime_ranges?.[runtime];
    if (!validateRuntimeRange(range)) {
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

function applyTriggerRule(entry, checks, target) {
  const packId = entry.packId;
  const issues = [];
  if (entry.manifest.canonical_entrypoint !== "/skills") {
    issues.push("canonical entrypoint must be /skills");
  }
  const codexInvocation = entry.manifest.runtime_bindings?.codex_cli?.direct_invocation;
  const copilotInvocation = entry.manifest.runtime_bindings?.copilot_cli?.direct_invocation;
  if (codexInvocation !== `$${packId}`) {
    issues.push(`codex trigger must be $${packId}`);
  }
  if (copilotInvocation !== `/${packId}`) {
    issues.push(`copilot trigger must be /${packId}`);
  }
  if (issues.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-TRIGGER-001",
        result: "error",
        packId,
        target,
        path: entry.manifestPath,
        message: issues.join("; "),
        remediation: "Use /skills as canonical entrypoint and runtime-native direct trigger names.",
      }),
    );
    return;
  }
  checks.push(
    createCheck({
      code: "LINT-TRIGGER-001",
      result: "pass",
      packId,
      target,
      path: entry.manifestPath,
      message: "trigger naming is valid for codex and copilot lanes",
    }),
  );
}

function applyNamingRule(entry, checks, target) {
  const packId = entry.packId;
  const codexDir = entry.manifest.runtime_targets?.codex_cli?.skill_directory_name;
  const copilotDir = entry.manifest.runtime_targets?.copilot_cli?.skill_directory_name;
  const workflowClass = entry.manifest.pack?.workflow_class;
  const authority = entry.manifest.memory_permissions?.authority_mode;
  const problems = [];

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

function applyRuntimeSupportRule(entry, checks, target) {
  const runtimes = entry.manifest.supported_runtimes ?? [];
  const missing = SUPPORTED_RUNTIMES.filter((runtime) => !runtimes.includes(runtime));
  if (missing.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-RUNTIME-003",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `supported_runtimes must include codex_cli and copilot_cli; missing: ${missing.join(", ")}`,
        remediation: "Keep one-spec-two-runtimes support explicit in supported_runtimes.",
      }),
    );
    return;
  }
  const degraded = [];
  for (const runtime of SUPPORTED_RUNTIMES) {
    const compatibility = entry.manifest.runtime_bindings?.[runtime]?.compatibility ?? {};
    for (const field of ["canonical_picker", "direct_invocation"]) {
      const value = compatibility[field];
      if (value === "blocked") {
        checks.push(
          createCheck({
            code: "LINT-RUNTIME-004",
            result: "error",
            packId: entry.packId,
            runtime,
            target,
            path: entry.manifestPath,
            message: `runtime compatibility ${runtime}.${field}=blocked is not allowed for shippable Phase 5 workflows`,
            remediation: "Unblock runtime compatibility or mark the pack lane as unsupported outside shippable scope.",
          }),
        );
      } else if (value === "unverified") {
        degraded.push(`${runtime}.${field}=unverified`);
      }
    }
  }
  checks.push(
    createCheck({
      code: "LINT-RUNTIME-003",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: "runtime support declares codex and copilot lanes",
    }),
  );
  if (degraded.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-RUNTIME-004",
        result: "warning",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `runtime support has degraded/unverified surfaces: ${degraded.join(", ")}`,
        remediation: "Keep degraded behavior explicit and tracked before claiming fully supported runtime surfaces.",
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
  const unknown = unique(
    servers
      .map((server) => server?.id)
      .filter((id) => typeof id === "string")
      .filter((id) => !KNOWN_MCP_SERVER_IDS.has(id)),
  );
  if (unknown.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-MCP-003",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `unknown MCP dependency id(s): ${unknown.join(", ")}`,
        remediation: "Declare only known MCP dependency ids or register the dependency id in lint policy.",
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

function applyReferenceRule(repoRoot, entry, checks, target) {
  const sourceRoot = entry.manifest.runtime_assets?.source_root ?? `packs/core/${entry.packId}`;
  const sourceRootPath = resolve(repoRoot, sourceRoot);
  const sourceEntries = (entry.manifest.runtime_assets?.entries ?? []).filter((asset) => asset.source_path);
  const sourcePathSet = new Set(sourceEntries.map((asset) => asset.source_path));
  const missing = [];

  if (!existsSync(sourceRootPath)) {
    missing.push(sourceRoot);
  }

  for (const asset of sourceEntries) {
    const sourcePath = resolve(sourceRootPath, asset.source_path);
    if (!existsSync(sourcePath)) {
      missing.push(`${sourceRoot}/${asset.source_path}`);
    }
  }

  const docsRefs = entry.manifest.docs_refs ?? {};
  const docsKeys = ["contract", "example_invocation", "example_output", "validation_checklist"];
  const notDeclaredAsSource = [];
  for (const key of docsKeys) {
    const relativePath = docsRefs[key];
    if (typeof relativePath !== "string" || relativePath.trim() === "") {
      continue;
    }
    const docPath = resolve(sourceRootPath, relativePath);
    if (!existsSync(docPath)) {
      missing.push(`${sourceRoot}/${relativePath}`);
      continue;
    }
    if (!sourcePathSet.has(relativePath)) {
      notDeclaredAsSource.push(relativePath);
    }
  }

  if (missing.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-REF-001",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `missing file references: ${unique(missing).sort((a, b) => a.localeCompare(b)).join(", ")}`,
        remediation: "Fix docs_refs/runtime_assets source paths so lint can resolve pack file references deterministically.",
      }),
    );
    return;
  }

  if (notDeclaredAsSource.length > 0) {
    checks.push(
      createCheck({
        code: "LINT-REF-002",
        result: "error",
        packId: entry.packId,
        target,
        path: entry.manifestPath,
        message: `docs_refs must be declared in runtime_assets.entries source_path: ${notDeclaredAsSource.join(", ")}`,
        remediation: "Add docs reference files to runtime_assets.entries as shared source_copy assets.",
      }),
    );
    return;
  }

  checks.push(
    createCheck({
      code: "LINT-REF-001",
      result: "pass",
      packId: entry.packId,
      target,
      path: entry.manifestPath,
      message: "file and docs references resolve correctly",
    }),
  );
}

function applyMemoryRule(entry, checks, target) {
  const permissions = entry.manifest.memory_permissions ?? {};
  const capabilities = entry.manifest.capabilities ?? [];
  const workflowClass = entry.manifest.workflow_class ?? entry.manifest.pack?.workflow_class;
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
  if (
    workflowClass === "read-oriented" &&
    (permissions.authority_mode === "write-authority" ||
      permissions.global_project_memory === "write" ||
      capabilities.includes("memory_write_global"))
  ) {
    problems.push("read-oriented workflow must not declare authoritative memory write");
  }
  if (
    workflowClass === "write-authority" &&
    (permissions.global_project_memory !== "write" || !capabilities.includes("preview_emit"))
  ) {
    problems.push("write-authority workflow requires global_project_memory=write and preview_emit capability");
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

function applyContractPolicyRules({
  target,
  runtimes,
  validEntries,
  checks,
  policyVerdicts,
  contractBuilder,
}) {
  for (const entry of validEntries) {
    for (const runtime of runtimes) {
      if (!entry.manifest.supported_runtimes?.includes(runtime)) {
        continue;
      }
      try {
        const contract = parseContractEnvelope(
          contractBuilder({
            manifest: entry.manifest,
            runtime,
            target,
            action: "lint",
          }),
        );
        const missingSections = REQUIRED_CONTRACT_SECTIONS.filter(
          (section) => !contract[section] || typeof contract[section] !== "object",
        );
        if (missingSections.length > 0) {
          checks.push(
            createCheck({
              code: "LINT-CONTRACT-001",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: `missing required contract sections: ${missingSections.join(", ")}`,
              remediation: "Provide full input/output/failure/memory/tool contract sections.",
            }),
          );
          continue;
        }
        checks.push(
          createCheck({
            code: "LINT-CONTRACT-001",
            result: "pass",
            packId: entry.packId,
            runtime,
            target,
            path: entry.manifestPath,
            message: "contract includes input/output/failure/memory/tool sections",
          }),
        );

        const degradedBinding = [
          entry.manifest.runtime_bindings?.[runtime]?.compatibility?.canonical_picker,
          entry.manifest.runtime_bindings?.[runtime]?.compatibility?.direct_invocation,
        ].some((value) => value === "unverified" || value === "blocked");
        if (degradedBinding && (contract.capability_scope?.degraded_behavior_notes?.length ?? 0) === 0) {
          checks.push(
            createCheck({
              code: "LINT-RUNTIME-005",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "degraded runtime compatibility requires explicit degraded behavior notes",
              remediation: "Publish degraded behavior notes in contract capability scope.",
            }),
          );
        }

        const isWriteAuthority = contract.workflow_class === "write-authority";
        if (contract.workflow_class === "read-oriented" && contract.memory_contract?.authoritative_write_allowed) {
          checks.push(
            createCheck({
              code: "LINT-MEM-002",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "read-oriented workflow contract declares authoritative memory write",
              remediation: "Set memory_contract.authoritative_write_allowed=false for read-oriented workflows.",
            }),
          );
        }
        if (
          isWriteAuthority &&
          (contract.memory_contract?.preview_required !== true ||
            contract.output_contract?.allowed_side_effects_summary?.preview_required !== true)
        ) {
          checks.push(
            createCheck({
              code: "LINT-MEM-003",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "write-authority workflow contract is missing explicit preview requirement",
              remediation: "Set memory_contract.preview_required and output side-effects preview_required to true.",
            }),
          );
        }

        const policyReferenceIssues = [];
        if (!Array.isArray(contract.failure_contract?.categories) || contract.failure_contract.categories.length === 0) {
          policyReferenceIssues.push("failure_contract.categories must be non-empty");
        }
        if (!Array.isArray(contract.failure_contract?.codes) || contract.failure_contract.codes.length === 0) {
          policyReferenceIssues.push("failure_contract.codes must be non-empty");
        }
        if (
          !Array.isArray(contract.output_contract?.machine_readable_fields) ||
          !contract.output_contract.machine_readable_fields.includes("policy_verdict")
        ) {
          policyReferenceIssues.push("output_contract.machine_readable_fields must include policy_verdict");
        }
        if (policyReferenceIssues.length > 0) {
          checks.push(
            createCheck({
              code: "LINT-POLICY-002",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: policyReferenceIssues.join("; "),
              remediation: "Declare policy references explicitly in output/failure contract sections.",
            }),
          );
        } else {
          checks.push(
            createCheck({
              code: "LINT-POLICY-002",
              result: "pass",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "policy references are explicit and machine-readable",
            }),
          );
        }

        if (contract.failure_contract?.no_silent_fallback !== true) {
          checks.push(
            createCheck({
              code: "LINT-POLICY-003",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "failure_contract.no_silent_fallback must be true",
              remediation: "Enable no-silent-fallback semantics in failure contract metadata.",
            }),
          );
        }

        const verdict = evaluatePolicy({
          manifest: entry.manifest,
          contract,
          request: {
            action:
              entry.manifest.memory_permissions?.global_project_memory === "write"
                ? "memory.write-global"
                : "lint",
            requested_runtime: runtime,
            requested_target: target,
            apply: entry.manifest.memory_permissions?.global_project_memory === "write",
            preview_requested: entry.manifest.memory_permissions?.global_project_memory !== "write",
            approval:
              entry.manifest.memory_permissions?.global_project_memory === "write"
                ? "none"
                : "explicit",
            capability_request: entry.manifest.capabilities ?? [],
          },
        });
        if (verdict.enforcement_context?.no_silent_fallback !== true) {
          checks.push(
            createCheck({
              code: "LINT-POLICY-003",
              result: "error",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "policy enforcement context must report no_silent_fallback=true",
              remediation: "Fix policy enforcement metadata to keep runtime fallback behavior explicit.",
            }),
          );
        } else {
          checks.push(
            createCheck({
              code: "LINT-POLICY-003",
              result: "pass",
              packId: entry.packId,
              runtime,
              target,
              path: entry.manifestPath,
              message: "no-silent-fallback metadata is explicit in contract and policy verdict",
            }),
          );
        }

        if (entry.packId === "pairslash-memory-write-global") {
          const strictViolations = [];
          if (!isWriteAuthority) {
            strictViolations.push("workflow_class must be write-authority");
          }
          if (contract.memory_contract?.mode !== "write" || !contract.memory_contract?.authoritative_write_allowed) {
            strictViolations.push("memory_contract must declare authoritative write mode");
          }
          if (contract.memory_contract?.preview_required !== true) {
            strictViolations.push("memory_contract.preview_required must be true");
          }
          if (contract.output_contract?.allowed_side_effects_summary?.explicit_approval_required !== true) {
            strictViolations.push("output side-effects must require explicit approval");
          }
          const requiredFields = contract.input_contract?.required_fields ?? [];
          const missingInputFields = REQUIRED_MEMORY_WRITE_FIELDS.filter((field) => !requiredFields.includes(field));
          if (missingInputFields.length > 0) {
            strictViolations.push(`input contract missing required fields: ${missingInputFields.join(", ")}`);
          }
          if (verdict.overall_verdict === "allow") {
            strictViolations.push("policy verdict for apply-without-preview must not be allow");
          }
          if (strictViolations.length > 0) {
            checks.push(
              createCheck({
                code: "LINT-MWG-001",
                result: "error",
                packId: entry.packId,
                runtime,
                target,
                path: entry.manifestPath,
                message: strictViolations.join("; "),
                remediation: "Satisfy write-global strict contract/policy requirements before shipping.",
              }),
            );
          } else {
            checks.push(
              createCheck({
                code: "LINT-MWG-001",
                result: "pass",
                packId: entry.packId,
                runtime,
                target,
                path: entry.manifestPath,
                message: "pairslash-memory-write-global passes strict Phase 5 lint checks",
              }),
            );
          }
        }

        policyVerdicts.push({
          pack_id: entry.packId,
          ...verdict,
        });
        checks.push(
          createCheck({
            code: "LINT-POLICY-001",
            result: verdict.overall_verdict === "deny" ? "error" : "pass",
            packId: entry.packId,
            runtime,
            target,
            path: entry.manifestPath,
            message: `contract/policy verdict=${verdict.overall_verdict}`,
            remediation:
              verdict.overall_verdict === "deny"
                ? "Fix contract/policy violations before shipping the pack."
                : null,
          }),
        );
      } catch (error) {
        const contractErrorCodes = new Set([
          CONTRACT_ENGINE_ERROR_CODES.CONTRACT_REQUIRED,
          CONTRACT_ENGINE_ERROR_CODES.CONTRACT_SCHEMA_INVALID,
          CONTRACT_ENGINE_ERROR_CODES.MISSING_CONTRACT_SECTION,
        ]);
        const contractError =
          contractErrorCodes.has(error?.code) ||
          typeof error?.message === "string" &&
            (error.message.includes("missing required contract section") ||
              error.message.includes("invalid contract envelope"));
        checks.push(
          createCheck({
            code: contractError ? "LINT-CONTRACT-001" : "LINT-POLICY-001",
            result: "error",
            packId: entry.packId,
            runtime,
            target,
            path: entry.manifestPath,
            message: `contract/policy evaluation failed: ${error.message}`,
            remediation: "Fix contract/policy schema drift before shipping the pack.",
          }),
        );
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
      "Run pairslash lint again to verify deterministic output, contract policy, and ownership metadata.",
    ];
  }
  if (summary.warning_count > 0) {
    return [
      "Warnings do not block install by default, but should be addressed before shipping packs.",
    ];
  }
  return ["No blocking lint issues detected for Phase 5 contract/policy gate."];
}

export function runLintBridge({
  repoRoot,
  packs = [],
  runtime = "all",
  target = "repo",
  contractBuilder = buildContractEnvelope,
} = {}) {
  const normalizedTarget = normalizeTarget(target);
  if (!SUPPORTED_TARGETS.includes(normalizedTarget)) {
    throw new Error(`unsupported target: ${target}`);
  }

  const { runtimeScope, runtimes } = normalizeRuntimeScope(runtime);
  const checks = [];
  const policyVerdicts = [];
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
    applyTriggerRule(entry, checks, normalizedTarget);
    applyRuntimeRangeRule(entry, checks, normalizedTarget);
    applyRuntimeSupportRule(entry, checks, normalizedTarget);
    applyNamingRule(entry, checks, normalizedTarget);
    applyReferenceRule(repoRoot, entry, checks, normalizedTarget);
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
  applyContractPolicyRules({
    target: normalizedTarget,
    runtimes,
    validEntries,
    checks,
    policyVerdicts,
    contractBuilder,
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
    phase: "phase5-contract-policy",
    generated_at: new Date().toISOString(),
    ok: summary.error_count === 0,
    target: normalizedTarget,
    runtime_scope: runtimeScope,
    contract_schema_version: CONTRACT_ENVELOPE_SCHEMA_VERSION,
    policy_schema_version: POLICY_VERDICT_SCHEMA_VERSION,
    summary,
    checks: sortedChecks,
    issues,
    blocking_errors: blockingErrors,
    policy_verdicts: policyVerdicts,
    next_actions: buildNextActions(summary),
  };

  const validationErrors = validateLintReport(report);
  if (validationErrors.length > 0) {
    throw new Error(`invalid lint report :: ${validationErrors.join("; ")}`);
  }
  return report;
}
