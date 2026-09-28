import {
  buildMcpServerDescriptors,
  buildNormalizedIr,
  buildPreflightAdvisory,
  stableYaml,
} from "@pairslash/spec-core";

type NormalizedIr = ReturnType<typeof buildNormalizedIr>;

function renderCodexMetadata(ir: NormalizedIr) {
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

function renderCodexContext(ir: NormalizedIr) {
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
    ...ir.policy.capabilities.map((capability: string) => `- ${capability}`),
  ].join("\n");
}

function renderCodexConfig(ir: NormalizedIr) {
  return stableYaml({
    kind: "pairslash-runtime-config",
    schema_version: "1.0.0",
    runtime: "codex_cli",
    install_targets: ir.policy.install_targets,
    required_tools: ir.policy.required_tools.map((tool: { id: string }) => tool.id),
    memory_permissions: ir.policy.memory_permissions,
    local_override_policy: ir.policy.local_override_policy,
    update_strategy: ir.policy.update_strategy,
    uninstall_strategy: ir.policy.uninstall_strategy,
  });
}

function renderWriteAuthorityGuard(ir: NormalizedIr) {
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

function renderMcpServers(ir: NormalizedIr) {
  return stableYaml({
    kind: "pairslash-mcp-config",
    schema_version: "1.1.0",
    runtime: "codex_cli",
    pack_id: ir.pack.id,
    declarative_only: true,
    note: "PairSlash declares expected MCP dependencies; the runtime owns connection management and negotiation.",
    servers: buildMcpServerDescriptors(ir.policy.required_mcp_servers),
  });
}

function renderCodexPreflight(ir: NormalizedIr) {
  return stableYaml({
    kind: "pairslash-codex-preflight",
    schema_version: "1.0.0",
    pack_id: ir.pack.id,
    runtime: "codex_cli",
    checks: [
      ...(ir.pack.workflow_class === "write-authority"
        ? [
            {
              id: "write-authority-guard",
              required: true,
              global_project_memory: ir.policy.memory_permissions.global_project_memory,
            },
          ]
        : []),
      ...(ir.policy.required_mcp_servers.length > 0
        ? [
            {
              id: "mcp-dependencies",
              required: true,
              servers: ir.policy.required_mcp_servers.map((server: { id: string }) => server.id),
            },
          ]
        : []),
    ],
    hooks: buildPreflightAdvisory({ ir, runtime: "codex_cli" }),
  });
}

export const codexGenerators = {
  codex_metadata: renderCodexMetadata,
  codex_context: renderCodexContext,
  codex_config: renderCodexConfig,
  codex_write_authority: renderWriteAuthorityGuard,
  codex_preflight: renderCodexPreflight,
  codex_mcp: renderMcpServers,
};
