import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import YAML from "yaml";

import {
  OWNERSHIP_FILE,
  OVERRIDE_MARKER_FILE,
  PHASE4_SCHEMA_VERSION,
  SUPPORTED_RUNTIMES,
} from "./constants.js";
import {
  normalizePackManifestV2,
  serializePackManifestV2,
  toSerializablePackManifestV2,
} from "./manifest-v2.normalize.js";
import {
  resolveManifestInstallSpec,
  resolveManifestRuntime,
  resolveManifestTarget,
} from "./manifest-resolver.js";
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

function sortManifestRecords(records) {
  return records.slice().sort((left, right) =>
    `${left.packId}\u0000${left.manifestPath}`.localeCompare(`${right.packId}\u0000${right.manifestPath}`),
  );
}

function dedupePackIds(requestedPacks = []) {
  return [...new Set(requestedPacks)].sort((left, right) => left.localeCompare(right));
}

function resolveFallbackPackId(manifestPath) {
  return basename(resolve(manifestPath, ".."));
}

function normalizePackId(value, manifestPath) {
  return typeof value === "string" && value.trim() !== "" ? value : resolveFallbackPackId(manifestPath);
}

function createManifestRecord(
  manifestPath,
  manifest,
  { parseError = null, validationErrors = [], manifestShape = "unknown", normalizationWarnings = [] } = {},
) {
  return {
    manifestPath,
    packId: normalizePackId(manifest?.pack_name ?? manifest?.pack?.id, manifestPath),
    manifest,
    manifestShape,
    normalizationWarnings,
    parseError,
    validationErrors,
    error: parseError ?? (validationErrors.length > 0 ? validationErrors.join("; ") : null),
    isValid: !parseError && validationErrors.length === 0,
  };
}

export function loadPackManifestRecord(manifestPath) {
  try {
    const parsedManifest = loadYamlFile(manifestPath);
    const validationErrors = validatePackManifestV2(parsedManifest);
    const manifest = normalizePackManifestV2(parsedManifest, { attachAliases: true });
    return createManifestRecord(manifestPath, manifest, {
      validationErrors,
      manifestShape: manifest?.__pairslash?.manifest_shape ?? "unknown",
      normalizationWarnings: manifest?.__pairslash?.normalization_warnings ?? [],
    });
  } catch (error) {
    return createManifestRecord(manifestPath, null, {
      parseError: error.message,
    });
  }
}

export function loadPackManifestRecords(repoRoot) {
  return sortManifestRecords(discoverPackManifestPaths(repoRoot).map(loadPackManifestRecord));
}

export function selectPackManifestRecords(records, requestedPacks = [], { includeInvalid = false } = {}) {
  const deduped = dedupePackIds(requestedPacks);
  const selected = [];
  const valid = [];
  const invalid = [];
  const missing = [];

  if (deduped.length === 0) {
    const sortedRecords = sortManifestRecords(records);
    for (const record of sortManifestRecords(records)) {
      if (record.isValid) {
        valid.push(record);
      } else {
        invalid.push(record);
      }
    }
    return {
      selected: includeInvalid ? sortedRecords : valid,
      valid,
      invalid,
      missing,
    };
  }

  for (const packId of deduped) {
    const matches = sortManifestRecords(records.filter((record) => record.packId === packId));
    if (matches.length === 0) {
      missing.push(packId);
      continue;
    }
    for (const record of matches) {
      if (record.isValid) {
        valid.push(record);
      } else {
        invalid.push(record);
      }
      if (includeInvalid || record.isValid) {
        selected.push(record);
      }
    }
  }

  return {
    selected,
    valid,
    invalid,
    missing,
  };
}

export function loadPackManifest(manifestPath) {
  const record = loadPackManifestRecord(manifestPath);
  if (!record.isValid) {
    throw new Error(`${manifestPath} :: ${record.error}`);
  }
  return record.manifest;
}

export function resolvePackDir(repoRoot, manifest) {
  return resolve(repoRoot, manifest.runtime_assets?.source_root ?? manifest.assets.pack_dir);
}

export function getPackId(manifest) {
  return manifest?.pack_name ?? manifest?.pack?.id ?? null;
}

export function getRuntimeTarget(manifest, runtime) {
  try {
    return resolveManifestRuntime(manifest, runtime).runtime_binding;
  } catch {
    const normalized = normalizeRuntime(runtime);
    return manifest?.runtime_targets?.[normalized] ?? null;
  }
}

export function listRuntimeTargets(manifest) {
  return SUPPORTED_RUNTIMES.filter((runtime) =>
    Boolean(manifest?.supported_runtimes?.includes(runtime) || manifest?.runtime_targets?.[runtime]),
  );
}

export function buildManifestTemplate({
  id,
  phase,
  version = "0.4.0",
  displayName = id,
  summary = `${id} workflow pack`,
  category = "planning",
  workflowClass = "read-oriented",
  include,
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
  defaultRecommendation = id === "pairslash-plan",
  supportLevelClaim = id === "pairslash-plan" ? "core-supported" : "official-preview",
  tierClaim = id === "pairslash-plan" ? "core-maintained" : "first-party-official",
  publisherClass = id === "pairslash-plan" ? "core-product" : "first-party",
}) {
  const sortedInclude = include.slice().sort((left, right) => left.localeCompare(right));
  const sortedOverridePaths = overridePaths.slice().sort((left, right) => left.localeCompare(right));
  const sortedCapabilities = [...new Set(capabilities)].sort((left, right) => left.localeCompare(right));
  return normalizePackManifestV2(
    {
    kind: "pack-manifest-v2",
    schema_version: PHASE4_SCHEMA_VERSION,
    pack_name: id,
    display_name: displayName,
    pack_version: version,
    summary,
    category,
    workflow_class: workflowClass,
    phase,
    status: "active",
    canonical_entrypoint: "/skills",
    release_channel: releaseChannel,
    supported_runtimes: SUPPORTED_RUNTIMES.slice(),
    supported_runtime_ranges: {
      codex_cli: ">=0.116.0",
      copilot_cli: ">=0.0.0",
    },
    runtime_bindings: Object.fromEntries(
      SUPPORTED_RUNTIMES.map((runtime) => [
        runtime,
        {
          direct_invocation: runtime === "codex_cli" ? `$${id}` : `/${id}`,
          metadata_mode: runtime === "codex_cli" ? "openai_yaml_optional" : "none",
          install_dir_name: id,
          compatibility: compatibility[runtime],
        },
      ]),
    ),
    install_targets: ["repo", "user"],
    capabilities: sortedCapabilities,
    risk_level: riskLevel,
    required_tools: requiredTools,
    required_mcp_servers: requiredMcpServers,
    memory_permissions: memoryPermissions,
    runtime_assets: {
      source_root: `packs/core/${id}`,
      primary_skill: "SKILL.md",
      entries: sortedInclude.map((relativePath) => ({
        asset_id: relativePath === "SKILL.md" ? "skill" : `source:${relativePath}`,
        runtime: "shared",
        asset_kind: relativePath === "SKILL.md" ? "skill_markdown" : "support_doc",
        install_surface: relativePath === "SKILL.md" ? "canonical_skill" : "support_doc",
        source_path: relativePath,
        generated_path: null,
        generator: "source_copy",
        required: true,
        override_eligible: sortedOverridePaths.includes(relativePath),
      })),
    },
    asset_ownership: {
      ownership_file: OWNERSHIP_FILE,
      ownership_scope: "pack_root",
      safe_delete_policy: "pairslash-owned-only",
      records: [],
    },
    local_override_policy: {
      marker_file: OVERRIDE_MARKER_FILE,
      marker_mode: "state_or_explicit_marker",
      eligible_asset_ids: sortedOverridePaths.map((relativePath) =>
        relativePath === "SKILL.md" ? "skill" : `source:${relativePath}`,
      ),
    },
    update_strategy: {
      mode: "preserve_valid_local_overrides",
      on_non_override_change: "block",
      rollback_strategy: "restore_last_managed_state",
    },
    uninstall_strategy: {
      mode: "pairslash_owned_only",
      detach_modified_files: true,
      preserve_unknown_files: true,
      remove_empty_pack_dir: true,
    },
    smoke_checks: [
      {
        id: "codex-repo-preview-install",
        runtime: "codex_cli",
        target: "repo",
        action: "preview_install",
      },
      {
        id: "copilot-user-doctor",
        runtime: "copilot_cli",
        target: "user",
        action: "doctor",
      },
    ],
    docs_refs: {
      contract: "contract.md",
      example_invocation: "example-invocation.md",
      example_output: "example-output.md",
      validation_checklist: "validation-checklist.md",
    },
    catalog: {
      pack_class: "core",
      maturity: releaseChannel,
      docs_visibility: "public",
      default_discovery: true,
      default_recommendation: defaultRecommendation,
      release_visibility: releaseChannel === "canary" ? "appendix" : "public",
      deprecation_status: "active",
    },
    support: {
      publisher: {
        publisher_id: "pairslash",
        display_name: "PairSlash",
        publisher_class: publisherClass,
        contact: "SECURITY.md",
      },
      tier_claim: tierClaim,
      support_level_claim: supportLevelClaim,
      signature: {
        required: true,
        allow_local_unsigned: true,
      },
      runtime_support: Object.fromEntries(
        SUPPORTED_RUNTIMES.map((runtime) => [
          runtime,
          {
            status:
              compatibility[runtime].canonical_picker === "blocked"
                ? "blocked"
                : compatibility[runtime].canonical_picker === "supported" &&
                    compatibility[runtime].direct_invocation === "supported"
                  ? "supported"
                  : compatibility[runtime].canonical_picker === "unverified" &&
                      compatibility[runtime].direct_invocation === "unverified"
                    ? "unverified"
                    : "partial",
            evidence_ref: "docs/compatibility/runtime-surface-matrix.yaml",
            evidence_kind: "lane-matrix",
            required_for_promotion: true,
          },
        ]),
      ),
      policy_requirements: {
        no_silent_fallback: true,
        preview_required_for_mutation: true,
        explicit_write_only_memory: true,
      },
      maintainers: {
        owner: "pairslash",
        contact: "SECURITY.md",
      },
    },
    },
    { attachAliases: true },
  );
}

export { normalizePackManifestV2, resolveManifestInstallSpec, resolveManifestRuntime, resolveManifestTarget };
export { serializePackManifestV2, toSerializablePackManifestV2 };
