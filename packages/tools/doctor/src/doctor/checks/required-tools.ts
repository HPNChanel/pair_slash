import {
  join,
} from "node:path";
import {
  createCheckResult,
  runCheckCommand,
  safeStat,
} from "../helpers.ts";

export function runRequiredTools(context: any) {
  if (context.selectedManifests.length === 0) {
    return createCheckResult({
      id: "dependencies.required_tools",
      group: "dependencies",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no selected manifests require tools for doctor checks",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
    const statePacks = new Map<string, any>((context.state?.packs ?? []).map((pack: any) => [pack.id, pack]));

  for (const record of context.selectedManifests) {
    for (const tool of record.manifest.required_tools ?? []) {
      const requiredFor = new Set<string>(tool.required_for ?? []);
      if (![...requiredFor].some((phase) => ["doctor", "install", "run"].includes(phase))) {
        continue;
      }
      const result = runCheckCommand(tool.check_command);
      if (result.status === 0) {
        continue;
      }
      const detail = {
        pack_id: record.packId,
        tool_id: tool.id,
        required_for: [...requiredFor],
        error: result.stderr?.trim() || result.stdout?.trim() || "tool check failed",
      };
      const installed = statePacks.has(record.packId);
      if (requiredFor.has("doctor") || requiredFor.has("install") || installed) {
        failures.push(detail);
      } else {
        warnings.push(detail);
      }
    }
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "dependencies.required_tools",
      group: "dependencies",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} required tool check(s) failed`,
      remediation: "Install the missing tool(s) or fix PATH/environment variables so each manifest tool check passes.",
      evidence: {
        failures,
        warnings,
      },
      blockingForInstall: true,
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "dependencies.required_tools",
      group: "dependencies",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} run-only tool requirement(s) are missing for uninstalled packs`,
      remediation: "Install the missing run-time tools before installing or invoking those packs.",
      evidence: {
        warnings,
      },
    });
  }
  return createCheckResult({
    id: "dependencies.required_tools",
    group: "dependencies",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "required tool checks passed",
    evidence: {},
  });
}

export function buildExpectedMcpPath(context: any, installDir: any) {
  const relativePath = context.adapter.resolveAssetPath({
    install_surface: "mcp",
    file_name: "servers.yaml",
  });
  return join(installDir, relativePath);
}

export function runRequiredMcpServers(context: any) {
  if (context.selectedManifests.length === 0) {
    return createCheckResult({
      id: "dependencies.required_mcp_servers",
      group: "dependencies",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no selected manifests require MCP servers",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
  const eraMap = [];
  const legacyServers = [];
    const statePacks = new Map<string, any>((context.state?.packs ?? []).map((pack: any) => [pack.id, pack]));

  for (const record of context.selectedManifests) {
    const servers = record.manifest.required_mcp_servers ?? [];
    if (servers.length === 0) {
      continue;
    }
    const serverEras = servers.map((server: any) => ({
      id: server.id,
      spec_era: server.spec_era ?? "dual",
    }));
    eraMap.push({ pack_id: record.packId, servers: serverEras });
    for (const server of serverEras) {
      if (server.spec_era === "legacy") {
        legacyServers.push(`${record.packId}:${server.id}`);
      }
    }
    const installedPack = statePacks.get(record.packId);
    if (!installedPack) {
      warnings.push({
        pack_id: record.packId,
        servers: servers.map((server: any) => server.id),
        reason: "pack not installed; declaration-only verification",
      });
      continue;
    }
    const mcpPath = buildExpectedMcpPath(context, installedPack.install_dir);
    const stat = safeStat(mcpPath);
    if (!stat.ok || !stat.stat?.isFile()) {
      failures.push({
        pack_id: record.packId,
        path: mcpPath,
        servers: servers.map((server: any) => server.id),
      });
    }
  }

  const eraEvidence =
    eraMap.length > 0
      ? {
          spec_era_map: eraMap,
          legacy_declarations: legacyServers,
          era_guidance:
            "modern-era servers (MCP 2026-07-28) are expected to be stateless, require Mcp-Method/Mcp-Name headers, and answer server/discover; legacy-era declarations may hit UnsupportedProtocolVersionError during negotiation",
        }
      : {};
  if (legacyServers.length > 0) {
    warnings.push({
      pack_id: null,
      servers: legacyServers,
      reason:
        "legacy-era MCP declarations rely on 2025-11-25 semantics; upgrade declarations to dual/modern after verifying server support",
    });
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "dependencies.required_mcp_servers",
      group: "dependencies",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} installed pack(s) are missing MCP config assets`,
      remediation: "Reinstall the affected pack or restore the runtime MCP config asset under the managed install directory.",
      evidence: {
        failures,
        warnings,
        ...eraEvidence,
      },
      blockingForInstall: true,
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "dependencies.required_mcp_servers",
      group: "dependencies",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} MCP advisory note(s): packs not installed or legacy-era declarations`,
      remediation:
        "Install declared packs to validate emitted MCP config on disk; upgrade legacy-era spec_era declarations to dual or modern.",
      evidence: {
        warnings,
        ...eraEvidence,
      },
    });
  }
  return createCheckResult({
    id: "dependencies.required_mcp_servers",
    group: "dependencies",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "required MCP server config assets are present",
    evidence: { ...eraEvidence },
  });
}
