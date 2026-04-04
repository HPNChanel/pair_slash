import {
  COMPATIBILITY_STATUSES,
  LEGACY_PHASE4_SCHEMA_VERSION,
  MANIFEST_MARKER_MODES,
  OWNERSHIP_FILE,
  OVERRIDE_MARKER_FILE,
  PACK_DEPRECATION_STATUSES,
  PACK_DOCS_VISIBILITY,
  PACK_PUBLISHER_CLASSES,
  PACK_RELEASE_VISIBILITY,
  PACK_RUNTIME_EVIDENCE_KINDS,
  PACK_RUNTIME_SUPPORT_STATUSES,
  PACK_SUPPORT_LEVELS,
  PACK_TRUST_TIERS,
  PACK_STATUSES,
  PHASE4_SCHEMA_VERSION,
  RELEASE_CHANNELS,
  RISK_LEVELS,
  RUNTIME_METADATA_MODES,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  UNINSTALL_BEHAVIORS,
  WORKFLOW_CLASSES,
} from "./constants.js";

function sortStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim() !== ""))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function sortByKey(items, key) {
  return items.slice().sort((left, right) => `${left[key]}`.localeCompare(`${right[key]}`));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return null;
}

function pickFirstInteger(...values) {
  for (const value of values) {
    if (Number.isInteger(value)) {
      return value;
    }
  }
  return null;
}

function sourceAssetId(relativePath) {
  return relativePath === "SKILL.md" ? "skill" : `source:${relativePath}`;
}

function sourcePathsFromEntries(entries = []) {
  return sortStrings(entries.map((entry) => entry.source_path).filter(Boolean));
}

function inferAssetKind(relativePath, primarySkill) {
  return relativePath === primarySkill ? "skill_markdown" : "support_doc";
}

function inferInstallSurface(relativePath, primarySkill) {
  return relativePath === primarySkill ? "canonical_skill" : "support_doc";
}

function normalizeCompatibility(source = {}, runtime) {
  const defaultDirect = runtime === "codex_cli" ? "supported" : "unverified";
  const canonicalPicker = COMPATIBILITY_STATUSES.includes(source.canonical_picker)
    ? source.canonical_picker
    : "supported";
  const directInvocation = COMPATIBILITY_STATUSES.includes(source.direct_invocation)
    ? source.direct_invocation
    : defaultDirect;
  return {
    canonical_picker: canonicalPicker,
    direct_invocation: directInvocation,
  };
}

function normalizeRuntimeBindings(record, packName, { preferCanonical = false } = {}) {
  const bindings = {};
  for (const runtime of SUPPORTED_RUNTIMES) {
    const canonicalBinding = isObject(record.runtime_bindings?.[runtime]) ? record.runtime_bindings[runtime] : {};
    const legacyBinding = isObject(record.runtime_targets?.[runtime]) ? record.runtime_targets[runtime] : {};
    bindings[runtime] = {
      direct_invocation:
        pickFirstString(
          ...(preferCanonical
            ? [canonicalBinding.direct_invocation, legacyBinding.direct_invocation]
            : [legacyBinding.direct_invocation, canonicalBinding.direct_invocation]),
        ) ?? (runtime === "codex_cli" ? `$${packName}` : `/${packName}`),
      metadata_mode:
        pickFirstString(
          ...(preferCanonical
            ? [canonicalBinding.metadata_mode, legacyBinding.metadata_mode]
            : [legacyBinding.metadata_mode, canonicalBinding.metadata_mode]),
        ) ?? (runtime === "codex_cli" ? "openai_yaml_optional" : "none"),
      install_dir_name:
        pickFirstString(
          ...(preferCanonical
            ? [canonicalBinding.install_dir_name, legacyBinding.skill_directory_name]
            : [legacyBinding.skill_directory_name, canonicalBinding.install_dir_name]),
        ) ?? packName,
      compatibility: normalizeCompatibility(
        preferCanonical
          ? canonicalBinding.compatibility ?? legacyBinding.compatibility
          : legacyBinding.compatibility ?? canonicalBinding.compatibility,
        runtime,
      ),
    };
  }
  return bindings;
}

function deriveSupportedRuntimes(record) {
  const runtimeKeys = [
    ...(Array.isArray(record.supported_runtimes) ? record.supported_runtimes : []),
    ...Object.keys(record.supported_runtime_ranges ?? {}),
    ...Object.keys(record.runtime_bindings ?? {}),
    ...Object.keys(record.runtime_targets ?? {}),
  ];
  const runtimes = sortStrings(runtimeKeys.filter((runtime) => SUPPORTED_RUNTIMES.includes(runtime)));
  return runtimes.length > 0 ? runtimes : SUPPORTED_RUNTIMES.slice();
}

function deriveSupportedRuntimeRanges(record) {
  const legacyRanges = isObject(record.supported_runtime_ranges) ? record.supported_runtime_ranges : {};
  return {
    codex_cli: pickFirstString(legacyRanges.codex_cli) ?? ">=0.116.0",
    copilot_cli: pickFirstString(legacyRanges.copilot_cli) ?? ">=0.0.0",
  };
}

function deriveDocsRefs(record) {
  const docsRefs = isObject(record.docs_refs) ? record.docs_refs : {};
  const legacyDocs = isObject(record.assets?.docs) ? record.assets.docs : {};
  return {
    contract: pickFirstString(docsRefs.contract, legacyDocs.contract_file) ?? "contract.md",
    example_invocation:
      pickFirstString(docsRefs.example_invocation, legacyDocs.example_invocation_file) ?? "example-invocation.md",
    example_output:
      pickFirstString(docsRefs.example_output, legacyDocs.example_output_file) ?? "example-output.md",
    validation_checklist:
      pickFirstString(docsRefs.validation_checklist, legacyDocs.validation_checklist_file) ?? "validation-checklist.md",
  };
}

function deriveRuntimeSupportStatus(runtimeBindings, runtime) {
  const compatibility = runtimeBindings?.[runtime]?.compatibility ?? {};
  const canonicalStatus = COMPATIBILITY_STATUSES.includes(compatibility.canonical_picker)
    ? compatibility.canonical_picker
    : "supported";
  const directStatus = COMPATIBILITY_STATUSES.includes(compatibility.direct_invocation)
    ? compatibility.direct_invocation
    : runtime === "codex_cli"
      ? "supported"
      : "unverified";
  if (canonicalStatus === "blocked") {
    return "blocked";
  }
  if (canonicalStatus === "supported" && directStatus === "supported") {
    return "supported";
  }
  if (canonicalStatus === "unverified" && directStatus === "unverified") {
    return "unverified";
  }
  return "partial";
}

function deriveCatalog(record, packName, releaseChannel, status) {
  const catalog = isObject(record.catalog) ? record.catalog : {};
  const deprecationStatus =
    pickFirstString(catalog.deprecation_status) ?? (status === "deprecated" ? "deprecated" : "active");
  const docsVisibility = pickFirstString(catalog.docs_visibility) ?? "public";
  const releaseVisibility = pickFirstString(catalog.release_visibility) ?? (releaseChannel === "canary" ? "appendix" : "public");
  return {
    pack_class: pickFirstString(catalog.pack_class) ?? "core",
    maturity:
      pickFirstString(catalog.maturity, releaseChannel) ?? "stable",
    docs_visibility:
      PACK_DOCS_VISIBILITY.includes(docsVisibility) ? docsVisibility : "public",
    default_discovery:
      typeof catalog.default_discovery === "boolean" ? catalog.default_discovery : true,
    default_recommendation:
      typeof catalog.default_recommendation === "boolean"
        ? catalog.default_recommendation
        : packName === "pairslash-plan",
    release_visibility:
      PACK_RELEASE_VISIBILITY.includes(releaseVisibility) ? releaseVisibility : "public",
    deprecation_status:
      PACK_DEPRECATION_STATUSES.includes(deprecationStatus) ? deprecationStatus : "active",
    replacement_pack: pickFirstString(catalog.replacement_pack) ?? null,
    backward_compatibility_notes: sortStrings(catalog.backward_compatibility_notes ?? []),
  };
}

function deriveSupport(record, packName, runtimeBindings, memoryPermissions) {
  const support = isObject(record.support) ? record.support : {};
  const publisher = isObject(support.publisher) ? support.publisher : {};
  const defaultPublisherClass =
    memoryPermissions.global_project_memory === "write" || packName === "pairslash-plan"
      ? "core-product"
      : "first-party";
  const tierClaim =
    pickFirstString(support.tier_claim) ??
    (memoryPermissions.global_project_memory === "write" || packName === "pairslash-plan"
      ? "core-maintained"
      : "first-party-official");
  const supportLevelClaim =
    pickFirstString(support.support_level_claim) ??
    (packName === "pairslash-plan" ? "core-supported" : "official-preview");
  const runtimeSupport = Object.fromEntries(
    SUPPORTED_RUNTIMES.map((runtime) => {
      const runtimeSupportRecord = isObject(support.runtime_support?.[runtime]) ? support.runtime_support[runtime] : {};
      const evidenceRef = pickFirstString(runtimeSupportRecord.evidence_ref);
      return [
        runtime,
        {
          status:
            pickFirstString(runtimeSupportRecord.status) ?? deriveRuntimeSupportStatus(runtimeBindings, runtime),
          evidence_ref: evidenceRef ?? null,
          evidence_kind:
            pickFirstString(runtimeSupportRecord.evidence_kind) ?? (evidenceRef ? "lane-matrix" : "docs-only"),
          required_for_promotion:
            typeof runtimeSupportRecord.required_for_promotion === "boolean"
              ? runtimeSupportRecord.required_for_promotion
              : true,
        },
      ];
    }),
  );
  return {
    publisher: {
      publisher_id: pickFirstString(publisher.publisher_id) ?? "pairslash",
      display_name: pickFirstString(publisher.display_name) ?? "PairSlash",
      publisher_class:
        PACK_PUBLISHER_CLASSES.includes(pickFirstString(publisher.publisher_class) ?? defaultPublisherClass)
          ? pickFirstString(publisher.publisher_class) ?? defaultPublisherClass
          : defaultPublisherClass,
      contact: pickFirstString(publisher.contact) ?? "SECURITY.md",
    },
    tier_claim: PACK_TRUST_TIERS.includes(tierClaim) ? tierClaim : "first-party-official",
    support_level_claim:
      PACK_SUPPORT_LEVELS.includes(supportLevelClaim) ? supportLevelClaim : "official-preview",
    signature: {
      required:
        typeof support.signature?.required === "boolean" ? support.signature.required : true,
      allow_local_unsigned:
        typeof support.signature?.allow_local_unsigned === "boolean"
          ? support.signature.allow_local_unsigned
          : true,
    },
    runtime_support: Object.fromEntries(
      SUPPORTED_RUNTIMES.map((runtime) => {
        const runtimeRecord = runtimeSupport[runtime];
        return [
          runtime,
          {
            status:
              PACK_RUNTIME_SUPPORT_STATUSES.includes(runtimeRecord.status)
                ? runtimeRecord.status
                : "unverified",
            evidence_ref: runtimeRecord.evidence_ref,
            evidence_kind:
              PACK_RUNTIME_EVIDENCE_KINDS.includes(runtimeRecord.evidence_kind)
                ? runtimeRecord.evidence_kind
                : "lane-matrix",
            required_for_promotion: runtimeRecord.required_for_promotion,
          },
        ];
      }),
    ),
    policy_requirements: {
      no_silent_fallback: true,
      preview_required_for_mutation: true,
      explicit_write_only_memory: true,
    },
    maintainers: {
      owner: pickFirstString(support.maintainers?.owner) ?? "pairslash",
      contact: pickFirstString(support.maintainers?.contact) ?? "SECURITY.md",
    },
  };
}

function buildSourceEntries(record, primarySkill, { preferCanonical = false } = {}) {
  const overridePaths = new Set(record.local_override_policy?.eligible_paths ?? []);
  const canonicalEntries = Array.isArray(record.runtime_assets?.entries)
    ? record.runtime_assets.entries.filter((entry) => entry?.source_path)
    : [];
  const canonicalByPath = new Map(canonicalEntries.map((entry) => [entry.source_path, entry]));
  const sourcePaths =
    preferCanonical
      ? canonicalEntries.length > 0
        ? sourcePathsFromEntries(canonicalEntries)
        : sortStrings(record.assets?.include ?? [])
      : Array.isArray(record.assets?.include) && record.assets.include.length > 0
        ? sortStrings(record.assets.include)
        : sourcePathsFromEntries(canonicalEntries);

  return sourcePaths.map((relativePath) => {
    const existing = canonicalByPath.get(relativePath) ?? {};
    return {
      asset_id: existing.asset_id ?? sourceAssetId(relativePath),
      runtime: "shared",
      asset_kind: existing.asset_kind ?? inferAssetKind(relativePath, primarySkill),
      install_surface: existing.install_surface ?? inferInstallSurface(relativePath, primarySkill),
      source_path: relativePath,
      generated_path: null,
      generator: "source_copy",
      required: existing.required ?? true,
      override_eligible: overridePaths.has(relativePath) || existing.override_eligible === true,
    };
  });
}

function defaultGeneratedEntries(record) {
  const workflowClass = pickFirstString(record.workflow_class, record.pack?.workflow_class) ?? "read-oriented";
  const mcpEnabled = Array.isArray(record.required_mcp_servers) && record.required_mcp_servers.length > 0;
  const generated = [
    {
      asset_id: "ownership-receipt",
      runtime: "shared",
      asset_kind: "ownership_manifest",
      install_surface: "metadata",
      source_path: null,
      generated_path: OWNERSHIP_FILE,
      generator: "pairslash_ownership_receipt",
      required: true,
      override_eligible: false,
    },
    {
      asset_id: "codex-metadata",
      runtime: "codex_cli",
      asset_kind: "runtime_manifest",
      install_surface: "metadata",
      source_path: null,
      generated_path: "agents/openai.yaml",
      generator: "codex_metadata",
      required: true,
      override_eligible: false,
    },
    {
      asset_id: "codex-context",
      runtime: "codex_cli",
      asset_kind: "context_fragment",
      install_surface: "context",
      source_path: null,
      generated_path: "fragments/context/runtime-context.md",
      generator: "codex_context",
      required: true,
      override_eligible: false,
    },
    {
      asset_id: "codex-config",
      runtime: "codex_cli",
      asset_kind: "config_fragment",
      install_surface: "config",
      source_path: null,
      generated_path: "fragments/config/pack-config.yaml",
      generator: "codex_config",
      required: true,
      override_eligible: false,
    },
    {
      asset_id: "copilot-package",
      runtime: "copilot_cli",
      asset_kind: "runtime_manifest",
      install_surface: "metadata",
      source_path: null,
      generated_path: "package/pairslash-bundle.json",
      generator: "copilot_package",
      required: true,
      override_eligible: false,
    },
    {
      asset_id: "copilot-agent-context",
      runtime: "copilot_cli",
      asset_kind: "agent_fragment",
      install_surface: "agent",
      source_path: null,
      generated_path: "agents/runtime-context.md",
      generator: "copilot_agent",
      required: true,
      override_eligible: false,
    },
  ];

  if (workflowClass === "write-authority") {
    generated.push({
      asset_id: "codex-write-authority",
      runtime: "codex_cli",
      asset_kind: "config_fragment",
      install_surface: "config",
      source_path: null,
      generated_path: "fragments/config/write-authority.yaml",
      generator: "codex_write_authority",
      required: true,
      override_eligible: false,
    });
  }

  if (workflowClass === "write-authority" || mcpEnabled) {
    generated.push({
      asset_id: "copilot-preflight",
      runtime: "copilot_cli",
      asset_kind: "hook_script",
      install_surface: "hook",
      source_path: null,
      generated_path: "hooks/preflight.yaml",
      generator: "copilot_preflight",
      required: true,
      override_eligible: false,
    });
  }

  if (mcpEnabled) {
    generated.push(
      {
        asset_id: "codex-mcp",
        runtime: "codex_cli",
        asset_kind: "mcp_config",
        install_surface: "mcp",
        source_path: null,
        generated_path: "fragments/mcp/servers.yaml",
        generator: "codex_mcp",
        required: true,
        override_eligible: false,
      },
      {
        asset_id: "copilot-mcp",
        runtime: "copilot_cli",
        asset_kind: "mcp_config",
        install_surface: "mcp",
        source_path: null,
        generated_path: "mcp/servers.yaml",
        generator: "copilot_mcp",
        required: true,
        override_eligible: false,
      },
    );
  }

  return generated;
}

function buildGeneratedEntries(record) {
  const existingGenerated = Array.isArray(record.runtime_assets?.entries)
    ? record.runtime_assets.entries.filter((entry) => entry?.generated_path)
    : [];
  const derivedById = new Map(defaultGeneratedEntries(record).map((entry) => [entry.asset_id, entry]));
  for (const entry of existingGenerated) {
    if (!entry.asset_id) {
      continue;
    }
    derivedById.set(entry.asset_id, {
      ...derivedById.get(entry.asset_id),
      ...clone(entry),
    });
  }
  return sortByKey([...derivedById.values()], "asset_id");
}

function buildEligibleAssetIds(record, sourceEntries, { preferCanonical = false } = {}) {
  const pathToAssetId = new Map(sourceEntries.map((entry) => [entry.source_path, entry.asset_id]));
  const explicitIds = Array.isArray(record.local_override_policy?.eligible_asset_ids)
    ? sortStrings(record.local_override_policy.eligible_asset_ids)
    : [];
  const derivedIds = Array.isArray(record.local_override_policy?.eligible_paths)
    ? sortStrings(
        record.local_override_policy.eligible_paths
          .map((relativePath) => pathToAssetId.get(relativePath))
          .filter(Boolean),
      )
    : [];
  if (preferCanonical) {
    return explicitIds.length > 0 ? explicitIds : derivedIds;
  }
  return Array.isArray(record.local_override_policy?.eligible_paths) ? derivedIds : explicitIds;
}

function buildAssetOwnership(record, assetEntries) {
  const canonicalOwnership = isObject(record.asset_ownership) ? record.asset_ownership : {};
  const legacyOwnership = isObject(record.ownership) ? record.ownership : {};
  const existing = new Map(
    Array.isArray(canonicalOwnership.records)
      ? canonicalOwnership.records.map((entry) => [entry.asset_id, clone(entry)])
      : [],
  );
  const records = sortByKey(
    assetEntries.map((entry) => ({
      asset_id: entry.asset_id,
      owner: existing.get(entry.asset_id)?.owner ?? "pairslash",
      uninstall_behavior:
        existing.get(entry.asset_id)?.uninstall_behavior ??
        (entry.generated_path === OWNERSHIP_FILE ? "remove_if_unmodified" : "detach_if_modified"),
    })),
    "asset_id",
  );
  return {
    ownership_file:
      pickFirstString(canonicalOwnership.ownership_file, legacyOwnership.ownership_file) ?? OWNERSHIP_FILE,
    ownership_scope:
      pickFirstString(canonicalOwnership.ownership_scope, legacyOwnership.ownership_scope) ?? "pack_root",
    safe_delete_policy:
      pickFirstString(canonicalOwnership.safe_delete_policy, legacyOwnership.safe_delete_policy) ??
      "pairslash-owned-only",
    records,
  };
}

function buildSmokeChecks(record, supportedRuntimes, installTargets) {
  if (Array.isArray(record.smoke_checks) && record.smoke_checks.length > 0) {
    return sortByKey(record.smoke_checks.map((entry) => clone(entry)), "id");
  }
  const checks = [];
  for (const runtime of supportedRuntimes) {
    const preferredTarget =
      runtime === "codex_cli"
        ? installTargets.includes("repo")
          ? "repo"
          : installTargets[0]
        : installTargets.includes("user")
          ? "user"
          : installTargets[0];
    if (!preferredTarget) {
      continue;
    }
    const prefix = runtime === "codex_cli" ? "codex" : "copilot";
    checks.push(
      {
        id: `${prefix}-${preferredTarget}-preview-install`,
        runtime,
        target: preferredTarget,
        action: "preview_install",
      },
      {
        id: `${prefix}-${preferredTarget}-doctor`,
        runtime,
        target: preferredTarget,
        action: "doctor",
      },
    );
  }
  return sortByKey(checks, "id");
}

function attachManifestMeta(manifest, meta) {
  Object.defineProperty(manifest, "__pairslash", {
    value: meta,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return manifest;
}

export function detectPackManifestShape(record) {
  if (isObject(record) && (record.pack_name || record.runtime_assets || record.asset_ownership)) {
    return "canonical-v2.1.0";
  }
  if (isObject(record) && (record.pack || record.assets || record.ownership || record.runtime_targets)) {
    return "legacy-v2.0.0";
  }
  if (record?.schema_version === PHASE4_SCHEMA_VERSION) {
    return "canonical-v2.1.0";
  }
  if (record?.schema_version === LEGACY_PHASE4_SCHEMA_VERSION) {
    return "legacy-v2.0.0";
  }
  return "unknown";
}

function resolveCanonicalPreference(record, preferCanonicalOverride) {
  if (typeof preferCanonicalOverride === "boolean") {
    return preferCanonicalOverride;
  }
  return detectPackManifestShape(record) === "canonical-v2.1.0";
}

function toCanonicalManifest(record, { preferCanonicalOverride } = {}) {
  const preferCanonical = resolveCanonicalPreference(record, preferCanonicalOverride);
  const packName = pickFirstString(record.pack?.id, record.pack_name) ?? "unknown-pack";
  const displayName = pickFirstString(record.pack?.display_name, record.display_name) ?? packName;
  const summary = pickFirstString(record.pack?.summary, record.summary) ?? `${packName} workflow pack`;
  const category = pickFirstString(record.pack?.category, record.category) ?? "planning";
  const workflowClass =
    pickFirstString(record.pack?.workflow_class, record.workflow_class) ?? "read-oriented";
  const phase = pickFirstInteger(record.pack?.phase, record.phase) ?? 0;
  const status = pickFirstString(record.pack?.status, record.status) ?? "active";
  const canonicalEntrypoint =
    pickFirstString(record.pack?.canonical_entrypoint, record.canonical_entrypoint) ?? "/skills";
  const packVersion = pickFirstString(record.pack_version, record.version) ?? "0.0.0";
  const releaseChannel = pickFirstString(record.release_channel) ?? "stable";
  const sourceRoot =
    pickFirstString(
      ...(preferCanonical
        ? [record.runtime_assets?.source_root, record.assets?.pack_dir]
        : [record.assets?.pack_dir, record.runtime_assets?.source_root]),
    ) ?? `packs/core/${packName}`;
  const primarySkill =
    pickFirstString(
      ...(preferCanonical
        ? [record.runtime_assets?.primary_skill, record.assets?.primary_skill_file]
        : [record.assets?.primary_skill_file, record.runtime_assets?.primary_skill]),
    ) ?? "SKILL.md";
  const supportedRuntimes = deriveSupportedRuntimes(record);
  const supportedRuntimeRanges = deriveSupportedRuntimeRanges(record);
  const runtimeBindings = normalizeRuntimeBindings(record, packName, { preferCanonical });
  const installTargets = sortStrings(
    Array.isArray(record.install_targets) ? record.install_targets : SUPPORTED_TARGETS,
  );
  const requiredTools = Array.isArray(record.required_tools) ? clone(record.required_tools) : [];
  const requiredMcpServers = Array.isArray(record.required_mcp_servers)
    ? clone(record.required_mcp_servers)
    : [];
  const memoryPermissions = clone(
    isObject(record.memory_permissions)
      ? record.memory_permissions
      : {
          authority_mode: "read-only",
          explicit_write_only: true,
          global_project_memory: "read",
          task_memory: "read",
          session_artifacts: "implicit-read",
          audit_log: "none",
        },
  );
  const docsRefs = deriveDocsRefs(record);
  const sourceEntries = buildSourceEntries(record, primarySkill, { preferCanonical });
  const runtimeAssets = {
    source_root: sourceRoot,
    primary_skill: primarySkill,
    entries: sortByKey([...sourceEntries, ...buildGeneratedEntries(record)], "asset_id"),
  };
  const localOverridePolicy = {
    marker_file:
      pickFirstString(record.local_override_policy?.marker_file) ?? OVERRIDE_MARKER_FILE,
    marker_mode:
      pickFirstString(record.local_override_policy?.marker_mode) ?? "state_or_explicit_marker",
    eligible_asset_ids: buildEligibleAssetIds(record, sourceEntries, { preferCanonical }),
  };
  const updateStrategy = {
    mode:
      pickFirstString(record.update_strategy?.mode, record.local_override_policy?.strategy) ??
      "preserve_valid_local_overrides",
    on_non_override_change:
      pickFirstString(record.update_strategy?.on_non_override_change) ?? "block",
    rollback_strategy:
      pickFirstString(
        record.update_strategy?.rollback_strategy,
        record.local_override_policy?.rollback_strategy,
      ) ?? "restore_last_managed_state",
  };
  const uninstallStrategy = {
    mode: pickFirstString(record.uninstall_strategy?.mode) ?? "pairslash_owned_only",
    detach_modified_files:
      typeof record.uninstall_strategy?.detach_modified_files === "boolean"
        ? record.uninstall_strategy.detach_modified_files
        : true,
    preserve_unknown_files:
      typeof record.uninstall_strategy?.preserve_unknown_files === "boolean"
        ? record.uninstall_strategy.preserve_unknown_files
        : true,
    remove_empty_pack_dir:
      typeof record.uninstall_strategy?.remove_empty_pack_dir === "boolean"
        ? record.uninstall_strategy.remove_empty_pack_dir
        : true,
  };
  const catalog = deriveCatalog(record, packName, releaseChannel, status);
  const support = deriveSupport(record, packName, runtimeBindings, memoryPermissions);
  const canonical = {
    kind: "pack-manifest-v2",
    schema_version: PHASE4_SCHEMA_VERSION,
    pack_name: packName,
    display_name: displayName,
    pack_version: packVersion,
    summary,
    category,
    workflow_class: WORKFLOW_CLASSES.includes(workflowClass) ? workflowClass : "read-oriented",
    phase,
    status: PACK_STATUSES.includes(status) ? status : "active",
    canonical_entrypoint: canonicalEntrypoint,
    release_channel: RELEASE_CHANNELS.includes(releaseChannel) ? releaseChannel : "stable",
    supported_runtimes: supportedRuntimes,
    supported_runtime_ranges: supportedRuntimeRanges,
    runtime_bindings: runtimeBindings,
    install_targets: installTargets.length > 0 ? installTargets : SUPPORTED_TARGETS.slice(),
    capabilities: sortStrings(Array.isArray(record.capabilities) ? record.capabilities : ["repo_read", "memory_read"]),
    risk_level: RISK_LEVELS.includes(record.risk_level) ? record.risk_level : "low",
    required_tools: requiredTools,
    required_mcp_servers: requiredMcpServers,
    memory_permissions: memoryPermissions,
    runtime_assets: runtimeAssets,
    asset_ownership: buildAssetOwnership(record, runtimeAssets.entries),
    local_override_policy: localOverridePolicy,
    update_strategy: updateStrategy,
    uninstall_strategy: uninstallStrategy,
    smoke_checks: buildSmokeChecks(record, supportedRuntimes, installTargets),
    docs_refs: docsRefs,
    catalog,
    support,
    trust_descriptor: pickFirstString(record.trust_descriptor) ?? undefined,
  };
  return canonical;
}

function legacyAssets(manifest) {
  const sourceEntries = manifest.runtime_assets.entries.filter((entry) => entry.source_path);
  return {
    pack_dir: manifest.runtime_assets.source_root,
    primary_skill_file: manifest.runtime_assets.primary_skill,
    include: sourcePathsFromEntries(sourceEntries),
    docs: {
      contract_file: manifest.docs_refs.contract,
      example_invocation_file: manifest.docs_refs.example_invocation,
      example_output_file: manifest.docs_refs.example_output,
      validation_checklist_file: manifest.docs_refs.validation_checklist,
    },
  };
}

function legacyOwnership(manifest) {
  return {
    ownership_file: manifest.asset_ownership.ownership_file,
    ownership_scope: manifest.asset_ownership.ownership_scope,
    safe_delete_policy: manifest.asset_ownership.safe_delete_policy,
    record_generated_files: true,
    generated_files: [manifest.asset_ownership.ownership_file],
  };
}

function legacyLocalOverridePolicy(manifest) {
  const eligiblePaths = manifest.runtime_assets.entries
    .filter(
      (entry) =>
        entry.source_path &&
        manifest.local_override_policy.eligible_asset_ids.includes(entry.asset_id),
    )
    .map((entry) => entry.source_path);
  return {
    ...clone(manifest.local_override_policy),
    strategy: manifest.update_strategy.mode,
    eligible_paths: sortStrings(eligiblePaths),
    rollback_strategy: manifest.update_strategy.rollback_strategy,
  };
}

function legacyRuntimeTargets(manifest) {
  return Object.fromEntries(
    SUPPORTED_RUNTIMES.map((runtime) => [
      runtime,
      {
        direct_invocation: manifest.runtime_bindings[runtime].direct_invocation,
        metadata_mode: manifest.runtime_bindings[runtime].metadata_mode,
        skill_directory_name: manifest.runtime_bindings[runtime].install_dir_name,
        compatibility: clone(manifest.runtime_bindings[runtime].compatibility),
      },
    ]),
  );
}

function attachCompatibilityAliases(canonical, shape) {
  const manifest = clone(canonical);
  manifest.version = manifest.pack_version;
  manifest.pack = {
    id: manifest.pack_name,
    display_name: manifest.display_name,
    summary: manifest.summary,
    category: manifest.category,
    workflow_class: manifest.workflow_class,
    phase: manifest.phase,
    status: manifest.status,
    canonical_entrypoint: manifest.canonical_entrypoint,
  };
  manifest.assets = legacyAssets(manifest);
  manifest.ownership = legacyOwnership(manifest);
  manifest.runtime_targets = legacyRuntimeTargets(manifest);
  manifest.local_override_policy = legacyLocalOverridePolicy(manifest);
  return attachManifestMeta(manifest, {
    manifest_shape: shape,
    canonical_schema_version: PHASE4_SCHEMA_VERSION,
    normalization_warnings:
      shape === "legacy-v2.0.0"
        ? [`legacy manifest ${LEGACY_PHASE4_SCHEMA_VERSION} normalized to canonical ${PHASE4_SCHEMA_VERSION}`]
        : [],
  });
}

export function normalizePackManifestV2(
  record,
  { attachAliases = false, preferCanonicalOverride } = {},
) {
  const shape = detectPackManifestShape(record);
  if (shape === "unknown") {
    return null;
  }
  const canonical = toCanonicalManifest(record, { preferCanonicalOverride });
  return attachAliases ? attachCompatibilityAliases(canonical, shape) : canonical;
}

export function serializePackManifestV2(record) {
  const hasCompatibilityAliases =
    Boolean(record?.pack) || Boolean(record?.assets) || Boolean(record?.runtime_targets) || Boolean(record?.ownership);
  const preferCanonicalOverride = hasCompatibilityAliases ? false : undefined;
  return toSerializablePackManifestV2(record, { preferCanonicalOverride });
}

export function toSerializablePackManifestV2(record, { preferCanonicalOverride } = {}) {
  const canonical = normalizePackManifestV2(record, {
    attachAliases: false,
    preferCanonicalOverride,
  });
  if (!canonical) {
    throw new Error("unsupported manifest shape");
  }
  return canonical;
}
