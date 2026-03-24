import * as runtimeAdapter from "@pairslash/runtime-codex-adapter";
import { compilePack, createGeneratedLogicalAsset, stableYaml } from "@pairslash/spec-core";

function mapAsset(runtimeLogicalAsset) {
  if (!runtimeAdapter.supportsInstallSurface(runtimeLogicalAsset.install_surface)) {
    throw new Error(
      `codex emitter does not support install surface ${runtimeLogicalAsset.install_surface}`,
    );
  }
  return {
    ...runtimeLogicalAsset,
    relative_path: runtimeAdapter.resolveAssetPath(runtimeLogicalAsset),
  };
}

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
    `- Direct invocation: ${ir.runtime_support.codex_cli.direct_invocation}`,
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
    override_policy: {
      strategy: ir.policy.local_override_policy.strategy,
      eligible_paths: ir.policy.local_override_policy.eligible_paths,
    },
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

function emitCodexBundle({ ir }) {
  const emitted = ir.logical_assets
    .filter((asset) => asset.runtime_selector === "shared")
    .map(mapAsset);

  emitted.push(
    mapAsset(
      createGeneratedLogicalAsset({
        logicalId: "codex:metadata",
        assetKind: "runtime_manifest",
        runtimeSelector: "codex_cli",
        installSurface: "metadata",
        fileName: "openai.yaml",
        contentType: "text/yaml",
        content: renderCodexMetadata(ir),
        writeAuthorityGuarded: ir.pack.workflow_class === "write-authority",
      }),
    ),
  );
  emitted.push(
    mapAsset(
      createGeneratedLogicalAsset({
        logicalId: "codex:context",
        assetKind: "context_fragment",
        runtimeSelector: "codex_cli",
        installSurface: "context",
        fileName: "runtime-context.md",
        contentType: "text/markdown",
        content: renderCodexContext(ir),
        writeAuthorityGuarded: ir.pack.workflow_class === "write-authority",
      }),
    ),
  );
  emitted.push(
    mapAsset(
      createGeneratedLogicalAsset({
        logicalId: "codex:config",
        assetKind: "config_fragment",
        runtimeSelector: "codex_cli",
        installSurface: "config",
        fileName: "pack-config.yaml",
        contentType: "text/yaml",
        content: renderCodexConfig(ir),
        writeAuthorityGuarded: ir.pack.workflow_class === "write-authority",
      }),
    ),
  );

  if (ir.pack.workflow_class === "write-authority") {
    emitted.push(
      mapAsset(
        createGeneratedLogicalAsset({
          logicalId: "codex:write-authority",
          assetKind: "config_fragment",
          runtimeSelector: "codex_cli",
          installSurface: "config",
          fileName: "write-authority.yaml",
          contentType: "text/yaml",
          content: renderWriteAuthorityGuard(ir),
          writeAuthorityGuarded: true,
        }),
      ),
    );
  }

  if (ir.policy.required_mcp_servers.length > 0) {
    emitted.push(
      mapAsset(
        createGeneratedLogicalAsset({
          logicalId: "codex:mcp",
          assetKind: "mcp_config",
          runtimeSelector: "codex_cli",
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

export function compileCodexPack(options) {
  return compilePack({
    ...options,
    runtime: "codex_cli",
    runtimeAdapter,
    emitBundle: emitCodexBundle,
  });
}

export { emitCodexBundle, runtimeAdapter };
