import * as runtimeAdapter from "@pairslash/runtime-copilot-adapter";
import {
  compilePack,
  createGeneratedLogicalAsset,
  stableJson,
  stableYaml,
} from "@pairslash/spec-core";

function mapAsset(runtimeLogicalAsset) {
  if (!runtimeAdapter.supportsInstallSurface(runtimeLogicalAsset.install_surface)) {
    throw new Error(
      `copilot emitter does not support install surface ${runtimeLogicalAsset.install_surface}`,
    );
  }
  return {
    ...runtimeLogicalAsset,
    relative_path: runtimeAdapter.resolveAssetPath(runtimeLogicalAsset),
  };
}

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

function emitCopilotBundle({ ir }) {
  const emitted = ir.logical_assets
    .filter((asset) => asset.runtime_selector === "shared")
    .map(mapAsset);

  emitted.push(
    mapAsset(
      createGeneratedLogicalAsset({
        logicalId: "copilot:package",
        assetKind: "runtime_manifest",
        runtimeSelector: "copilot_cli",
        installSurface: "metadata",
        fileName: "pairslash-bundle.json",
        contentType: "application/json",
        content: renderCopilotPackage(ir),
        writeAuthorityGuarded: ir.pack.workflow_class === "write-authority",
      }),
    ),
  );
  emitted.push(
    mapAsset(
      createGeneratedLogicalAsset({
        logicalId: "copilot:agent-context",
        assetKind: "agent_fragment",
        runtimeSelector: "copilot_cli",
        installSurface: "agent",
        fileName: "runtime-context.md",
        contentType: "text/markdown",
        content: renderCopilotAgentContext(ir),
        writeAuthorityGuarded: ir.pack.workflow_class === "write-authority",
      }),
    ),
  );

  if (ir.pack.workflow_class === "write-authority" || ir.policy.required_mcp_servers.length > 0) {
    emitted.push(
      mapAsset(
        createGeneratedLogicalAsset({
          logicalId: "copilot:preflight",
          assetKind: "hook_script",
          runtimeSelector: "copilot_cli",
          installSurface: "hook",
          fileName: "preflight.yaml",
          contentType: "text/yaml",
          content: renderCopilotPreflight(ir),
          writeAuthorityGuarded: ir.pack.workflow_class === "write-authority",
        }),
      ),
    );
  }

  if (ir.policy.required_mcp_servers.length > 0) {
    emitted.push(
      mapAsset(
        createGeneratedLogicalAsset({
          logicalId: "copilot:mcp",
          assetKind: "mcp_config",
          runtimeSelector: "copilot_cli",
          installSurface: "mcp",
          fileName: "servers.yaml",
          contentType: "text/yaml",
          content: renderMcpServers(ir),
          writeAuthorityGuarded: ir.pack.workflow_class === "write-authority",
        }),
      ),
    );
  }

  return emitted;
}

export function compileCopilotPack(options) {
  return compilePack({
    ...options,
    runtime: "copilot_cli",
    runtimeAdapter,
    emitBundle: emitCopilotBundle,
  });
}

export { emitCopilotBundle, runtimeAdapter };
