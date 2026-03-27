function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function addRisk(risks, category, sources, rationale) {
  const existing = risks.get(category);
  if (existing) {
    existing.sources = uniqueSorted([...existing.sources, ...sources]);
    return;
  }
  risks.set(category, {
    category,
    present: true,
    sources: uniqueSorted(sources),
    rationale,
  });
}

function hasGrantedCapability(contract, capability) {
  return contract.capability_scope?.granted?.includes(capability) || false;
}

export function deriveRiskProfile(contract, request = {}) {
  const risks = new Map();
  const sideEffects = contract.output_contract?.allowed_side_effects_summary ?? {};
  const memoryContract = contract.memory_contract ?? {};
  const toolContract = contract.tool_contract ?? {};
  const action = String(request.action ?? "");
  const destructiveRequested =
    request.destructive_requested === true ||
    /(^|[.:-])(delete|destroy|remove|uninstall)([.:-]|$)/.test(action);

  if (
    toolContract.network_allowance === true ||
    sideEffects.network_allowed === true ||
    hasGrantedCapability(contract, "mcp_client")
  ) {
    addRisk(
      risks,
      "networked",
      [
        "tool_contract.network_allowance",
        "output_contract.allowed_side_effects_summary.network_allowed",
        "capability_scope.granted",
      ],
      "The workflow can cross a network or MCP boundary.",
    );
  }

  if (
    toolContract.secret_touching_allowance === true ||
    sideEffects.secret_touching_allowed === true
  ) {
    addRisk(
      risks,
      "secret-touching",
      [
        "tool_contract.secret_touching_allowance",
        "output_contract.allowed_side_effects_summary.secret_touching_allowed",
      ],
      "The workflow may touch secrets or secret-bearing environment state.",
    );
  }

  if (sideEffects.destructive_allowed === true || destructiveRequested) {
    addRisk(
      risks,
      "destructive",
      uniqueSorted(
        [
          sideEffects.destructive_allowed === true
            ? "output_contract.allowed_side_effects_summary.destructive_allowed"
            : null,
          destructiveRequested ? "request.destructive_requested" : null,
        ],
      ),
      "The workflow can remove or replace state in a non-trivial way.",
    );
  }

  if (
    memoryContract.authoritative_write_allowed === true ||
    memoryContract.mode === "write" ||
    sideEffects.memory === "write" ||
    hasGrantedCapability(contract, "repo_write") ||
    hasGrantedCapability(contract, "memory_write_global")
  ) {
    addRisk(
      risks,
      "repo-write",
      [
        "memory_contract.authoritative_write_allowed",
        "memory_contract.mode",
        "output_contract.allowed_side_effects_summary.memory",
        "capability_scope.granted",
      ],
      "The workflow can mutate repository or authoritative project state.",
    );
  } else if (
    request.local_write_requested === true ||
    (Array.isArray(sideEffects.filesystem_write_paths) && sideEffects.filesystem_write_paths.length > 0)
  ) {
    addRisk(
      risks,
      "local-write",
      uniqueSorted(
        [
          request.local_write_requested === true ? "request.local_write_requested" : null,
          sideEffects.filesystem_write_paths?.length > 0
            ? "output_contract.allowed_side_effects_summary.filesystem_write_paths"
            : null,
        ],
      ),
      "The workflow can write locally without crossing into authoritative repo-write mode.",
    );
  }

  if (risks.size === 0) {
    addRisk(
      risks,
      "read-only",
      [
        "memory_contract.mode",
        "output_contract.allowed_side_effects_summary.memory",
      ],
      "The workflow remains within read-only boundaries.",
    );
  }

  return [
    "read-only",
    "local-write",
    "repo-write",
    "destructive",
    "networked",
    "secret-touching",
  ]
    .map((category) => risks.get(category))
    .filter(Boolean);
}

export function hasRisk(evaluatedRisks, category) {
  return evaluatedRisks.some((entry) => entry.category === category);
}
