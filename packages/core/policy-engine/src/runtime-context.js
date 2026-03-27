function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

const RUNTIME_POLICY_ENFORCEMENT = {
  codex_cli: {
    runtime: "codex_cli",
    primary_enforcement: "pairslash-wrapper",
    hook_support: "none",
    supported_surfaces: [
      "canonical_skill",
      "config",
      "context",
      "direct_invocation",
      "mcp",
      "metadata",
      "support_doc",
    ],
    surface_notes: [
      "PairSlash wrapper/runtime adapter is the primary enforcement boundary for Codex CLI.",
      "Codex CLI is not assumed to provide a native hook enforcement surface.",
      "Direct invocation never overrides /skills as the canonical entrypoint.",
    ],
  },
  copilot_cli: {
    runtime: "copilot_cli",
    primary_enforcement: "pairslash-wrapper-plus-hook-assist",
    hook_support: "advisory",
    supported_surfaces: [
      "agent",
      "canonical_skill",
      "direct_invocation",
      "hook",
      "mcp",
      "metadata",
      "support_doc",
    ],
    surface_notes: [
      "PairSlash wrapper/runtime adapter remains authoritative for Copilot CLI policy enforcement.",
      "Copilot hooks may assist preflight enforcement, but policy must not rely on hooks alone.",
      "Direct invocation never overrides /skills as the canonical entrypoint.",
    ],
  },
};

export function buildRuntimeEnforcementContext(contract) {
  const descriptor = RUNTIME_POLICY_ENFORCEMENT[contract.runtime];
  return {
    runtime: descriptor.runtime,
    primary_enforcement: descriptor.primary_enforcement,
    hook_support: descriptor.hook_support,
    supported_surfaces: uniqueSorted(descriptor.supported_surfaces ?? []),
    surface_notes: uniqueSorted([
      ...(descriptor.surface_notes ?? []),
      ...(contract.runtime_boundary?.differences ?? []),
    ]),
    no_silent_fallback: contract.failure_contract?.no_silent_fallback === true,
  };
}
