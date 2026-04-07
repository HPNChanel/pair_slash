export const LEGACY_PHASE4_SCHEMA_VERSION = "2.0.0";
export const PHASE4_SCHEMA_VERSION = "2.1.0";
export const PHASE4_COMPILER_VERSION = "2.0.0";
export const NORMALIZED_IR_SCHEMA_VERSION = "1.0.0";
export const COMPILED_PACK_SCHEMA_VERSION = "1.0.0";
export const INSTALL_STATE_SCHEMA_VERSION = "1.0.0";
export const PREVIEW_PLAN_SCHEMA_VERSION = "1.0.0";
export const DOCTOR_REPORT_SCHEMA_VERSION = "2.1.0";
export const INSTALL_JOURNAL_SCHEMA_VERSION = "1.0.0";
export const LINT_REPORT_SCHEMA_VERSION = "1.0.0";
export const RELEASE_MANIFEST_SCHEMA_VERSION = "1.0.0";
export const PACK_METADATA_ENVELOPE_SCHEMA_VERSION = "1.0.0";
export const PACK_TRUST_DESCRIPTOR_SCHEMA_VERSION = "1.0.0";
export const DETACHED_SIGNATURE_SCHEMA_VERSION = "1.0.0";
export const TRUST_RECEIPT_SCHEMA_VERSION = "1.0.0";
export const TRUST_POLICY_SCHEMA_VERSION = "1.0.0";
export const VERSION_POLICY_SCHEMA_VERSION = "1.0.0";
export const CONTRACT_ENVELOPE_SCHEMA_VERSION = "2.0.0";
export const POLICY_VERDICT_SCHEMA_VERSION = "2.0.0";
export const MEMORY_WRITE_REQUEST_SCHEMA_VERSION = "1.0.0";
export const MEMORY_WRITE_PREVIEW_SCHEMA_VERSION = "1.0.0";
export const MEMORY_WRITE_RESULT_SCHEMA_VERSION = "1.0.0";
export const MEMORY_WRITE_STAGING_SCHEMA_VERSION = "1.0.0";
export const AUDIT_LOG_ENTRY_SCHEMA_VERSION = "0.1.0";
export const CANDIDATE_REPORT_SCHEMA_VERSION = "0.2.0";
export const TRACE_EVENT_SCHEMA_VERSION = "1.0.0";
export const TRACE_EXPORT_SCHEMA_VERSION = "1.0.0";
export const SUPPORT_BUNDLE_SCHEMA_VERSION = "1.0.0";
export const CONTEXT_EXPLANATION_SCHEMA_VERSION = "1.1.0";
export const POLICY_EXPLANATION_SCHEMA_VERSION = "1.0.0";
export const DEBUG_REPORT_SCHEMA_VERSION = "1.0.0";
export const TELEMETRY_SUMMARY_SCHEMA_VERSION = "1.0.0";

export const SUPPORTED_RUNTIMES = ["codex_cli", "copilot_cli"];
export const SUPPORTED_TARGETS = ["repo", "user"];
export const PACK_STATUSES = ["active", "draft", "deprecated"];
export const RELEASE_CHANNELS = ["stable", "preview", "canary"];
export const WORKFLOW_CLASSES = ["read-oriented", "dual-mode", "write-authority"];
export const MANIFEST_SHAPES = ["legacy-v2.0.0", "canonical-v2.1.0"];
export const CAPABILITY_FLAGS = [
  "plan_generation",
  "repo_read",
  "repo_write",
  "shell_exec",
  "test_exec",
  "review_analysis",
  "memory_read",
  "memory_write_global",
  "mcp_client",
  "preview_emit",
];
export const RISK_LEVELS = ["low", "medium", "high", "critical"];
export const MEMORY_AUTHORITY_MODES = ["read-only", "write-authority"];
export const MEMORY_ACCESS_LEVELS = ["none", "read", "write"];
export const SESSION_ARTIFACT_LEVELS = ["none", "implicit-read", "read", "write"];
export const AUDIT_LOG_LEVELS = ["none", "append"];
export const TOOL_KINDS = ["binary", "script", "env_var"];
export const TOOL_PHASES = ["compile", "install", "run", "doctor"];
export const COMPATIBILITY_STATUSES = ["supported", "unverified", "blocked"];
export const UPDATE_STRATEGY_MODES = ["preserve_valid_local_overrides"];
export const UPDATE_NON_OVERRIDE_POLICIES = ["block"];
export const UNINSTALL_STRATEGY_MODES = ["pairslash_owned_only"];
export const UNINSTALL_BEHAVIORS = ["remove_if_unmodified", "detach_if_modified", "preserve_unmanaged"];
export const MANIFEST_MARKER_MODES = ["state_or_explicit_marker"];
export const RUNTIME_METADATA_MODES = ["openai_yaml_optional", "none"];
export const RUNTIME_ASSET_GENERATORS = [
  "source_copy",
  "codex_metadata",
  "codex_context",
  "codex_config",
  "codex_write_authority",
  "codex_mcp",
  "copilot_package",
  "copilot_agent",
  "copilot_preflight",
  "copilot_mcp",
  "pairslash_ownership_receipt",
];
export const MANIFEST_SMOKE_ACTIONS = [
  "preview_install",
  "preview_update",
  "preview_uninstall",
  "doctor",
];
export const MANAGEMENT_MODES = ["pairslash_owned", "reconciled_unmanaged"];
export const RECONCILE_MODES = ["identical", "override_preserved"];
export const LIFECYCLE_REASON_CODES = [
  "install-state-invalid",
  "install-state-metadata-mismatch",
  "managed-pack-requires-update",
  "reconcile-unmanaged-identical",
  "reconcile-unmanaged-override-preserved",
  "unmanaged-conflict-blocking",
  "managed-override-preserved",
  "managed-orphan-override-preserved",
  "ownership-metadata-conflict",
  "update-conflict-blocking",
  "uninstall-preserve-unmanaged",
];
export const REMEDIATION_ACTION_KINDS = ["run_command", "review_manual"];
export const REMEDIATION_STATUSES = ["none", "advisory", "blocked"];
export const REMEDIATION_DECISIONS = ["repair", "adopt", "reconcile", "abort"];
export const PREVIEW_OPERATION_KINDS = [
  "mkdir",
  "create",
  "replace",
  "reconcile_unmanaged",
  "skip_identical",
  "preserve_override",
  "remove",
  "skip_unmanaged",
  "blocked_conflict",
  "write_state",
  "write_journal",
];
export const SUPPORT_VERDICTS = ["pass", "warn", "degraded", "fail", "unsupported"];
export const POLICY_DECISIONS = ["allow", "ask", "deny", "require-preview"];
export const POLICY_RISK_CATEGORIES = [
  "read-only",
  "local-write",
  "repo-write",
  "destructive",
  "networked",
  "secret-touching",
];
export const POLICY_REASON_AREAS = [
  "contract",
  "runtime-boundary",
  "capability",
  "tool",
  "preview",
  "approval",
  "memory-authority",
  "fallback",
  "conflict",
  "risk",
];
export const POLICY_PRIMARY_ENFORCEMENT_MODES = [
  "pairslash-wrapper",
  "pairslash-wrapper-plus-hook-assist",
];
export const POLICY_HOOK_SUPPORT_LEVELS = ["none", "advisory", "enforcing"];
export const CAPABILITY_NEGOTIATION_RESULTS = [
  "granted",
  "ask",
  "denied",
  "fallback-blocked",
];
export const CONTRACT_INPUT_SOURCES = ["cli", "workflow", "api"];
export const CONTRACT_INPUT_MODES = ["read", "preview", "apply", "lint", "doctor"];
export const CONTRACT_OUTPUT_SHAPES = [
  "structured-markdown",
  "structured-json",
  "structured-yaml",
];
export const CONTRACT_MEMORY_MODES = ["none", "read", "write", "promote"];
export const CONTRACT_MEMORY_TARGET_SCOPES = [
  "global-project-memory",
  "task-memory",
  "staging",
  "none",
];
export const CONTRACT_RUNTIME_SCOPES = ["codex-only", "copilot-only", "both"];
export const CONTRACT_FAILURE_TYPES = [
  "validation-failure",
  "capability-mismatch",
  "runtime-unsupported",
  "policy-blocked",
  "tool-unavailable",
];
export const DOCTOR_CHECK_GROUPS = [
  "runtime",
  "scope",
  "filesystem",
  "manifest",
  "dependencies",
  "install_state",
  "conflict",
  "platform",
  "trust",
];
export const DOCTOR_CHECK_STATUSES = ["pass", "warn", "degraded", "fail", "unsupported", "skip"];
export const DOCTOR_CHECK_SEVERITIES = ["info", "warn", "fail"];
export const LINT_CHECK_RESULTS = ["pass", "error", "warning", "note"];
export const OWNERSHIP_FILE = "pairslash.install.json";
export const OVERRIDE_MARKER_FILE = ".pairslash.local-overrides.yaml";
export const NORMALIZED_IR_FILE = "normalized-ir.json";
export const COMPILED_PACK_FILE = "compiled-pack.json";
export const INSTALL_JOURNAL_DIR = "install-journal";
export const RELEASE_TRUST_DIR = "dist/release-trust";
export const MEMORY_RECORD_KINDS = [
  "decision",
  "command",
  "glossary",
  "constraint",
  "ownership",
  "incident-lesson",
  "pattern",
];
export const MEMORY_RECORD_SCOPES = ["whole-project", "subsystem", "path-prefix"];
export const MEMORY_RECORD_CONFIDENCE = ["low", "medium", "high"];
export const MEMORY_RECORD_ACTIONS = ["append", "supersede", "reject-candidate-if-conflict"];
export const MEMORY_INDEX_STATUSES = ["active", "superseded", "deprecated"];
export const MEMORY_REQUEST_SOURCES = ["cli", "workflow", "api"];
export const MEMORY_WRITE_STATUSES = ["preview", "committed", "rejected", "conflict", "denied", "failed"];
export const MEMORY_PIPELINE_STAGE_STATUSES = ["ok", "warn", "blocked", "skipped"];
export const MEMORY_APPROVAL_STATES = ["pending", "explicit", "rejected", "not-required"];
export const MEMORY_RECORD_LAYERS = [
  "global-project-memory",
  "task-memory",
  "session",
  "staging",
];
export const TRACE_SEVERITIES = ["debug", "info", "warn", "error", "fatal"];
export const TRACE_FAILURE_DOMAINS = [
  "none",
  "spec",
  "compiler",
  "policy",
  "runtime_adapter",
  "runtime_host",
  "memory",
  "filesystem",
  "config",
  "unknown",
];
export const TRACE_OUTCOMES = [
  "started",
  "ok",
  "pass",
  "allow",
  "warn",
  "degraded",
  "blocked",
  "denied",
  "failed",
  "finished",
  "exported",
];
export const TRACE_EVENT_TYPES = [
  "session.started",
  "session.finished",
  "workflow.started",
  "workflow.finished",
  "command.started",
  "command.finished",
  "spec.validated",
  "compiler.started",
  "compiler.finished",
  "policy.evaluated",
  "runtime.enforced",
  "runtime.host_probed",
  "memory.previewed",
  "memory.apply_attempted",
  "memory.committed",
  "memory.rejected",
  "doctor.check_completed",
  "compat.fixture_run",
  "trace.exported",
  "support.bundle_created",
  "error.raised",
];
export const TELEMETRY_MODES = ["off", "local", "minimal-opt-in"];

export const BUNDLE_KINDS = ["codex-skill-bundle", "copilot-package-bundle"];
export const RUNTIME_SELECTORS = ["shared", ...SUPPORTED_RUNTIMES];
export const LOGICAL_ASSET_KINDS = [
  "skill_markdown",
  "support_doc",
  "context_fragment",
  "agent_fragment",
  "config_fragment",
  "hook_script",
  "mcp_config",
  "runtime_manifest",
  "ownership_manifest",
];
export const INSTALL_SURFACES = [
  "canonical_skill",
  "support_doc",
  "metadata",
  "context",
  "config",
  "agent",
  "hook",
  "mcp",
];
export const TRUST_SOURCE_CLASSES = [
  "first-party-release",
  "local-source",
  "external-trusted",
  "external-unverified",
];
export const TRUST_VERIFICATION_STATUSES = ["verified", "local", "unverified", "legacy"];
export const TRUST_POLICY_ACTIONS = ["allow", "ask", "deny"];
export const PACK_TRUST_TIERS = [
  "core-maintained",
  "first-party-official",
  "verified-external",
  "local-dev",
  "unverified-external",
];
export const PACK_SUPPORT_LEVELS = [
  "core-supported",
  "official-preview",
  "publisher-verified",
  "local-dev",
  "unsupported",
];
export const PACK_RUNTIME_SUPPORT_STATUSES = ["supported", "partial", "unverified", "blocked"];
export const PACK_PUBLISHER_CLASSES = ["core-product", "first-party", "external"];
export const PACK_SIGNATURE_STATUSES = ["verified", "missing", "invalid", "local-dev"];
export const PACK_CATALOG_CLASSES = ["core", "advanced", "docs-only"];
export const PACK_DOCS_VISIBILITY = ["public", "maintainer", "hidden"];
export const PACK_RELEASE_VISIBILITY = ["public", "appendix", "hidden"];
export const PACK_DEPRECATION_STATUSES = ["active", "deprecated", "archived"];
export const PACK_RUNTIME_EVIDENCE_KINDS = [
  "lane-matrix",
  "pack-runtime-live",
  "deterministic",
  "docs-only",
];
