import { stableJson, stableYaml } from "@pairslash/spec-core";

function renderCopilotPackage(ir) {
  return stableJson({
    kind: "pairslash-copilot-package",
    schema_version: "1.0.0",
    pack_id: ir.pack.id,
    version: ir.pack.version,
    display_name: ir.pack.display_name,
    canonical_entrypoint: ir.pack.canonical_entrypoint,
    direct_invocation: ir.runtime_support.copilot_cli.direct_invocation,
    workflow_class: ir.pack.workflow_class,
    release_channel: ir.pack.release_channel,
    capabilities: ir.policy.capabilities,
    includes_agents: true,
    includes_hooks:
      ir.pack.workflow_class === "write-authority" || ir.policy.required_mcp_servers.length > 0,
    includes_mcp: ir.policy.required_mcp_servers.length > 0,
  });
}

function renderCopilotAgentContext(ir) {
  return [
    `# ${ir.pack.display_name}`,
    "",
    `- Canonical entrypoint: ${ir.pack.canonical_entrypoint}`,
    `- Direct invocation: ${ir.runtime_support.copilot_cli.direct_invocation}`,
    `- Workflow class: ${ir.pack.workflow_class}`,
    "",
    "## Runtime package surfaces",
    "",
    "- package/: PairSlash-managed distribution metadata",
    "- agents/: runtime context sidecars",
    "- hooks/: preflight declarations when guardrails or MCP are required",
    "- mcp/: declared MCP server dependencies",
  ].join("\n");
}

function renderCopilotPreflight(ir) {
  return stableYaml({
    kind: "pairslash-copilot-preflight",
    schema_version: "1.0.0",
    pack_id: ir.pack.id,
    runtime: "copilot_cli",
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
              servers: ir.policy.required_mcp_servers.map((server) => server.id),
            },
          ]
        : []),
    ],
  });
}

function renderMcpServers(ir) {
  return stableYaml({
    kind: "pairslash-mcp-config",
    schema_version: "1.0.0",
    runtime: "copilot_cli",
    pack_id: ir.pack.id,
    servers: ir.policy.required_mcp_servers,
  });
}

export const copilotGenerators = {
  copilot_package: renderCopilotPackage,
  copilot_agent: renderCopilotAgentContext,
  copilot_preflight: renderCopilotPreflight,
  copilot_mcp: renderMcpServers,
};
