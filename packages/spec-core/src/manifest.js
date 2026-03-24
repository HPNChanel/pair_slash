import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import YAML from "yaml";

import {
  OWNERSHIP_FILE,
  OVERRIDE_MARKER_FILE,
  PHASE4_SCHEMA_VERSION,
  SUPPORTED_RUNTIMES,
} from "./constants.js";
import { exists, normalizeRuntime, walkFiles } from "./utils.js";
import { validatePackManifestV2 } from "./validate.js";

export function discoverPackManifestPaths(repoRoot) {
  const packsRoot = resolve(repoRoot, "packs", "core");
  if (!exists(packsRoot)) {
    return [];
  }
  return walkFiles(packsRoot)
    .filter((filePath) => basename(filePath) === "pack.manifest.yaml")
    .sort((a, b) => a.localeCompare(b));
}

export function loadYamlFile(path) {
  return YAML.parse(readFileSync(path, "utf8"));
}

export function loadPackManifest(manifestPath) {
  const manifest = loadYamlFile(manifestPath);
  const errors = validatePackManifestV2(manifest);
  if (errors.length > 0) {
    throw new Error(`${manifestPath} :: ${errors.join("; ")}`);
  }
  return manifest;
}

export function resolvePackDir(repoRoot, manifest) {
  return resolve(repoRoot, manifest.assets.pack_dir);
}

export function getPackId(manifest) {
  return manifest?.pack?.id ?? null;
}

export function getRuntimeTarget(manifest, runtime) {
  const normalized = normalizeRuntime(runtime);
  return manifest?.runtime_targets?.[normalized] ?? null;
}

export function listRuntimeTargets(manifest) {
  return SUPPORTED_RUNTIMES.filter((runtime) => Boolean(manifest?.runtime_targets?.[runtime]));
}

export function buildManifestTemplate({
  id,
  phase,
  version = "0.4.0",
  displayName = id,
  summary = `${id} workflow pack`,
  description = null,
  category = "planning",
  workflowClass = "read-oriented",
  include,
  tags = [],
  capabilities = ["repo_read", "memory_read"],
  riskLevel = "low",
  requiredTools = [],
  requiredMcpServers = [],
  memoryPermissions = {
    authority_mode: "read-only",
    explicit_write_only: true,
    global_project_memory: "read",
    task_memory: "read",
    session_artifacts: "implicit-read",
    audit_log: "none",
  },
  overridePaths = include,
  releaseChannel = "stable",
  compatibility = {
    codex_cli: {
      canonical_picker: "supported",
      direct_invocation: "supported",
    },
    copilot_cli: {
      canonical_picker: "supported",
      direct_invocation: "unverified",
    },
  },
}) {
  return {
    kind: "pack-manifest-v2",
    schema_version: PHASE4_SCHEMA_VERSION,
    version,
    release_channel: releaseChannel,
    pack: {
      id,
      display_name: displayName,
      summary,
      category,
      workflow_class: workflowClass,
      phase,
      status: "active",
      canonical_entrypoint: "/skills",
    },
    ...(description ? { description } : {}),
    tags,
    supported_runtime_ranges: {
      codex_cli: ">=0.116.0",
      copilot_cli: ">=0.0.0",
    },
    install_targets: ["repo", "user"],
    capabilities,
    risk_level: riskLevel,
    required_tools: requiredTools,
    required_mcp_servers: requiredMcpServers,
    memory_permissions: memoryPermissions,
    assets: {
      pack_dir: `packs/core/${id}`,
      primary_skill_file: "SKILL.md",
      include,
      docs: {
        contract_file: "contract.md",
        example_invocation_file: "example-invocation.md",
        example_output_file: "example-output.md",
        validation_checklist_file: "validation-checklist.md",
      },
    },
    ownership: {
      ownership_file: OWNERSHIP_FILE,
      ownership_scope: "pack_root",
      safe_delete_policy: "pairslash-owned-only",
      record_generated_files: true,
      generated_files: [OWNERSHIP_FILE],
    },
    local_override_policy: {
      strategy: "preserve_valid_local_overrides",
      eligible_paths: overridePaths,
      marker_file: OVERRIDE_MARKER_FILE,
      marker_mode: "state_or_explicit_marker",
      rollback_strategy: "restore_last_managed_state",
    },
    runtime_targets: Object.fromEntries(
      SUPPORTED_RUNTIMES.map((runtime) => [
        runtime,
        {
          direct_invocation: runtime === "codex_cli" ? `$${id}` : `/${id}`,
          adapter: {
            metadata_mode: runtime === "codex_cli" ? "openai_yaml_optional" : "none",
            skill_directory_name: id,
          },
          compatibility: compatibility[runtime],
        },
      ]),
    ),
    compatibility_evidence_refs: [],
  };
}
