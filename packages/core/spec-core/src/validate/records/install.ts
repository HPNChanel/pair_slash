import {
  BUNDLE_KINDS,
  COMPILED_PACK_SCHEMA_VERSION,
  INSTALL_JOURNAL_SCHEMA_VERSION,
  INSTALL_STATE_SCHEMA_VERSION,
  INSTALL_SURFACES,
  isOneOf,
  LIFECYCLE_REASON_CODES,
  LOGICAL_ASSET_KINDS,
  MANAGEMENT_MODES,
  MEMORY_ACCESS_LEVELS,
  MEMORY_AUTHORITY_MODES,
  PACK_PUBLISHER_CLASSES,
  PACK_RUNTIME_SUPPORT_STATUSES,
  PACK_SIGNATURE_STATUSES,
  PACK_SUPPORT_LEVELS,
  PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION,
  PACK_TRUST_TIERS,
  POLICY_DECISIONS,
  PREVIEW_OPERATION_KINDS,
  PREVIEW_PLAN_SCHEMA_VERSION,
  RECONCILE_MODES,
  RUNTIME_SELECTORS,
  SUPPORTED_EMIT_MODES,
  SUPPORTED_RUNTIMES,
  SUPPORTED_SKILL_ROOTS,
  SUPPORTED_TARGETS,
  TRUST_POLICY_ACTIONS,
  TRUST_SOURCE_CLASSES,
  TRUST_VERIFICATION_STATUSES,
  UNINSTALL_BEHAVIORS,
} from "../../constants.ts";
import {
  isObject,
  validateLifecycleReasonCodes,
  validateNonEmptyString,
  validateObject,
  validateRemediationActions,
} from "../primitives.ts";

export function validateCompiledPack(record: any) {
  const errors: string[] = [];
  if (record?.kind !== "compiled-pack") {
    errors.push("kind must be compiled-pack");
  }
  if (record?.schema_version !== COMPILED_PACK_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${COMPILED_PACK_SCHEMA_VERSION}`);
  }
  if (!isOneOf(record?.runtime, SUPPORTED_RUNTIMES)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!isOneOf(record?.bundle_kind, BUNDLE_KINDS)) {
    errors.push(`unsupported bundle_kind: ${record?.bundle_kind}`);
  }
  validateNonEmptyString(record?.pack_id, "pack_id", errors, "CPK001");
  validateNonEmptyString(record?.digest, "digest", errors, "CPK001");
  validateNonEmptyString(record?.normalized_ir_digest, "normalized_ir_digest", errors, "CPK001");
  if (!Array.isArray(record?.files) || record.files.length === 0) {
    errors.push("files must be a non-empty list");
    return errors;
  }
  for (const file of record.files) {
    validateNonEmptyString(file?.asset_id, "files[].asset_id", errors, "CPK001");
    validateNonEmptyString(file?.generator, "files[].generator", errors, "CPK001");
    validateNonEmptyString(file?.relative_path, "files[].relative_path", errors, "CPK001");
    validateNonEmptyString(file?.sha256, "files[].sha256", errors, "CPK001");
    if (!isOneOf(file?.asset_kind, LOGICAL_ASSET_KINDS)) {
      errors.push(`unsupported files[].asset_kind: ${file?.asset_kind}`);
    }
    if (!isOneOf(file?.install_surface, INSTALL_SURFACES)) {
      errors.push(`unsupported files[].install_surface: ${file?.install_surface}`);
    }
    if (!isOneOf(file?.runtime_selector, RUNTIME_SELECTORS)) {
      errors.push(`unsupported files[].runtime_selector: ${file?.runtime_selector}`);
    }
    if (typeof file?.generated !== "boolean") {
      errors.push("files[].generated must be boolean");
    }
    if (typeof file?.required !== "boolean") {
      errors.push("files[].required must be boolean");
    }
    if (typeof file?.override_eligible !== "boolean") {
      errors.push("files[].override_eligible must be boolean");
    }
    if (!["pairslash", "user", "system"].includes(file?.owner)) {
      errors.push(`unsupported files[].owner: ${file?.owner}`);
    }
    if (!isOneOf(file?.uninstall_behavior, UNINSTALL_BEHAVIORS)) {
      errors.push(`unsupported files[].uninstall_behavior: ${file?.uninstall_behavior}`);
    }
    if (typeof file?.write_authority_guarded !== "boolean") {
      errors.push("files[].write_authority_guarded must be boolean");
    }
  }
  return errors;
}

function validateVersionPolicyDecision(value: unknown, field: string, errors: string[]) {
  if (!isObject(value)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (
    value?.status !== "install" &&
    value?.status !== "allowed" &&
    value?.status !== "warn" &&
    value?.status !== "blocked" &&
    value?.status !== "legacy"
  ) {
    errors.push(`${field}.status must be install, allowed, warn, blocked, or legacy`);
  }
  if (typeof value?.blocking !== "boolean") {
    errors.push(`${field}.blocking must be boolean`);
  }
  if (typeof value?.summary !== "string") {
    errors.push(`${field}.summary must be string`);
  }
  if (typeof value?.rule_id !== "string") {
    errors.push(`${field}.rule_id must be string`);
  }
}

function validateTrustReceipt(value: unknown, field: string, errors: string[]) {
  if (!isObject(value)) {
    errors.push(`${field} must be an object`);
    return;
  }
  if (value?.kind !== "trust-receipt") {
    errors.push(`${field}.kind must be trust-receipt`);
  }
  validateNonEmptyString(value?.pack_id, `${field}.pack_id`, errors, "TRU001");
  validateNonEmptyString(value?.version, `${field}.version`, errors, "TRU001");
  validateNonEmptyString(value?.manifest_digest, `${field}.manifest_digest`, errors, "TRU001");
  if (value?.compiled_digest !== null && typeof value?.compiled_digest !== "string") {
    errors.push(`${field}.compiled_digest must be string or null`);
  }
  if (!isOneOf(value?.source_class, TRUST_SOURCE_CLASSES)) {
    errors.push(`${field}.source_class must be one of ${TRUST_SOURCE_CLASSES.join(", ")}`);
  }
  if (!isOneOf(value?.verification_status, TRUST_VERIFICATION_STATUSES)) {
    errors.push(
      `${field}.verification_status must be one of ${TRUST_VERIFICATION_STATUSES.join(", ")}`,
    );
  }
  if (!isOneOf(value?.policy_action, TRUST_POLICY_ACTIONS)) {
    errors.push(`${field}.policy_action must be one of ${TRUST_POLICY_ACTIONS.join(", ")}`);
  }
  if ("trust_tier" in value && !isOneOf(value?.trust_tier, PACK_TRUST_TIERS)) {
    errors.push(`${field}.trust_tier must be one of ${PACK_TRUST_TIERS.join(", ")}`);
  }
  if ("tier_claim" in value && value?.tier_claim !== null && !isOneOf(value?.tier_claim, PACK_TRUST_TIERS)) {
    errors.push(`${field}.tier_claim must be one of ${PACK_TRUST_TIERS.join(", ")} or null`);
  }
  if (value?.publisher !== null && typeof value?.publisher !== "string") {
    errors.push(`${field}.publisher must be string or null`);
  }
  if ("publisher_class" in value && value?.publisher_class !== null && !isOneOf(value?.publisher_class, PACK_PUBLISHER_CLASSES)) {
    errors.push(
      `${field}.publisher_class must be one of ${PACK_PUBLISHER_CLASSES.join(", ")} or null`,
    );
  }
  if (value?.release_id !== null && typeof value?.release_id !== "string") {
    errors.push(`${field}.release_id must be string or null`);
  }
  if (value?.key_id !== null && typeof value?.key_id !== "string") {
    errors.push(`${field}.key_id must be string or null`);
  }
  if (value?.trust_bundle_dir !== null && typeof value?.trust_bundle_dir !== "string") {
    errors.push(`${field}.trust_bundle_dir must be string or null`);
  }
  if (value?.manifest_path !== null && typeof value?.manifest_path !== "string") {
    errors.push(`${field}.manifest_path must be string or null`);
  }
  if ("signature_status" in value && !isOneOf(value?.signature_status, PACK_SIGNATURE_STATUSES)) {
    errors.push(
      `${field}.signature_status must be one of ${PACK_SIGNATURE_STATUSES.join(", ")}`,
    );
  }
  if ("support_level" in value && !isOneOf(value?.support_level, PACK_SUPPORT_LEVELS)) {
    errors.push(`${field}.support_level must be one of ${PACK_SUPPORT_LEVELS.join(", ")}`);
  }
  if (
    "support_level_claim" in value &&
    value?.support_level_claim !== null &&
    !isOneOf(value?.support_level_claim, PACK_SUPPORT_LEVELS)
  ) {
    errors.push(
      `${field}.support_level_claim must be one of ${PACK_SUPPORT_LEVELS.join(", ")} or null`,
    );
  }
  if ("descriptor_path" in value && value?.descriptor_path !== null && typeof value?.descriptor_path !== "string") {
    errors.push(`${field}.descriptor_path must be string or null`);
  }
  if ("descriptor_digest" in value && value?.descriptor_digest !== null && typeof value?.descriptor_digest !== "string") {
    errors.push(`${field}.descriptor_digest must be string or null`);
  }
  if ("runtime_support" in value) {
    if (!isObject(value?.runtime_support)) {
      errors.push(`${field}.runtime_support must be an object`);
    } else {
      if (value.runtime_support?.runtime !== null && typeof value.runtime_support?.runtime !== "string") {
        errors.push(`${field}.runtime_support.runtime must be string or null`);
      }
      for (const supportField of ["manifest_status", "declared_status", "resolved_status"]) {
        if (!isOneOf(value.runtime_support?.[supportField], PACK_RUNTIME_SUPPORT_STATUSES)) {
          errors.push(
            `${field}.runtime_support.${supportField} must be one of ${PACK_RUNTIME_SUPPORT_STATUSES.join(", ")}`,
          );
        }
      }
      if (
        value.runtime_support?.evidence_ref !== null &&
        typeof value.runtime_support?.evidence_ref !== "string"
      ) {
        errors.push(`${field}.runtime_support.evidence_ref must be string or null`);
      }
      if (typeof value.runtime_support?.evidence_present !== "boolean") {
        errors.push(`${field}.runtime_support.evidence_present must be boolean`);
      }
      if (!isOneOf(value.runtime_support?.policy_action, TRUST_POLICY_ACTIONS)) {
        errors.push(
          `${field}.runtime_support.policy_action must be one of ${TRUST_POLICY_ACTIONS.join(", ")}`,
        );
      }
      if (!Array.isArray(value.runtime_support?.reasons)) {
        errors.push(`${field}.runtime_support.reasons must be a list`);
      }
    }
  }
  if ("capabilities" in value) {
    if (!Array.isArray(value?.capabilities)) {
      errors.push(`${field}.capabilities must be a list`);
    } else {
      for (const capability of value.capabilities) {
        validateNonEmptyString(capability, `${field}.capabilities[]`, errors, "TRU001");
      }
    }
  }
  if ("memory_authority" in value) {
    if (!isObject(value?.memory_authority)) {
      errors.push(`${field}.memory_authority must be an object`);
    } else {
      if (!isOneOf(value.memory_authority?.authority_mode, MEMORY_AUTHORITY_MODES)) {
        errors.push(
          `${field}.memory_authority.authority_mode must be one of ${MEMORY_AUTHORITY_MODES.join(", ")}`,
        );
      }
      if (!isOneOf(value.memory_authority?.global_project_memory, MEMORY_ACCESS_LEVELS)) {
        errors.push(
          `${field}.memory_authority.global_project_memory must be one of ${MEMORY_ACCESS_LEVELS.join(", ")}`,
        );
      }
      if (typeof value.memory_authority?.explicit_write_only !== "boolean") {
        errors.push(`${field}.memory_authority.explicit_write_only must be boolean`);
      }
    }
  }
  if (!Array.isArray(value?.reasons)) {
    errors.push(`${field}.reasons must be a list`);
  } else {
    for (const reason of value.reasons) {
      validateNonEmptyString(reason, `${field}.reasons[]`, errors, "TRU001");
    }
  }
  validateNonEmptyString(value?.summary, `${field}.summary`, errors, "TRU001");
  validateVersionPolicyDecision(value?.version_policy, `${field}.version_policy`, errors);
}

function validateDescriptorRuntimeSupport(value: unknown, field: string, errors: string[]) {
  if (!validateObject(value, field, errors, "PTD001")) {
    return;
  }
  if (!isOneOf(value?.status, PACK_RUNTIME_SUPPORT_STATUSES)) {
    errors.push(
      `${field}.status must be one of ${PACK_RUNTIME_SUPPORT_STATUSES.join(", ")}`,
    );
  }
  if (value?.evidence_ref !== null && typeof value?.evidence_ref !== "string") {
    errors.push(`${field}.evidence_ref must be string or null`);
  }
}

export function validatePackTrustDescriptor(record: any, { manifest = null }: { manifest?: any } = {}) {
  const errors: string[] = [];
  if (record?.kind !== "pack-trust-descriptor") {
    errors.push("kind must be pack-trust-descriptor");
  }
  if (record?.schema_version !== PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(record?.pack_name, "pack_name", errors, "PTD001");
  validateNonEmptyString(record?.pack_version, "pack_version", errors, "PTD001");
  if (!validateObject(record?.publisher, "publisher", errors, "PTD001")) {
    return errors;
  }
  validateNonEmptyString(record.publisher?.publisher_id, "publisher.publisher_id", errors, "PTD001");
  validateNonEmptyString(record.publisher?.display_name, "publisher.display_name", errors, "PTD001");
  validateNonEmptyString(record.publisher?.contact, "publisher.contact", errors, "PTD001");
  if (!isOneOf(record.publisher?.publisher_class, PACK_PUBLISHER_CLASSES)) {
    errors.push(
      `publisher.publisher_class must be one of ${PACK_PUBLISHER_CLASSES.join(", ")}`,
    );
  }
  if (!isOneOf(record?.tier_claim, PACK_TRUST_TIERS)) {
    errors.push(`tier_claim must be one of ${PACK_TRUST_TIERS.join(", ")}`);
  }
  if (!isOneOf(record?.support_level_claim, PACK_SUPPORT_LEVELS)) {
    errors.push(
      `support_level_claim must be one of ${PACK_SUPPORT_LEVELS.join(", ")}`,
    );
  }
  if (!validateObject(record?.signature, "signature", errors, "PTD001")) {
    return errors;
  }
  if (typeof record.signature?.required !== "boolean") {
    errors.push("signature.required must be boolean");
  }
  if (typeof record.signature?.allow_local_unsigned !== "boolean") {
    errors.push("signature.allow_local_unsigned must be boolean");
  }
  if (!validateObject(record?.runtime_support, "runtime_support", errors, "PTD001")) {
    return errors;
  }
  validateDescriptorRuntimeSupport(record.runtime_support?.codex_cli, "runtime_support.codex_cli", errors);
  validateDescriptorRuntimeSupport(record.runtime_support?.copilot_cli, "runtime_support.copilot_cli", errors);
  if (!validateObject(record?.policy_requirements, "policy_requirements", errors, "PTD001")) {
    return errors;
  }
  for (const field of [
    "no_silent_fallback",
    "preview_required_for_mutation",
    "explicit_write_only_memory",
  ]) {
    if (record.policy_requirements?.[field] !== true) {
      errors.push(`policy_requirements.${field} must be true`);
    }
  }
  if (manifest) {
    if (record.pack_name !== manifest.pack?.id) {
      errors.push(`pack_name must match manifest pack id ${manifest.pack?.id}`);
    }
    if (record.pack_version !== manifest.pack_version) {
      errors.push(`pack_version must match manifest pack_version ${manifest.pack_version}`);
    }
    if (
      manifest.memory_permissions?.global_project_memory === "write" &&
      record.tier_claim !== "core-maintained"
    ) {
      errors.push("memory-write packs must claim tier core-maintained");
    }
    if (record.publisher?.publisher_id === "pairslash") {
      if (record.tier_claim === "verified-external") {
        errors.push("pairslash publisher must not claim verified-external tier");
      }
      if (
        record.publisher?.publisher_class === "external" &&
        ["core-maintained", "first-party-official"].includes(record.tier_claim)
      ) {
        errors.push("pairslash publisher cannot use external publisher_class for first-party tiers");
      }
    } else if (
      ["core-maintained", "first-party-official"].includes(record.tier_claim)
    ) {
      errors.push("non-pairslash publishers cannot claim first-party tiers");
    }
    if (
      record.support_level_claim === "core-supported" &&
      record.tier_claim !== "core-maintained"
    ) {
      errors.push("core-supported support_level_claim requires tier_claim core-maintained");
    }
    if (
      record.support_level_claim === "publisher-verified" &&
      record.tier_claim !== "verified-external"
    ) {
      errors.push("publisher-verified support_level_claim requires tier_claim verified-external");
    }
  }
  return errors;
}

export function validateInstallState(record: any) {
  const errors: string[] = [];
  if (record?.kind !== "install-state") {
    errors.push("kind must be install-state");
  }
  if (record?.schema_version !== INSTALL_STATE_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${INSTALL_STATE_SCHEMA_VERSION}`);
  }
  if (!isOneOf(record?.runtime, SUPPORTED_RUNTIMES)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!isOneOf(record?.target, SUPPORTED_TARGETS)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if ("skill_root" in (record ?? {}) && !isOneOf(record?.skill_root, SUPPORTED_SKILL_ROOTS)) {
    errors.push(`unsupported skill_root: ${record?.skill_root}`);
  }
  if ("emit" in (record ?? {}) && !isOneOf(record?.emit, SUPPORTED_EMIT_MODES)) {
    errors.push(`unsupported emit mode: ${record?.emit}`);
  }
  if ("updated_at" in (record ?? {}) && typeof record?.updated_at !== "string" && record?.updated_at !== null) {
    errors.push("updated_at must be string or null");
  }
  if (
    "last_transaction_id" in (record ?? {}) &&
    typeof record?.last_transaction_id !== "string" &&
    record?.last_transaction_id !== null
  ) {
    errors.push("last_transaction_id must be string or null");
  }
  if (!Array.isArray(record?.packs)) {
    errors.push("packs must be a list");
    return errors;
  }
  for (const pack of record.packs) {
    validateNonEmptyString(pack?.id, "packs[].id", errors, "IST001");
    validateNonEmptyString(pack?.install_dir, "packs[].install_dir", errors, "IST001");
    if ("previous_version" in pack && typeof pack?.previous_version !== "string" && pack?.previous_version !== null) {
      errors.push("packs[].previous_version must be string or null");
    }
    if ("updated_at" in pack && typeof pack?.updated_at !== "string" && pack?.updated_at !== null) {
      errors.push("packs[].updated_at must be string or null");
    }
    if (!Array.isArray(pack?.files)) {
      errors.push("packs[].files must be a list");
      continue;
    }
    if ("trust_receipt" in pack && pack?.trust_receipt !== null) {
      validateTrustReceipt(pack.trust_receipt, "packs[].trust_receipt", errors);
    }
    for (const file of pack.files) {
      if ("asset_id" in file) {
        validateNonEmptyString(file?.asset_id, "packs[].files[].asset_id", errors, "IST001");
      }
      if ("generator" in file) {
        validateNonEmptyString(file?.generator, "packs[].files[].generator", errors, "IST001");
      }
      validateNonEmptyString(file?.relative_path, "packs[].files[].relative_path", errors, "IST001");
      validateNonEmptyString(file?.absolute_path, "packs[].files[].absolute_path", errors, "IST001");
      validateNonEmptyString(file?.source_digest, "packs[].files[].source_digest", errors, "IST001");
      validateNonEmptyString(file?.current_digest, "packs[].files[].current_digest", errors, "IST001");
      if (!isOneOf(file?.asset_kind, LOGICAL_ASSET_KINDS)) {
        errors.push(`unsupported packs[].files[].asset_kind: ${file?.asset_kind}`);
      }
      if (!isOneOf(file?.install_surface, INSTALL_SURFACES)) {
        errors.push(`unsupported packs[].files[].install_surface: ${file?.install_surface}`);
      }
      if (!isOneOf(file?.runtime_selector, RUNTIME_SELECTORS)) {
        errors.push(`unsupported packs[].files[].runtime_selector: ${file?.runtime_selector}`);
      }
      if (typeof file?.generated !== "boolean") {
        errors.push("packs[].files[].generated must be boolean");
      }
      if (typeof file?.write_authority_guarded !== "boolean") {
        errors.push("packs[].files[].write_authority_guarded must be boolean");
      }
      if (typeof file?.owned_by_pairslash !== "boolean") {
        errors.push("packs[].files[].owned_by_pairslash must be boolean");
      }
      if ("management_mode" in file && !isOneOf(file?.management_mode, MANAGEMENT_MODES)) {
        errors.push(`unsupported packs[].files[].management_mode: ${file?.management_mode}`);
      }
      if (typeof file?.override_eligible !== "boolean") {
        errors.push("packs[].files[].override_eligible must be boolean");
      }
      if ("required" in file && typeof file?.required !== "boolean") {
        errors.push("packs[].files[].required must be boolean when present");
      }
      if ("declared_owner" in file && !["pairslash", "user", "system"].includes(file?.declared_owner)) {
        errors.push(`unsupported packs[].files[].declared_owner: ${file?.declared_owner}`);
      }
      if ("uninstall_behavior" in file && !isOneOf(file?.uninstall_behavior, UNINSTALL_BEHAVIORS)) {
        errors.push(`unsupported packs[].files[].uninstall_behavior: ${file?.uninstall_behavior}`);
      }
      if (typeof file?.local_override !== "boolean") {
        errors.push("packs[].files[].local_override must be boolean");
      }
      if (
        "reconciled_reason_code" in file &&
        file?.reconciled_reason_code !== null &&
        !isOneOf(file?.reconciled_reason_code, LIFECYCLE_REASON_CODES)
      ) {
        errors.push(
          `unsupported packs[].files[].reconciled_reason_code: ${file?.reconciled_reason_code}`,
        );
      }
      if ("last_operation" in file && typeof file?.last_operation !== "string" && file?.last_operation !== null) {
        errors.push("packs[].files[].last_operation must be string or null");
      }
    }
  }
  return errors;
}

export function validatePreviewPlan(record: any) {
  const errors: string[] = [];
  if (record?.kind !== "preview-plan") {
    errors.push("kind must be preview-plan");
  }
  if (record?.schema_version !== PREVIEW_PLAN_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${PREVIEW_PLAN_SCHEMA_VERSION}`);
  }
  if (!["install", "update", "uninstall"].includes(record?.action)) {
    errors.push(`unsupported action: ${record?.action}`);
  }
  if (!isOneOf(record?.runtime, SUPPORTED_RUNTIMES)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!isOneOf(record?.target, SUPPORTED_TARGETS)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if (typeof record?.can_apply !== "boolean") {
    errors.push("can_apply must be boolean");
  }
  if (!Array.isArray(record?.selected_packs)) {
    errors.push("selected_packs must be a list");
  }
  if (!Array.isArray(record?.warnings)) {
    errors.push("warnings must be a list");
  }
  if (!Array.isArray(record?.errors)) {
    errors.push("errors must be a list");
  }
  if (typeof record?.requires_confirmation !== "boolean") {
    errors.push("requires_confirmation must be boolean");
  }
  if ("trust_delta" in record && record?.trust_delta !== null) {
    if (!isObject(record.trust_delta)) {
      errors.push("trust_delta must be an object");
    } else {
      if (typeof record.trust_delta.machine_readable !== "boolean") {
        errors.push("trust_delta.machine_readable must be boolean");
      }
      if (!["stable", "changed", "blocked"].includes(record.trust_delta.overall_status)) {
        errors.push("trust_delta.overall_status must be stable, changed, or blocked");
      }
      if (!Number.isInteger(record.trust_delta.blocking_count)) {
        errors.push("trust_delta.blocking_count must be an integer");
      }
      if (!Number.isInteger(record.trust_delta.changed_count)) {
        errors.push("trust_delta.changed_count must be an integer");
      }
      validateNonEmptyString(record.trust_delta.summary, "trust_delta.summary", errors, "PPL001");
      if (!Array.isArray(record.trust_delta.pack_changes)) {
        errors.push("trust_delta.pack_changes must be a list");
      } else {
        for (const change of record.trust_delta.pack_changes) {
          validateNonEmptyString(change?.pack_id, "trust_delta.pack_changes[].pack_id", errors, "PPL001");
          if (typeof change?.changed !== "boolean") {
            errors.push("trust_delta.pack_changes[].changed must be boolean");
          }
          if (typeof change?.blocking !== "boolean") {
            errors.push("trust_delta.pack_changes[].blocking must be boolean");
          }
          if (!Array.isArray(change?.reasons)) {
            errors.push("trust_delta.pack_changes[].reasons must be a list");
          }
          if ("capability_expansions" in change && !Array.isArray(change?.capability_expansions)) {
            errors.push("trust_delta.pack_changes[].capability_expansions must be a list when present");
          }
          if ("memory_escalated" in change && typeof change?.memory_escalated !== "boolean") {
            errors.push("trust_delta.pack_changes[].memory_escalated must be boolean when present");
          }
          if ("trust_downgrade" in change && typeof change?.trust_downgrade !== "boolean") {
            errors.push("trust_delta.pack_changes[].trust_downgrade must be boolean when present");
          }
        }
      }
    }
  }
  if ("reason_codes" in record) {
    validateLifecycleReasonCodes(record?.reason_codes, "reason_codes", errors, "PPL001");
  }
  if ("remediation_actions" in record) {
    validateRemediationActions(record?.remediation_actions, "remediation_actions", errors, "PPL001");
  }
  if (!Array.isArray(record?.operations)) {
    errors.push("operations must be a list");
    return errors;
  }
  for (const op of record.operations) {
    if (!isOneOf(op?.kind, PREVIEW_OPERATION_KINDS)) {
      errors.push(`unsupported operation kind: ${op?.kind}`);
    }
    validateNonEmptyString(op?.pack_id, "operations[].pack_id", errors, "PPL001");
    validateNonEmptyString(op?.absolute_path, "operations[].absolute_path", errors, "PPL001");
    validateNonEmptyString(op?.reason, "operations[].reason", errors, "PPL001");
    if ("asset_kind" in op && !isOneOf(op?.asset_kind, LOGICAL_ASSET_KINDS)) {
      errors.push(`unsupported operations[].asset_kind: ${op?.asset_kind}`);
    }
    if ("install_surface" in op && !isOneOf(op?.install_surface, INSTALL_SURFACES)) {
      errors.push(`unsupported operations[].install_surface: ${op?.install_surface}`);
    }
    if ("ownership" in op && !["pairslash", "user", "unmanaged", "system"].includes(op?.ownership)) {
      errors.push(`unsupported operations[].ownership: ${op?.ownership}`);
    }
    if ("override_eligible" in op && typeof op?.override_eligible !== "boolean") {
      errors.push("operations[].override_eligible must be boolean");
    }
    if ("reason_code" in op && !isOneOf(op?.reason_code, LIFECYCLE_REASON_CODES)) {
      errors.push(`unsupported operations[].reason_code: ${op?.reason_code}`);
    }
    if ("reason_detail" in op && op?.reason_detail !== null && typeof op?.reason_detail !== "string") {
      errors.push("operations[].reason_detail must be string or null");
    }
    if ("management_mode" in op && !isOneOf(op?.management_mode, MANAGEMENT_MODES)) {
      errors.push(`unsupported operations[].management_mode: ${op?.management_mode}`);
    }
    if ("reconcile_mode" in op && !isOneOf(op?.reconcile_mode, RECONCILE_MODES)) {
      errors.push(`unsupported operations[].reconcile_mode: ${op?.reconcile_mode}`);
    }
    if ("remediation_actions" in op) {
      validateRemediationActions(op?.remediation_actions, "operations[].remediation_actions", errors, "PPL001");
    }
  }
  if ("asset_diff" in record) {
    if (!isObject(record.asset_diff)) {
      errors.push("asset_diff must be an object");
    } else {
      for (const field of ["create_count", "update_count", "delete_count", "mutating_operation_count"]) {
        if (!Number.isInteger(record.asset_diff[field])) {
          errors.push(`asset_diff.${field} must be an integer`);
        }
      }
      if (!Array.isArray(record.asset_diff.runtime_targeted_outputs)) {
        errors.push("asset_diff.runtime_targeted_outputs must be a list");
      }
      if (!Array.isArray(record.asset_diff.config_fragments_affected)) {
        errors.push("asset_diff.config_fragments_affected must be a list");
      }
      if (!Array.isArray(record.asset_diff.risky_mutations)) {
        errors.push("asset_diff.risky_mutations must be a list");
      }
    }
  }
  if ("policy_summary" in record) {
    if (!isObject(record.policy_summary)) {
      errors.push("policy_summary must be an object");
    } else {
      if (!isOneOf(record.policy_summary.overall_verdict, POLICY_DECISIONS)) {
        errors.push(`unsupported policy_summary.overall_verdict: ${record.policy_summary.overall_verdict}`);
      }
      if (typeof record.policy_summary.no_silent_fallback !== "boolean") {
        errors.push("policy_summary.no_silent_fallback must be boolean");
      }
      if (typeof record.policy_summary.unsupported_runtime_capability !== "boolean") {
        errors.push("policy_summary.unsupported_runtime_capability must be boolean");
      }
      if (!Array.isArray(record.policy_summary.pack_verdicts)) {
        errors.push("policy_summary.pack_verdicts must be a list");
      }
      if (!Array.isArray(record.policy_summary.reasons)) {
        errors.push("policy_summary.reasons must be a list");
      }
    }
  }
  if ("commitability" in record) {
    if (!isObject(record.commitability)) {
      errors.push("commitability must be an object");
    } else {
      if (!["proceedable", "needs-explicit-approval", "blocked"].includes(record.commitability.status)) {
        errors.push(`unsupported commitability.status: ${record.commitability.status}`);
      }
      if (typeof record.commitability.can_proceed !== "boolean") {
        errors.push("commitability.can_proceed must be boolean");
      }
      if (typeof record.commitability.blocked !== "boolean") {
        errors.push("commitability.blocked must be boolean");
      }
      if (typeof record.commitability.needs_explicit_approval !== "boolean") {
        errors.push("commitability.needs_explicit_approval must be boolean");
      }
      if (!Number.isInteger(record.commitability.blocked_operations_count)) {
        errors.push("commitability.blocked_operations_count must be integer");
      }
      if (!Array.isArray(record.commitability.can_proceed_operations)) {
        errors.push("commitability.can_proceed_operations must be a list");
      }
      if (!Array.isArray(record.commitability.blocked_reasons)) {
        errors.push("commitability.blocked_reasons must be a list");
      }
      if ("blocked_reason_codes" in record.commitability) {
        validateLifecycleReasonCodes(
          record.commitability.blocked_reason_codes,
          "commitability.blocked_reason_codes",
          errors,
          "PPL001",
        );
      }
      if ("explicit_approval_hint" in record.commitability) {
        if (record.commitability.explicit_approval_hint !== null && typeof record.commitability.explicit_approval_hint !== "string") {
          errors.push("commitability.explicit_approval_hint must be string or null");
        }
      }
    }
  }
  if ("preview_boundary" in record) {
    if (!isObject(record.preview_boundary)) {
      errors.push("preview_boundary must be an object");
    } else {
      if (typeof record.preview_boundary.preview_only !== "boolean") {
        errors.push("preview_boundary.preview_only must be boolean");
      }
      if (typeof record.preview_boundary.no_commit_on_preview !== "boolean") {
        errors.push("preview_boundary.no_commit_on_preview must be boolean");
      }
      if (typeof record.preview_boundary.commit_path !== "string") {
        errors.push("preview_boundary.commit_path must be string");
      }
      if (typeof record.preview_boundary.note !== "string") {
        errors.push("preview_boundary.note must be string");
      }
    }
  }
  return errors;
}

export function validateInstallJournal(record: any) {
  const errors: string[] = [];
  if (record?.kind !== "install-journal") {
    errors.push("kind must be install-journal");
  }
  if (record?.schema_version !== INSTALL_JOURNAL_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${INSTALL_JOURNAL_SCHEMA_VERSION}`);
  }
  if (!isOneOf(record?.runtime, SUPPORTED_RUNTIMES)) {
    errors.push(`unsupported runtime: ${record?.runtime}`);
  }
  if (!isOneOf(record?.target, SUPPORTED_TARGETS)) {
    errors.push(`unsupported target: ${record?.target}`);
  }
  if (!["install", "update", "uninstall"].includes(record?.action)) {
    errors.push(`unsupported action: ${record?.action}`);
  }
  if (!["pending", "committed", "rolled_back", "rollback_failed"].includes(record?.status)) {
    errors.push(`unsupported status: ${record?.status}`);
  }
  validateNonEmptyString(record?.transaction_id, "transaction_id", errors, "IJR001");
  validateNonEmptyString(record?.journal_path, "journal_path", errors, "IJR001");
  if (!Array.isArray(record?.steps)) {
    errors.push("steps must be a list");
    return errors;
  }
  for (const step of record.steps) {
    if (!["create", "replace", "remove", "write_state"].includes(step?.kind)) {
      errors.push(`unsupported steps[].kind: ${step?.kind}`);
    }
    validateNonEmptyString(step?.path, "steps[].path", errors, "IJR001");
    if ("created_by_transaction" in step && typeof step?.created_by_transaction !== "boolean") {
      errors.push("steps[].created_by_transaction must be boolean");
    }
  }
  return errors;
}
