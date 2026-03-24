export const PHASE4_SCHEMA_VERSION = "2.0.0";
export const PHASE4_COMPILER_VERSION = "2.0.0";
export const NORMALIZED_IR_SCHEMA_VERSION = "1.0.0";
export const COMPILED_PACK_SCHEMA_VERSION = "1.0.0";
export const INSTALL_STATE_SCHEMA_VERSION = "1.0.0";
export const PREVIEW_PLAN_SCHEMA_VERSION = "1.0.0";
export const DOCTOR_REPORT_SCHEMA_VERSION = "2.0.0";
export const INSTALL_JOURNAL_SCHEMA_VERSION = "1.0.0";
export const LINT_REPORT_SCHEMA_VERSION = "1.0.0";

export const SUPPORTED_RUNTIMES = ["codex_cli", "copilot_cli"];
export const SUPPORTED_TARGETS = ["repo", "user"];
export const PACK_STATUSES = ["active", "draft", "deprecated"];
export const RELEASE_CHANNELS = ["stable", "preview", "canary"];
export const WORKFLOW_CLASSES = ["read-oriented", "dual-mode", "write-authority"];
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
export const PREVIEW_OPERATION_KINDS = [
  "mkdir",
  "create",
  "replace",
  "skip_identical",
  "preserve_override",
  "remove",
  "skip_unmanaged",
  "blocked_conflict",
  "write_state",
  "write_journal",
];
export const SUPPORT_VERDICTS = ["pass", "warn", "degraded", "fail"];
export const DOCTOR_CHECK_GROUPS = [
  "runtime",
  "scope",
  "filesystem",
  "manifest",
  "dependencies",
  "install_state",
  "conflict",
  "platform",
];
export const DOCTOR_CHECK_STATUSES = ["pass", "warn", "fail", "skip"];
export const DOCTOR_CHECK_SEVERITIES = ["info", "warn", "fail"];
export const LINT_CHECK_RESULTS = ["pass", "error", "warning", "note"];
export const OWNERSHIP_FILE = "pairslash.install.json";
export const OVERRIDE_MARKER_FILE = ".pairslash.local-overrides.yaml";
export const NORMALIZED_IR_FILE = "normalized-ir.json";
export const COMPILED_PACK_FILE = "compiled-pack.json";
export const INSTALL_JOURNAL_DIR = "install-journal";

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
