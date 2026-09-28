import {
  buildMcpServerDescriptors,
  buildNormalizedIr,
  buildPreflightAdvisory,
  stableJson,
  stableYaml,
} from "@pairslash/spec-core";

type NormalizedIr = ReturnType<typeof buildNormalizedIr>;

function renderCopilotPackage(ir: NormalizedIr) {
  return stableJson({
    kind: "pairslash-copilot-package",
    schema_version: "1.0.0",
    pack_id: ir.pack.id,
    version: ir.pack.version,
    display_name: ir.pack.display_name,
    canonical_entrypoint: ir.pack.canonical_entrypoint,
    implicit_invocation: ir.pack.implicit_invocation,
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

function renderCopilotAgentContext(ir: NormalizedIr) {
  return [
    `# ${ir.pack.display_name}`,
    "",
    `- Canonical entrypoint: ${ir.pack.canonical_entrypoint}`,
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

function renderCopilotPreflight(ir: NormalizedIr) {
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
              servers: ir.policy.required_mcp_servers.map((server: { id: string }) => server.id),
            },
          ]
        : []),
    ],
    hooks: buildPreflightAdvisory({ ir, runtime: "copilot_cli" }),
  });
}

// Emits the Copilot custom-agent shim (agents/<pack>.agent.md). The agent is a
// persona entry point only — the canonical SKILL.md workflow contract remains
// the single semantic authority (charter §13.3, C.18.1).
// Schema source: docs.github.com custom-agents reference — frontmatter fields
// name/description/tools/model/target/disable-model-invocation/user-invocable/
// mcp-servers/metadata; description is required; body <= 30,000 chars.
function renderCopilotAgentProfile(ir: NormalizedIr) {
  const implicitAllowed = ir.pack.implicit_invocation === "implicit-allowed";
  const description = String(ir.pack.summary ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1024);
  const frontmatter = [
    "---",
    `name: ${JSON.stringify(String(ir.pack.id))}`,
    `description: ${JSON.stringify(description)}`,
    `tools: ["read", "search"]`,
    // disable-model-invocation maps the declared implicit_invocation intent to
    // the agent's real runtime knob: explicit-only packs must be manually
    // selected; implicit-allowed packs leave auto-selection to the runtime.
    ...(implicitAllowed ? [] : ["disable-model-invocation: true"]),
    "metadata:",
    `  pairslash_pack: ${JSON.stringify(String(ir.pack.id))}`,
    '  pairslash_canonical_entrypoint: "/skills"',
    "---",
  ];
  const body = [
    "",
    `# ${ir.pack.display_name}`,
    "",
    `You are a persona shim for the PairSlash workflow \`${ir.pack.id}\`.`,
    "",
    `- Canonical entrypoint: \`/skills\` → select \`${ir.pack.id}\`.`,
    "- The pack's `SKILL.md` workflow contract is the single semantic authority",
    "  for inputs, outputs, failure behavior, and memory permissions.",
    "- Do not re-implement or extend the workflow here; follow the contract and",
    "  defer to it when instructions could diverge.",
    "- This agent performs no writes beyond what the workflow contract declares.",
    "",
  ];
  return `${frontmatter.join("\n")}${body.join("\n")}`;
}

function renderMcpServers(ir: NormalizedIr) {
  return stableYaml({
    kind: "pairslash-mcp-config",
    schema_version: "1.1.0",
    runtime: "copilot_cli",
    pack_id: ir.pack.id,
    declarative_only: true,
    note: "PairSlash declares expected MCP dependencies; the runtime owns connection management and negotiation.",
    servers: buildMcpServerDescriptors(ir.policy.required_mcp_servers),
  });
}

export const copilotGenerators = {
  copilot_package: renderCopilotPackage,
  copilot_agent: renderCopilotAgentContext,
  copilot_agent_profile: renderCopilotAgentProfile,
  copilot_preflight: renderCopilotPreflight,
  copilot_mcp: renderMcpServers,
};
