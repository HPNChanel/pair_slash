import { stableYaml } from "@pairslash/spec-core";

function renderCodexMetadata(ir) {
  return stableYaml({
    kind: "pairslash-codex-bundle",
    schema_version: "1.0.0",
    pack_id: ir.pack.id,
    version: ir.pack.version,
    display_name: ir.pack.display_name,
    canonical_entrypoint: ir.pack.canonical_entrypoint,
    direct_invocation: ir.runtime_support.codex_cli.direct_invocation,
    workflow_class: ir.pack.workflow_class,
    risk_level: ir.pack.risk_level,
    release_channel: ir.pack.release_channel,
    capabilities: ir.policy.capabilities,
  });
}

function renderCodexContext(ir) {
  return [
    `# ${ir.pack.display_name}`,
    "",
    ir.pack.summary,
    "",
    `- Canonical entrypoint: ${ir.pack.canonical_entrypoint}`,
    `- Workflow class: ${ir.pack.workflow_class}`,
    `- Risk level: ${ir.pack.risk_level}`,
    `- Release channel: ${ir.pack.release_channel}`,
    "",
    "## Capabilities",
    "",
    ...ir.policy.capabilities.map((capability) => `- ${capability}`),
  ].join("\n");
}

function renderCodexConfig(ir) {
  return stableYaml({
    kind: "pairslash-runtime-config",
    schema_version: "1.0.0",
    runtime: "codex_cli",
    install_targets: ir.policy.install_targets,
    required_tools: ir.policy.required_tools.map((tool) => tool.id),
    memory_permissions: ir.policy.memory_permissions,
    local_override_policy: ir.policy.local_override_policy,
    update_strategy: ir.policy.update_strategy,
    uninstall_strategy: ir.policy.uninstall_strategy,
  });
}

function renderWriteAuthorityGuard(ir) {
  return stableYaml({
    kind: "pairslash-write-authority-guard",
    schema_version: "1.0.0",
    runtime: "codex_cli",
    pack_id: ir.pack.id,
    workflow_class: ir.pack.workflow_class,
    explicit_write_only: ir.policy.memory_permissions.explicit_write_only,
    global_project_memory: ir.policy.memory_permissions.global_project_memory,
    audit_log: ir.policy.memory_permissions.audit_log,
  });
}

function renderMcpServers(ir) {
  return stableYaml({
    kind: "pairslash-mcp-config",
    schema_version: "1.0.0",
    runtime: "codex_cli",
    pack_id: ir.pack.id,
    servers: ir.policy.required_mcp_servers,
  });
}

export const codexGenerators = {
  codex_metadata: renderCodexMetadata,
  codex_context: renderCodexContext,
  codex_config: renderCodexConfig,
  codex_write_authority: renderWriteAuthorityGuard,
  codex_mcp: renderMcpServers,
};
