import {
  COMPATIBILITY_STATUSES,
  isOneOf,
  MANIFEST_MARKER_MODES,
  MANIFEST_SMOKE_ACTIONS,
  OVERRIDE_MARKER_FILE,
  OWNERSHIP_FILE,
  PACK_CATALOG_CLASSES,
  PACK_DEPRECATION_STATUSES,
  PACK_DOCS_VISIBILITY,
  PACK_PUBLISHER_CLASSES,
  PACK_RELEASE_VISIBILITY,
  PACK_RUNTIME_EVIDENCE_KINDS,
  PACK_RUNTIME_SUPPORT_STATUSES,
  PACK_SUPPORT_LEVELS,
  PACK_TRUST_TIERS,
  RELEASE_CHANNELS,
  RUNTIME_ASSET_GENERATORS,
  RUNTIME_METADATA_MODES,
  RUNTIME_SELECTORS,
  SUPPORTED_RUNTIMES,
  SUPPORTED_TARGETS,
  UNINSTALL_BEHAVIORS,
  UNINSTALL_STRATEGY_MODES,
  UPDATE_NON_OVERRIDE_POLICIES,
  UPDATE_STRATEGY_MODES,
  WORKFLOW_DEMOTION_TRIGGER_CODES,
  WORKFLOW_MATURITY_LEVELS,
} from "../constants.ts";
import {
  toSerializablePackManifestV2,
} from "../manifest-v2.normalize.ts";
import {
  SHARED_RUNTIME_SURFACE_MATRIX,
  isAuthoritativeLiveRuntimeRecordRef,
  isLegalWorkflowTransition,
  isLikelyRemoteRef,
  isSharedRuntimeMatrixRef,
  push,
  validateEvidenceRefPolicy,
  validateNonEmptyString,
  validateObject,
  validateStringArray,
  workflowMaturityRank,
} from "./primitives.ts";

export function validateCanonicalRuntimeBindings(canonical: any, errors: string[]) {
  if (!validateObject(canonical.runtime_bindings, "runtime_bindings", errors, "PSM011")) {
    return;
  }
  const keys = Object.keys(canonical.runtime_bindings).sort();
  const expected = SUPPORTED_RUNTIMES.slice().sort();
  if (keys.length !== expected.length || keys.some((key: string, index: number) => key !== expected[index])) {
    push(errors, "PSM011", `runtime_bindings must contain exactly ${expected.join(", ")}`);
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    const binding = canonical.runtime_bindings[runtime];
    if (!validateObject(binding, `runtime_bindings.${runtime}`, errors, "PSM011")) {
      continue;
    }
    const expectedInvocation = runtime === "codex_cli" ? `$${canonical.pack_name}` : `/${canonical.pack_name}`;
    if (binding.direct_invocation !== expectedInvocation) {
      push(
        errors,
        runtime === "codex_cli" ? "PSM013" : "PSM014",
        `runtime_bindings.${runtime}.direct_invocation must be ${expectedInvocation}`,
      );
    }
    if (!RUNTIME_METADATA_MODES.includes(binding.metadata_mode)) {
      push(
        errors,
        "PSM061",
        `runtime_bindings.${runtime}.metadata_mode must be one of ${RUNTIME_METADATA_MODES.join(", ")}`,
      );
    }
    if (runtime === "codex_cli" && binding.metadata_mode !== "openai_yaml_optional") {
      push(errors, "PSM061", "runtime_bindings.codex_cli.metadata_mode must be openai_yaml_optional");
    }
    if (runtime === "copilot_cli" && binding.metadata_mode !== "none") {
      push(errors, "PSM061", "runtime_bindings.copilot_cli.metadata_mode must be none");
    }
    if (binding.install_dir_name !== canonical.pack_name) {
      push(errors, "PSM061", `runtime_bindings.${runtime}.install_dir_name must equal ${canonical.pack_name}`);
    }
    if (!validateObject(binding.compatibility, `runtime_bindings.${runtime}.compatibility`, errors, "PSM061")) {
      continue;
    }
    for (const field of ["canonical_picker", "direct_invocation"]) {
      if (!COMPATIBILITY_STATUSES.includes(binding.compatibility[field])) {
        push(
          errors,
          "PSM061",
          `runtime_bindings.${runtime}.compatibility.${field} must be one of ${COMPATIBILITY_STATUSES.join(", ")}`,
        );
      }
    }
  }
}

export function validateCanonicalRuntimeAssets(canonical: any, errors: string[], { strict = false }: { strict?: boolean } = {}) {
  if (!validateObject(canonical.runtime_assets, "runtime_assets", errors, "PSM020")) {
    return new Map();
  }
  validateNonEmptyString(canonical.runtime_assets.source_root, "runtime_assets.source_root", errors, "PSM004");
  if (canonical.runtime_assets.source_root !== `packs/core/${canonical.pack_name}`) {
    push(errors, "PSM004", `runtime_assets.source_root must equal packs/core/${canonical.pack_name}`);
  }
  validateNonEmptyString(canonical.runtime_assets.primary_skill, "runtime_assets.primary_skill", errors, "PSM020");
  if (!Array.isArray(canonical.runtime_assets.entries) || canonical.runtime_assets.entries.length === 0) {
    push(errors, "PSM021", "runtime_assets.entries must be a non-empty list");
    return new Map();
  }

  const assetIds = new Map();
  const sourcePaths = new Set();
  const generatedPaths = new Set();
  let primarySkillCount = 0;

  for (const entry of canonical.runtime_assets.entries) {
    if (!validateObject(entry, "runtime_assets.entries[]", errors, "PSM021")) {
      continue;
    }
    if (!validateNonEmptyString(entry.asset_id, "runtime_assets.entries[].asset_id", errors, "PSM021")) {
      continue;
    }
    if (assetIds.has(entry.asset_id)) {
      push(errors, "PSM021", `runtime_assets.entries contains duplicate asset_id ${entry.asset_id}`);
      continue;
    }
    assetIds.set(entry.asset_id, entry);
    if (!RUNTIME_SELECTORS.includes(entry.runtime)) {
      push(errors, "PSM021", `runtime_assets.entries.${entry.asset_id}.runtime is unsupported`);
    }
    if (!validateNonEmptyString(entry.asset_kind, `runtime_assets.entries.${entry.asset_id}.asset_kind`, errors, "PSM021")) {
      continue;
    }
    if (!validateNonEmptyString(entry.install_surface, `runtime_assets.entries.${entry.asset_id}.install_surface`, errors, "PSM021")) {
      continue;
    }
    if (!RUNTIME_ASSET_GENERATORS.includes(entry.generator)) {
      push(
        errors,
        "PSM021",
        `runtime_assets.entries.${entry.asset_id}.generator must be one of ${RUNTIME_ASSET_GENERATORS.join(", ")}`,
      );
    }
    if (typeof entry.required !== "boolean") {
      push(errors, "PSM021", `runtime_assets.entries.${entry.asset_id}.required must be boolean`);
    }
    if (typeof entry.override_eligible !== "boolean") {
      push(errors, "PSM021", `runtime_assets.entries.${entry.asset_id}.override_eligible must be boolean`);
    }
    const hasSourcePath = typeof entry.source_path === "string" && entry.source_path.trim() !== "";
    const hasGeneratedPath = typeof entry.generated_path === "string" && entry.generated_path.trim() !== "";
    if (hasSourcePath === hasGeneratedPath) {
      push(
        errors,
        "PSM021",
        `runtime_assets.entries.${entry.asset_id} must declare exactly one of source_path or generated_path`,
      );
      continue;
    }
    if (entry.generator === "source_copy") {
      if (entry.runtime !== "shared") {
        push(errors, "PSM021", `source asset ${entry.asset_id} must use runtime shared`);
      }
      if (entry.generated_path !== null) {
        push(errors, "PSM021", `source asset ${entry.asset_id} must not declare generated_path`);
      }
      if (sourcePaths.has(entry.source_path)) {
        push(errors, "PSM021", `runtime_assets.entries contains duplicate source_path ${entry.source_path}`);
      }
      sourcePaths.add(entry.source_path);
      if (entry.source_path === canonical.runtime_assets.primary_skill) {
        primarySkillCount += 1;
        if (entry.asset_kind !== "skill_markdown") {
          push(errors, "PSM020", "runtime_assets.primary_skill must map to a skill_markdown asset");
        }
        if (entry.install_surface !== "canonical_skill") {
          push(errors, "PSM020", "runtime_assets.primary_skill must map to canonical_skill install surface");
        }
      }
      continue;
    }
    if (entry.source_path !== null) {
      push(errors, "PSM021", `generated asset ${entry.asset_id} must not declare source_path`);
    }
    if (generatedPaths.has(entry.generated_path)) {
      push(errors, "PSM021", `runtime_assets.entries contains duplicate generated_path ${entry.generated_path}`);
    }
    generatedPaths.add(entry.generated_path);
  }

  if (primarySkillCount !== 1) {
    push(errors, "PSM020", "runtime_assets.primary_skill must appear exactly once in runtime_assets.entries");
  }

  if (strict) {
    const derived = toSerializablePackManifestV2(canonical);
    const expectedGenerated = new Map<string, any>(
      derived.runtime_assets.entries
        .filter((entry: any) => entry.generated_path)
        .map((entry: any) => [entry.asset_id, entry]),
    );
    const actualGenerated = new Map<string, any>(
      canonical.runtime_assets.entries
        .filter((entry: any) => entry.generated_path)
        .map((entry: any) => [entry.asset_id, entry]),
    );
    for (const [assetId, expected] of expectedGenerated) {
      const actual = actualGenerated.get(assetId);
      if (!actual) {
        push(errors, "PSM021", `runtime_assets.entries is missing required generated asset ${assetId}`);
        continue;
      }
      for (const field of ["runtime", "asset_kind", "install_surface", "generated_path", "generator"]) {
        if (actual[field] !== expected[field]) {
          push(errors, "PSM021", `runtime_assets.entries.${assetId}.${field} must equal ${expected[field]}`);
        }
      }
    }
  }

  return assetIds;
}

export function validateCanonicalAssetOwnership(canonical: any, assetIds: any, errors: string[]) {
  if (!validateObject(canonical.asset_ownership, "asset_ownership", errors, "PSM050")) {
    return;
  }
  if (canonical.asset_ownership.ownership_file !== OWNERSHIP_FILE) {
    push(errors, "PSM050", `asset_ownership.ownership_file must be ${OWNERSHIP_FILE}`);
  }
  if (canonical.asset_ownership.ownership_scope !== "pack_root") {
    push(errors, "PSM050", "asset_ownership.ownership_scope must be pack_root");
  }
  if (canonical.asset_ownership.safe_delete_policy !== "pairslash-owned-only") {
    push(errors, "PSM050", "asset_ownership.safe_delete_policy must be pairslash-owned-only");
  }
  if (!Array.isArray(canonical.asset_ownership.records) || canonical.asset_ownership.records.length === 0) {
    push(errors, "PSM050", "asset_ownership.records must be a non-empty list");
    return;
  }
  const seen = new Set();
  for (const record of canonical.asset_ownership.records) {
    if (!validateObject(record, "asset_ownership.records[]", errors, "PSM050")) {
      continue;
    }
    if (!validateNonEmptyString(record.asset_id, "asset_ownership.records[].asset_id", errors, "PSM050")) {
      continue;
    }
    if (seen.has(record.asset_id)) {
      push(errors, "PSM050", `asset_ownership.records contains duplicate asset_id ${record.asset_id}`);
      continue;
    }
    seen.add(record.asset_id);
    if (!assetIds.has(record.asset_id)) {
      push(errors, "PSM050", `asset_ownership.records references unknown asset_id ${record.asset_id}`);
    }
    if (!["pairslash", "user", "system"].includes(record.owner)) {
      push(errors, "PSM050", `asset_ownership.records.${record.asset_id}.owner is invalid`);
    }
    if (!UNINSTALL_BEHAVIORS.includes(record.uninstall_behavior)) {
      push(
        errors,
        "PSM050",
        `asset_ownership.records.${record.asset_id}.uninstall_behavior must be one of ${UNINSTALL_BEHAVIORS.join(", ")}`,
      );
    }
  }
  for (const assetId of assetIds.keys()) {
    if (!seen.has(assetId)) {
      push(errors, "PSM050", `asset_ownership.records is missing asset_id ${assetId}`);
    }
  }
  const receiptRecord = canonical.asset_ownership.records.find((record: any) => record.asset_id === "ownership-receipt");
  if (!receiptRecord) {
    push(errors, "PSM050", "asset_ownership.records must include ownership-receipt");
  } else {
    if (receiptRecord.owner !== "pairslash") {
      push(errors, "PSM050", "ownership-receipt must be owned by pairslash");
    }
    if (receiptRecord.uninstall_behavior !== "remove_if_unmodified") {
      push(errors, "PSM050", "ownership-receipt must use uninstall_behavior remove_if_unmodified");
    }
  }
}

export function validateCanonicalOverridePolicy(canonical: any, assetIds: any, errors: string[]) {
  if (!validateObject(canonical.local_override_policy, "local_override_policy", errors, "PSM051")) {
    return;
  }
  if (canonical.local_override_policy.marker_file !== OVERRIDE_MARKER_FILE) {
    push(errors, "PSM051", `local_override_policy.marker_file must be ${OVERRIDE_MARKER_FILE}`);
  }
  if (!MANIFEST_MARKER_MODES.includes(canonical.local_override_policy.marker_mode)) {
    push(
      errors,
      "PSM051",
      `local_override_policy.marker_mode must be one of ${MANIFEST_MARKER_MODES.join(", ")}`,
    );
  }
  const ids = validateStringArray(
    canonical.local_override_policy.eligible_asset_ids,
    "local_override_policy.eligible_asset_ids",
    errors,
    "PSM051",
    { allowEmpty: true },
  );
  for (const assetId of ids) {
    if (!assetIds.has(assetId)) {
      push(errors, "PSM052", `${assetId} is not present in runtime_assets.entries`);
    }
    if (assetId === "ownership-receipt") {
      push(errors, "PSM053", "ownership-receipt cannot be override eligible");
    }
  }
}

export function validateCanonicalUpdateAndUninstall(canonical: any, errors: string[]) {
  if (!validateObject(canonical.update_strategy, "update_strategy", errors, "PSM051")) {
    return;
  }
  if (!UPDATE_STRATEGY_MODES.includes(canonical.update_strategy.mode)) {
    push(errors, "PSM051", `update_strategy.mode must be one of ${UPDATE_STRATEGY_MODES.join(", ")}`);
  }
  if (!UPDATE_NON_OVERRIDE_POLICIES.includes(canonical.update_strategy.on_non_override_change)) {
    push(
      errors,
      "PSM051",
      `update_strategy.on_non_override_change must be one of ${UPDATE_NON_OVERRIDE_POLICIES.join(", ")}`,
    );
  }
  validateNonEmptyString(canonical.update_strategy.rollback_strategy, "update_strategy.rollback_strategy", errors, "PSM051");

  if (!validateObject(canonical.uninstall_strategy, "uninstall_strategy", errors, "PSM050")) {
    return;
  }
  if (!UNINSTALL_STRATEGY_MODES.includes(canonical.uninstall_strategy.mode)) {
    push(
      errors,
      "PSM050",
      `uninstall_strategy.mode must be one of ${UNINSTALL_STRATEGY_MODES.join(", ")}`,
    );
  }
  for (const field of ["detach_modified_files", "preserve_unknown_files", "remove_empty_pack_dir"]) {
    if (typeof canonical.uninstall_strategy[field] !== "boolean") {
      push(errors, "PSM050", `uninstall_strategy.${field} must be boolean`);
    }
  }
}

export function validateCanonicalSmokeChecks(canonical: any, errors: string[]) {
  if (!Array.isArray(canonical.smoke_checks) || canonical.smoke_checks.length === 0) {
    push(errors, "PSM062", "smoke_checks must be a non-empty list");
    return;
  }
  const seen = new Set();
  for (const check of canonical.smoke_checks) {
    if (!validateObject(check, "smoke_checks[]", errors, "PSM062")) {
      continue;
    }
    if (!validateNonEmptyString(check.id, "smoke_checks[].id", errors, "PSM062")) {
      continue;
    }
    if (seen.has(check.id)) {
      push(errors, "PSM062", `smoke_checks contains duplicate id ${check.id}`);
    }
    seen.add(check.id);
    if (!SUPPORTED_RUNTIMES.includes(check.runtime)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.runtime must be one of ${SUPPORTED_RUNTIMES.join(", ")}`);
    }
    if (!SUPPORTED_TARGETS.includes(check.target)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.target must be one of ${SUPPORTED_TARGETS.join(", ")}`);
    }
    if (!MANIFEST_SMOKE_ACTIONS.includes(check.action)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.action must be one of ${MANIFEST_SMOKE_ACTIONS.join(", ")}`);
    }
    if (!canonical.supported_runtimes.includes(check.runtime)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.runtime must exist in supported_runtimes`);
    }
    if (!canonical.install_targets.includes(check.target)) {
      push(errors, "PSM062", `smoke_checks.${check.id}.target must exist in install_targets`);
    }
  }
}

export function validateCanonicalTrustDescriptor(canonical: any, errors: string[]) {
  if (!("trust_descriptor" in canonical) || canonical.trust_descriptor === undefined) {
    return;
  }
  validateNonEmptyString(canonical.trust_descriptor, "trust_descriptor", errors, "PSM063");
}

export function deriveCanonicalRuntimeSupportStatus(canonical: any, runtime: string) {
  const compatibility = canonical?.runtime_bindings?.[runtime]?.compatibility ?? {};
  const canonicalStatus = compatibility.canonical_picker ?? "unverified";
  const directStatus = compatibility.direct_invocation ?? "unverified";
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

export function validateCanonicalCatalog(canonical: any, errors: string[]) {
  if (!validateObject(canonical.catalog, "catalog", errors, "PSM064")) {
    return;
  }
  if (!PACK_CATALOG_CLASSES.includes(canonical.catalog?.pack_class)) {
    push(errors, "PSM064", `catalog.pack_class must be one of ${PACK_CATALOG_CLASSES.join(", ")}`);
  }
  if (!RELEASE_CHANNELS.includes(canonical.catalog?.maturity)) {
    push(errors, "PSM064", `catalog.maturity must be one of ${RELEASE_CHANNELS.join(", ")}`);
  }
  if (canonical.catalog?.maturity !== canonical.release_channel) {
    push(errors, "PSM064", "catalog.maturity must match release_channel");
  }
  if (!PACK_DOCS_VISIBILITY.includes(canonical.catalog?.docs_visibility)) {
    push(errors, "PSM064", `catalog.docs_visibility must be one of ${PACK_DOCS_VISIBILITY.join(", ")}`);
  }
  for (const field of ["default_discovery", "default_recommendation"]) {
    if (typeof canonical.catalog?.[field] !== "boolean") {
      push(errors, "PSM064", `catalog.${field} must be boolean`);
    }
  }
  if (
    canonical.catalog?.default_recommendation === true &&
    canonical.catalog?.default_discovery !== true
  ) {
    push(errors, "PSM064", "catalog.default_recommendation requires catalog.default_discovery");
  }
  if (
    canonical.catalog?.default_recommendation === true &&
    ["deprecated", "archived"].includes(canonical.catalog?.deprecation_status)
  ) {
    push(errors, "PSM064", "catalog.default_recommendation cannot be true for deprecated or archived workflows");
  }
  if (!PACK_RELEASE_VISIBILITY.includes(canonical.catalog?.release_visibility)) {
    push(errors, "PSM064", `catalog.release_visibility must be one of ${PACK_RELEASE_VISIBILITY.join(", ")}`);
  }
  if (!PACK_DEPRECATION_STATUSES.includes(canonical.catalog?.deprecation_status)) {
    push(
      errors,
      "PSM064",
      `catalog.deprecation_status must be one of ${PACK_DEPRECATION_STATUSES.join(", ")}`,
    );
  }
  if (
    canonical.catalog?.deprecation_status === "archived" &&
    canonical.status !== "deprecated"
  ) {
    push(errors, "PSM064", "catalog.deprecation_status archived requires manifest status deprecated");
  }
}

export function validateCanonicalSupport(canonical: any, errors: string[]) {
  if (!validateObject(canonical.support, "support", errors, "PSM065")) {
    return;
  }
  if (!validateObject(canonical.support?.publisher, "support.publisher", errors, "PSM065")) {
    return;
  }
  validateNonEmptyString(canonical.support.publisher?.publisher_id, "support.publisher.publisher_id", errors, "PSM065");
  validateNonEmptyString(canonical.support.publisher?.display_name, "support.publisher.display_name", errors, "PSM065");
  validateNonEmptyString(canonical.support.publisher?.contact, "support.publisher.contact", errors, "PSM065");
  if (!PACK_PUBLISHER_CLASSES.includes(canonical.support.publisher?.publisher_class)) {
    push(
      errors,
      "PSM065",
      `support.publisher.publisher_class must be one of ${PACK_PUBLISHER_CLASSES.join(", ")}`,
    );
  }
  if (!PACK_TRUST_TIERS.includes(canonical.support?.tier_claim)) {
    push(errors, "PSM065", `support.tier_claim must be one of ${PACK_TRUST_TIERS.join(", ")}`);
  }
  if (!PACK_SUPPORT_LEVELS.includes(canonical.support?.support_level_claim)) {
    push(
      errors,
      "PSM065",
      `support.support_level_claim must be one of ${PACK_SUPPORT_LEVELS.join(", ")}`,
    );
  }
  if (!WORKFLOW_MATURITY_LEVELS.includes(canonical.support?.workflow_maturity)) {
    push(
      errors,
      "PSM065",
      `support.workflow_maturity must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")}`,
    );
  }
  const workflowMaturity = canonical.support?.workflow_maturity;
  if (!validateObject(canonical.support?.signature, "support.signature", errors, "PSM065")) {
    return;
  }
  for (const field of ["required", "allow_local_unsigned"]) {
    if (typeof canonical.support.signature?.[field] !== "boolean") {
      push(errors, "PSM065", `support.signature.${field} must be boolean`);
    }
  }
  if (!validateObject(canonical.support?.runtime_support, "support.runtime_support", errors, "PSM065")) {
    return;
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    const runtimeSupport = canonical.support.runtime_support?.[runtime];
    if (!validateObject(runtimeSupport, `support.runtime_support.${runtime}`, errors, "PSM065")) {
      continue;
    }
    if (!PACK_RUNTIME_SUPPORT_STATUSES.includes(runtimeSupport?.status)) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.status must be one of ${PACK_RUNTIME_SUPPORT_STATUSES.join(", ")}`,
      );
    }
    if (runtimeSupport?.evidence_ref !== null && typeof runtimeSupport?.evidence_ref !== "string") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.evidence_ref must be string or null`);
    }
    if (typeof runtimeSupport?.evidence_ref === "string" && isLikelyRemoteRef(runtimeSupport.evidence_ref)) {
      push(errors, "PSM065", `support.runtime_support.${runtime}.evidence_ref must be repo-local`);
    }
    if (
      ["supported", "partial"].includes(runtimeSupport?.status) &&
      (typeof runtimeSupport?.evidence_ref !== "string" || runtimeSupport.evidence_ref.trim() === "")
    ) {
      push(errors, "PSM065", `support.runtime_support.${runtime}.status ${runtimeSupport.status} requires evidence_ref`);
    }
    if (!PACK_RUNTIME_EVIDENCE_KINDS.includes(runtimeSupport?.evidence_kind)) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.evidence_kind must be one of ${PACK_RUNTIME_EVIDENCE_KINDS.join(", ")}`,
      );
    }
    if (
      runtimeSupport?.evidence_kind === "lane-matrix" &&
      !isSharedRuntimeMatrixRef(runtimeSupport?.evidence_ref)
    ) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.evidence_ref must point to ${SHARED_RUNTIME_SURFACE_MATRIX} for lane-matrix`,
      );
    }
    if (
      runtimeSupport?.evidence_kind === "pack-runtime-live" &&
      !isAuthoritativeLiveRuntimeRecordRef(runtimeSupport?.evidence_ref)
    ) {
      push(
        errors,
        "PSM065",
        `support.runtime_support.${runtime}.evidence_ref must point to docs/evidence/live-runtime/*.yaml for pack-runtime-live`,
      );
    }
    if (typeof runtimeSupport?.required_for_promotion !== "boolean") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.required_for_promotion must be boolean`);
    }
    const manifestStatus = deriveCanonicalRuntimeSupportStatus(canonical, runtime);
    if (manifestStatus === "blocked" && runtimeSupport?.status !== "blocked") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.status cannot exceed blocked manifest runtime surface`);
    }
    if (manifestStatus === "unverified" && runtimeSupport?.status === "supported") {
      push(errors, "PSM065", `support.runtime_support.${runtime}.status cannot exceed unverified manifest compatibility`);
    }
  }

  if (!validateObject(canonical.support?.workflow_transition, "support.workflow_transition", errors, "PSM065")) {
    return;
  }
  const transitionFrom = canonical.support.workflow_transition?.from;
  if (
    transitionFrom !== null &&
    !WORKFLOW_MATURITY_LEVELS.includes(transitionFrom)
  ) {
    push(
      errors,
      "PSM065",
      `support.workflow_transition.from must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")} or null`,
    );
  }
  validateNonEmptyString(canonical.support.workflow_transition?.reason, "support.workflow_transition.reason", errors, "PSM065");
  if (WORKFLOW_MATURITY_LEVELS.includes(workflowMaturity)) {
    const transitionSource = transitionFrom ?? workflowMaturity;
    if (!isLegalWorkflowTransition(transitionSource, workflowMaturity)) {
      push(errors, "PSM065", `support.workflow_transition.from ${transitionSource} -> ${workflowMaturity} is not allowed`);
    }
  }

  if (!validateObject(canonical.support?.workflow_evidence, "support.workflow_evidence", errors, "PSM065")) {
    return;
  }
  const deterministicRefs = validateStringArray(
    canonical.support.workflow_evidence?.deterministic_refs,
    "support.workflow_evidence.deterministic_refs",
    errors,
    "PSM065",
  );
  if (!validateObject(canonical.support.workflow_evidence?.live_workflow_refs, "support.workflow_evidence.live_workflow_refs", errors, "PSM065")) {
    return;
  }
  const liveWorkflowRefs = Object.fromEntries(
    SUPPORTED_RUNTIMES.map((runtime: string) => [
      runtime,
      validateStringArray(
        canonical.support.workflow_evidence.live_workflow_refs?.[runtime],
        `support.workflow_evidence.live_workflow_refs.${runtime}`,
        errors,
        "PSM065",
        { allowEmpty: true },
      ),
    ]),
  );
  for (const runtime of SUPPORTED_RUNTIMES) {
    validateEvidenceRefPolicy(
      liveWorkflowRefs[runtime],
      `support.workflow_evidence.live_workflow_refs.${runtime}`,
      errors,
      "PSM065",
      { requireAuthoritativeLiveRuntimeRecord: true },
    );
  }
  const operationalSafetyRefs = validateStringArray(
    canonical.support.workflow_evidence?.operational_safety_refs,
    "support.workflow_evidence.operational_safety_refs",
    errors,
    "PSM065",
    { allowEmpty: true },
  );
  validateEvidenceRefPolicy(
    operationalSafetyRefs,
    "support.workflow_evidence.operational_safety_refs",
    errors,
    "PSM065",
    { requireAuthoritativeLiveRuntimeRecord: true },
  );
  const migrationRefs = validateStringArray(
    canonical.support.workflow_evidence?.migration_refs,
    "support.workflow_evidence.migration_refs",
    errors,
    "PSM065",
    { allowEmpty: true },
  );
  validateEvidenceRefPolicy(
    migrationRefs,
    "support.workflow_evidence.migration_refs",
    errors,
    "PSM065",
  );

  if (workflowMaturity !== "deprecated" && deterministicRefs.length === 0) {
    push(errors, "PSM065", "support.workflow_evidence.deterministic_refs must include at least one reference for non-deprecated workflows");
  }
  if (["preview", "beta", "stable"].includes(workflowMaturity)) {
    for (const runtime of SUPPORTED_RUNTIMES) {
      if (liveWorkflowRefs[runtime].length === 0) {
        push(errors, "PSM065", `support.workflow_evidence.live_workflow_refs.${runtime} requires at least one reference for ${workflowMaturity}`);
      }
    }
  }
  if (["beta", "stable"].includes(workflowMaturity)) {
    for (const runtime of SUPPORTED_RUNTIMES) {
      if (liveWorkflowRefs[runtime].length < 2) {
        push(errors, "PSM065", `support.workflow_evidence.live_workflow_refs.${runtime} requires repeated evidence for ${workflowMaturity}`);
      }
    }
  }

  if (!validateObject(canonical.support?.promotion_checklist, "support.promotion_checklist", errors, "PSM065")) {
    return;
  }
  if (!WORKFLOW_MATURITY_LEVELS.includes(canonical.support.promotion_checklist?.required_for_label)) {
    push(
      errors,
      "PSM065",
      `support.promotion_checklist.required_for_label must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")}`,
    );
  }
  if (
    WORKFLOW_MATURITY_LEVELS.includes(workflowMaturity) &&
    canonical.support.promotion_checklist?.required_for_label !== workflowMaturity
  ) {
    push(errors, "PSM065", "support.promotion_checklist.required_for_label must match support.workflow_maturity");
  }
  if (!validateObject(canonical.support.promotion_checklist?.claimed_lanes, "support.promotion_checklist.claimed_lanes", errors, "PSM065")) {
    return;
  }
  for (const runtime of SUPPORTED_RUNTIMES) {
    validateStringArray(
      canonical.support.promotion_checklist.claimed_lanes?.[runtime],
      `support.promotion_checklist.claimed_lanes.${runtime}`,
      errors,
      "PSM065",
      { allowEmpty: true },
    );
  }
  for (const field of ["canonical_entrypoint_verified", "wording_verified", "docs_synced"]) {
    if (typeof canonical.support.promotion_checklist?.[field] !== "boolean") {
      push(errors, "PSM065", `support.promotion_checklist.${field} must be boolean`);
    }
  }
  if (
    ["preview", "beta", "stable"].includes(workflowMaturity) &&
    canonical.support.promotion_checklist?.canonical_entrypoint_verified !== true
  ) {
    push(errors, "PSM065", "support.promotion_checklist.canonical_entrypoint_verified must be true for preview/beta/stable");
  }
  if (
    ["beta", "stable"].includes(workflowMaturity) &&
    canonical.support.promotion_checklist?.docs_synced !== true
  ) {
    push(errors, "PSM065", "support.promotion_checklist.docs_synced must be true for beta/stable");
  }
  if (
    workflowMaturity === "stable" &&
    canonical.support.promotion_checklist?.wording_verified !== true
  ) {
    push(errors, "PSM065", "support.promotion_checklist.wording_verified must be true for stable");
  }

  if (!validateObject(canonical.support?.demotion_policy, "support.demotion_policy", errors, "PSM065")) {
    return;
  }
  validateNonEmptyString(canonical.support.demotion_policy?.owner, "support.demotion_policy.owner", errors, "PSM065");
  if (!WORKFLOW_MATURITY_LEVELS.includes(canonical.support.demotion_policy?.fallback_maturity)) {
    push(
      errors,
      "PSM065",
      `support.demotion_policy.fallback_maturity must be one of ${WORKFLOW_MATURITY_LEVELS.join(", ")}`,
    );
  }
  const demotionTriggerCodes = validateStringArray(
    canonical.support.demotion_policy?.trigger_codes,
    "support.demotion_policy.trigger_codes",
    errors,
    "PSM065",
  );
  for (const triggerCode of demotionTriggerCodes) {
    if (!isOneOf(triggerCode, WORKFLOW_DEMOTION_TRIGGER_CODES)) {
      push(
        errors,
        "PSM065",
        `support.demotion_policy.trigger_codes contains unsupported code ${triggerCode}`,
      );
    }
  }
  if (
    WORKFLOW_MATURITY_LEVELS.includes(workflowMaturity) &&
    WORKFLOW_MATURITY_LEVELS.includes(canonical.support.demotion_policy?.fallback_maturity) &&
    workflowMaturity !== "deprecated" &&
    workflowMaturityRank(canonical.support.demotion_policy.fallback_maturity) > workflowMaturityRank(workflowMaturity)
  ) {
    push(errors, "PSM065", "support.demotion_policy.fallback_maturity must not be stronger than support.workflow_maturity");
  }

  if (workflowMaturity === "deprecated") {
    if (canonical.status !== "deprecated") {
      push(errors, "PSM065", "support.workflow_maturity deprecated requires manifest status deprecated");
    }
    if (!["deprecated", "archived"].includes(canonical.catalog?.deprecation_status)) {
      push(errors, "PSM065", "support.workflow_maturity deprecated requires catalog.deprecation_status deprecated or archived");
    }
    if (
      (typeof canonical.catalog?.replacement_pack !== "string" || canonical.catalog.replacement_pack.trim() === "") &&
      migrationRefs.length === 0
    ) {
      push(errors, "PSM065", "deprecated workflows require catalog.replacement_pack or support.workflow_evidence.migration_refs");
    }
  }
  if (
    canonical.status === "deprecated" &&
    workflowMaturity !== "deprecated"
  ) {
    push(errors, "PSM065", "manifest status deprecated requires support.workflow_maturity deprecated");
  }
  if (
    ["deprecated", "archived"].includes(canonical.catalog?.deprecation_status) &&
    workflowMaturity !== "deprecated"
  ) {
    push(errors, "PSM065", "catalog.deprecation_status deprecated/archived requires support.workflow_maturity deprecated");
  }
  if (
    workflowMaturity === "deprecated" &&
    canonical.catalog?.default_recommendation === true
  ) {
    push(errors, "PSM065", "deprecated workflows must not set catalog.default_recommendation");
  }

  const isWriteAuthorityWorkflow =
    canonical.workflow_class === "write-authority" ||
    canonical.memory_permissions?.global_project_memory === "write" ||
    (canonical.capabilities ?? []).includes("memory_write_global");
  if (isWriteAuthorityWorkflow && ["preview", "beta", "stable"].includes(workflowMaturity) && operationalSafetyRefs.length === 0) {
    push(errors, "PSM065", "write-authority workflows at preview/beta/stable require support.workflow_evidence.operational_safety_refs");
  }
  if (isWriteAuthorityWorkflow && workflowMaturity === "stable" && operationalSafetyRefs.length < 2) {
    push(errors, "PSM065", "write-authority workflows at stable require repeated operational safety evidence");
  }
  if (isWriteAuthorityWorkflow && workflowMaturity === "stable") {
    for (const runtime of SUPPORTED_RUNTIMES) {
      const runtimeSupport = canonical.support.runtime_support?.[runtime];
      if (runtimeSupport?.required_for_promotion === false) {
        continue;
      }
      if (runtimeSupport?.evidence_kind !== "pack-runtime-live") {
        push(errors, "PSM065", `write-authority stable workflows require support.runtime_support.${runtime}.evidence_kind pack-runtime-live`);
      }
      if (["blocked", "unverified"].includes(runtimeSupport?.status)) {
        push(errors, "PSM065", `write-authority stable workflows require support.runtime_support.${runtime}.status supported or partial`);
      }
    }
  }

  if (!validateObject(canonical.support?.policy_requirements, "support.policy_requirements", errors, "PSM065")) {
    return;
  }
  for (const field of [
    "no_silent_fallback",
    "preview_required_for_mutation",
    "explicit_write_only_memory",
  ]) {
    if (canonical.support.policy_requirements?.[field] !== true) {
      push(errors, "PSM065", `support.policy_requirements.${field} must be true`);
    }
  }
  if (!validateObject(canonical.support?.maintainers, "support.maintainers", errors, "PSM065")) {
    return;
  }
  validateNonEmptyString(canonical.support.maintainers?.owner, "support.maintainers.owner", errors, "PSM065");
  validateNonEmptyString(canonical.support.maintainers?.contact, "support.maintainers.contact", errors, "PSM065");

  if (
    canonical.memory_permissions?.global_project_memory === "write" &&
    canonical.support?.tier_claim !== "core-maintained"
  ) {
    push(errors, "PSM065", "memory-write packs must claim support.tier_claim core-maintained");
  }
  if (
    (canonical.capabilities ?? []).includes("memory_write_global") &&
    canonical.support?.tier_claim !== "core-maintained"
  ) {
    push(errors, "PSM065", "memory_write_global capability requires support.tier_claim core-maintained");
  }
  if (
    canonical.support?.support_level_claim === "core-supported" &&
    canonical.support?.tier_claim !== "core-maintained"
  ) {
    push(errors, "PSM065", "support.support_level_claim core-supported requires support.tier_claim core-maintained");
  }
  if (
    canonical.support?.support_level_claim === "publisher-verified" &&
    canonical.support?.tier_claim !== "verified-external"
  ) {
    push(errors, "PSM065", "support.support_level_claim publisher-verified requires support.tier_claim verified-external");
  }
  if (canonical.support?.publisher?.publisher_id === "pairslash") {
    if (canonical.support?.tier_claim === "verified-external") {
      push(errors, "PSM065", "pairslash publisher must not claim verified-external");
    }
  } else if (["core-maintained", "first-party-official"].includes(canonical.support?.tier_claim)) {
    push(errors, "PSM065", "non-pairslash publishers cannot claim first-party tiers");
  }
}
