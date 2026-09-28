import {
  INSTALL_SURFACES,
  isOneOf,
  LEGACY_PHASE4_SCHEMA_VERSION,
  LOGICAL_ASSET_KINDS,
  NORMALIZED_IR_SCHEMA_VERSION,
  PACK_STATUSES,
  PHASE4_SCHEMA_VERSION,
  RELEASE_CHANNELS,
  RISK_LEVELS,
  RUNTIME_SELECTORS,
  SUPPORTED_RUNTIMES,
  UNINSTALL_BEHAVIORS,
  WORKFLOW_CLASSES,
} from "../../constants.ts";
import {
  detectPackManifestShape,
  toSerializablePackManifestV2,
} from "../../manifest-v2.normalize.ts";
import {
  safeParsePackManifestV2,
} from "../../manifest-v2.schema.ts";
import {
  validateRuntimeRange,
} from "../../runtime-range.ts";
import {
  validateCanonicalAssetOwnership,
  validateCanonicalCatalog,
  validateCanonicalOverridePolicy,
  validateCanonicalRuntimeAssets,
  validateCanonicalRuntimeBindings,
  validateCanonicalSmokeChecks,
  validateCanonicalSupport,
  validateCanonicalTrustDescriptor,
  validateCanonicalUpdateAndUninstall,
} from "../canonical.ts";
import {
  validateCapabilities,
  validateInstallTargets,
  validateMcpServers,
  validateMemoryPermissions,
  validateRuntimeRanges,
  validateTools,
} from "../manifest-fields.ts";
import {
  cloneRecord,
  formatIssuePath,
  push,
  sortStable,
  validateNonEmptyString,
  validateObject,
  validateStringArray,
} from "../primitives.ts";

export function validatePackManifestV2(record: any) {
  const errors: string[] = [];
  const shape = detectPackManifestShape(record);
  const hasCompatibilityAliases =
    shape === "canonical-v2.1.0" &&
    (Boolean(record?.pack) || Boolean(record?.assets) || Boolean(record?.runtime_targets) || Boolean(record?.ownership));

  if (record?.kind !== "pack-manifest-v2") {
    push(errors, "PSM001", "kind must be pack-manifest-v2");
    return errors;
  }
  if (shape === "unknown") {
    push(errors, "PSM002", `schema_version must be ${LEGACY_PHASE4_SCHEMA_VERSION} or ${PHASE4_SCHEMA_VERSION}`);
    return errors;
  }

  const rawRuntimeKeys = sortStable([
    ...Object.keys(record?.supported_runtime_ranges ?? {}),
    ...Object.keys(record?.runtime_bindings ?? {}),
    ...Object.keys(record?.runtime_targets ?? {}),
    ...(Array.isArray(record?.supported_runtimes) ? record.supported_runtimes : []),
  ]);
  for (const runtime of rawRuntimeKeys) {
    if (!isOneOf(runtime, SUPPORTED_RUNTIMES)) {
      push(errors, "PSM010", `supported runtime declarations include unsupported runtime ${runtime}`);
      push(errors, "PSM012", `unsupported runtime ${runtime}`);
    }
  }

  let canonical;
  if (shape === "legacy-v2.0.0" || hasCompatibilityAliases) {
    canonical = toSerializablePackManifestV2(record);
  } else {
    canonical = cloneRecord(record);
  }

  const parseResult = safeParsePackManifestV2(canonical);
  if (!parseResult.success) {
    for (const issue of parseResult.issues ?? []) {
      push(errors, "PSM000", `${formatIssuePath(issue)} :: ${issue.message}`);
    }
    return errors;
  }

  const expectedRuntimeSet = SUPPORTED_RUNTIMES.slice().sort();
  const supportedRuntimes = validateStringArray(canonical.supported_runtimes, "supported_runtimes", errors, "PSM010");
  const sortedRuntimes = supportedRuntimes.slice().sort();
  if (
    sortedRuntimes.length !== expectedRuntimeSet.length ||
    sortedRuntimes.some((runtime: string, index: number) => runtime !== expectedRuntimeSet[index])
  ) {
    push(errors, "PSM010", `supported_runtimes must contain exactly ${expectedRuntimeSet.join(", ")}`);
  }

  validateNonEmptyString(canonical.pack_version, "pack_version", errors, "PSM003");
  validateNonEmptyString(canonical.pack_name, "pack_name", errors, "PSM003");
  if (typeof canonical.pack_name === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonical.pack_name)) {
    push(errors, "PSM003", "pack_name must be lowercase kebab-case");
  }
  validateNonEmptyString(canonical.display_name, "display_name", errors, "PSM003");
  validateNonEmptyString(canonical.summary, "summary", errors, "PSM003");
  validateNonEmptyString(canonical.category, "category", errors, "PSM003");
  if (!WORKFLOW_CLASSES.includes(canonical.workflow_class)) {
    push(errors, "PSM003", `workflow_class must be one of ${WORKFLOW_CLASSES.join(", ")}`);
  }
  if (!Number.isInteger(canonical.phase)) {
    push(errors, "PSM003", "phase must be an integer");
  }
  if (!PACK_STATUSES.includes(canonical.status)) {
    push(errors, "PSM003", `status must be one of ${PACK_STATUSES.join(", ")}`);
  }
  if (canonical.canonical_entrypoint !== "/skills") {
    push(errors, "PSM005", "canonical_entrypoint must be /skills");
  }
  if (!RISK_LEVELS.includes(canonical.risk_level)) {
    push(errors, "PSM031", `risk_level must be one of ${RISK_LEVELS.join(", ")}`);
  }
  if (!RELEASE_CHANNELS.includes(canonical.release_channel)) {
    push(errors, "PSM060", `release_channel must be one of ${RELEASE_CHANNELS.join(", ")}`);
  }

  validateRuntimeRanges(canonical.supported_runtime_ranges, errors);
  for (const runtime of SUPPORTED_RUNTIMES) {
    if (!validateRuntimeRange(canonical.supported_runtime_ranges?.[runtime])) {
      push(
        errors,
        "PSM010",
        `supported_runtime_ranges.${runtime} must use exact x.y.z or >=x.y.z semver format`,
      );
    }
  }
  validateInstallTargets(canonical.install_targets, errors);
  const capabilities = validateCapabilities(canonical.capabilities, canonical.risk_level, errors);
  validateTools(canonical.required_tools, errors);
  validateMcpServers(canonical.required_mcp_servers, capabilities, errors, record.schema_version);
  validateMemoryPermissions(canonical.memory_permissions, capabilities, canonical.risk_level, errors);
  validateCanonicalRuntimeBindings(canonical, errors);
  const assetIds = validateCanonicalRuntimeAssets(canonical, errors, {
    strict: shape === "canonical-v2.1.0" && !hasCompatibilityAliases,
  });
  validateCanonicalAssetOwnership(canonical, assetIds, errors);
  validateCanonicalOverridePolicy(canonical, assetIds, errors);
  validateCanonicalUpdateAndUninstall(canonical, errors);
  validateCanonicalSmokeChecks(canonical, errors);
  validateCanonicalCatalog(canonical, errors);
  validateCanonicalSupport(canonical, errors);
  validateCanonicalTrustDescriptor(canonical, errors);

  return errors;
}

export function validateNormalizedIr(record: any) {
  const errors: string[] = [];
  if (record?.kind !== "normalized-pack-ir") {
    errors.push("kind must be normalized-pack-ir");
  }
  if (record?.schema_version !== NORMALIZED_IR_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${NORMALIZED_IR_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.manifest_digest, "manifest_digest", errors, "NIR001");
  if (!validateObject(record?.pack, "pack", errors, "NIR001")) {
    return errors;
  }
  validateNonEmptyString(record?.pack?.id, "pack.id", errors, "NIR001");
  validateNonEmptyString(record?.pack?.canonical_entrypoint, "pack.canonical_entrypoint", errors, "NIR001");
  if (!validateObject(record?.policy, "policy", errors, "NIR001")) {
    return errors;
  }
  if (!validateObject(record?.runtime_support, "runtime_support", errors, "NIR001")) {
    return errors;
  }
  const runtimeKeys = Object.keys(record.runtime_support).sort();
  const expectedRuntimeKeys = SUPPORTED_RUNTIMES.slice().sort();
  if (
    runtimeKeys.length !== expectedRuntimeKeys.length ||
    runtimeKeys.some((key: string, index: number) => key !== expectedRuntimeKeys[index])
  ) {
    errors.push(`runtime_support must contain exactly ${expectedRuntimeKeys.join(", ")}`);
  }
  if (!Array.isArray(record?.logical_assets) || record.logical_assets.length === 0) {
    errors.push("logical_assets must be a non-empty list");
    return errors;
  }
  for (const asset of record.logical_assets) {
    validateNonEmptyString(asset?.logical_id, "logical_assets[].logical_id", errors, "NIR001");
    validateNonEmptyString(asset?.asset_id, "logical_assets[].asset_id", errors, "NIR001");
    validateNonEmptyString(asset?.generator, "logical_assets[].generator", errors, "NIR001");
    if (!LOGICAL_ASSET_KINDS.includes(asset?.asset_kind)) {
      errors.push(`unsupported logical asset kind: ${asset?.asset_kind}`);
    }
    if (!INSTALL_SURFACES.includes(asset?.install_surface)) {
      errors.push(`unsupported install surface: ${asset?.install_surface}`);
    }
    if (!RUNTIME_SELECTORS.includes(asset?.runtime_selector)) {
      errors.push(`unsupported runtime selector: ${asset?.runtime_selector}`);
    }
    validateNonEmptyString(asset?.stable_sort_key, "logical_assets[].stable_sort_key", errors, "NIR001");
    validateNonEmptyString(asset?.sha256, "logical_assets[].sha256", errors, "NIR001");
    if (asset?.source_relpath !== null && typeof asset?.source_relpath !== "string") {
      errors.push("logical_assets[].source_relpath must be string or null");
    }
    if (asset?.generated_relpath !== null && typeof asset?.generated_relpath !== "string") {
      errors.push("logical_assets[].generated_relpath must be string or null");
    }
    if ("file_name" in (asset ?? {}) && asset?.file_name !== null && typeof asset?.file_name !== "string") {
      errors.push("logical_assets[].file_name must be string when present");
    }
    if (typeof asset?.content_type !== "string" || asset.content_type.trim() === "") {
      errors.push("logical_assets[].content_type must be a non-empty string");
    }
    if (typeof asset?.generated !== "boolean") {
      errors.push("logical_assets[].generated must be boolean");
    }
    if (typeof asset?.required !== "boolean") {
      errors.push("logical_assets[].required must be boolean");
    }
    if (typeof asset?.override_eligible !== "boolean") {
      errors.push("logical_assets[].override_eligible must be boolean");
    }
    if (!["pairslash", "user", "system"].includes(asset?.owner)) {
      errors.push(`unsupported logical_assets[].owner: ${asset?.owner}`);
    }
    if (!UNINSTALL_BEHAVIORS.includes(asset?.uninstall_behavior)) {
      errors.push(`unsupported logical_assets[].uninstall_behavior: ${asset?.uninstall_behavior}`);
    }
    if (typeof asset?.write_authority_guarded !== "boolean") {
      errors.push("logical_assets[].write_authority_guarded must be boolean");
    }
  }
  return errors;
}
