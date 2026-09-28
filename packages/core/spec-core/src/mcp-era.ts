import { MCP_SPEC_ERAS } from "./constants.ts";

type McpSpecEra = (typeof MCP_SPEC_ERAS)[number];

const MCP_ERA_EXPECTATIONS: Record<McpSpecEra, Record<string, unknown>> = {
  legacy: {
    protocol_revision: "2025-11-25",
    initialize_handshake: "expected",
    stateless_requests: "not-required",
    required_http_headers: [],
    discover_rpc: null,
    deprecation_note:
      "legacy-era server; confirm it has not deprecated the 2025-11-25 semantics before relying on it",
  },
  modern: {
    protocol_revision: "2026-07-28",
    initialize_handshake: "not-assumed",
    stateless_requests: "required",
    required_http_headers: ["Mcp-Method", "Mcp-Name"],
    discover_rpc: "server/discover",
    per_request_meta: "io.modelcontextprotocol/protocolVersion",
    auth_model: "oauth-oidc-aligned",
    deprecation_policy: "formal",
  },
  dual: {
    protocol_revision: "dual",
    initialize_handshake: "tolerated",
    stateless_requests: "preferred",
    required_http_headers: ["Mcp-Method", "Mcp-Name"],
    discover_rpc: "server/discover",
    guidance:
      "expect the server to answer modern-era requests; fall back to legacy initialize semantics only if server/discover is unavailable",
  },
};

export function describeMcpSpecEra(era: string) {
  return MCP_ERA_EXPECTATIONS[(era as McpSpecEra) in MCP_ERA_EXPECTATIONS ? (era as McpSpecEra) : "dual"];
}

export function buildMcpServerDescriptors(requiredMcpServers: unknown) {
  if (!Array.isArray(requiredMcpServers)) {
    return [];
  }
  const descriptors = requiredMcpServers
    .filter(
      (entry): entry is { id: string; spec_era?: string } =>
        Boolean(entry) && typeof entry === "object" && typeof entry.id === "string",
    )
    .map((entry) => {
      const era = MCP_SPEC_ERAS.includes(entry.spec_era as McpSpecEra)
        ? (entry.spec_era as McpSpecEra)
        : "dual";
      return {
        id: entry.id,
        spec_era: era,
        expectations: describeMcpSpecEra(era),
      };
    });
  return descriptors.sort((left, right) => left.id.localeCompare(right.id));
}
