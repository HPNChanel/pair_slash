function sortStrings(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values ?? []) {
    if (typeof value !== "string" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }
  return output;
}

function normalizeArtifacts(artifacts) {
  const seen = new Set();
  return artifacts
    .map((artifact) => ({
      id: artifact.id,
      when: artifact.when,
      ...(typeof artifact.required === "boolean" ? { required: artifact.required } : {}),
    }))
    .filter((artifact) => {
      if (seen.has(artifact.id)) {
        return false;
      }
      seen.add(artifact.id);
      return true;
    });
}

function normalizeSections(sections) {
  const seen = new Set();
  return sections
    .map((section) => ({
      id: section.id,
      label: section.label,
      required: Boolean(section.required),
      machine_readable: Boolean(section.machine_readable),
    }))
    .filter((section) => {
      if (seen.has(section.id)) {
        return false;
      }
      seen.add(section.id);
      return true;
    });
}

function normalizeNegotiation(negotiation) {
  return negotiation
    .map((entry) => ({
      capability: entry.capability,
      status: entry.status,
      reason: entry.reason ?? null,
    }))
    .sort((left, right) => left.capability.localeCompare(right.capability));
}

function normalizeFailureCategories(categories) {
  return categories
    .map((entry) => ({
      code: entry.code,
      type: entry.type,
      retryable: Boolean(entry.retryable),
      description: entry.description,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

function normalizeToolEntries(tools) {
  return tools
    .map((tool) => ({
      id: tool.id,
      kind: tool.kind,
      check_command: tool.check_command,
      ...(Array.isArray(tool.required_for)
        ? {
            required_for: sortStrings(tool.required_for),
          }
        : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function normalizeContractEnvelopeShape(contract) {
  return {
    ...contract,
    input_contract: {
      ...contract.input_contract,
      required_fields: uniqueStrings(contract.input_contract.required_fields ?? []),
      optional_fields: uniqueStrings(contract.input_contract.optional_fields ?? []),
      accepted_sources: sortStrings(contract.input_contract.accepted_sources ?? []),
      accepted_modes: sortStrings(contract.input_contract.accepted_modes ?? []),
      schema_refs: sortStrings(
        contract.input_contract.schema_refs ??
          contract.input_contract.validation_hints?.schema_refs ??
          [],
      ),
      validation_hints: {
        ...contract.input_contract.validation_hints,
        schema_refs: sortStrings(contract.input_contract.validation_hints?.schema_refs ?? []),
        error_codes: sortStrings(contract.input_contract.validation_hints?.error_codes ?? []),
        strict_required_fields:
          contract.input_contract.validation_hints?.strict_required_fields === true,
        reject_unknown_fields:
          contract.input_contract.validation_hints?.reject_unknown_fields === true,
      },
    },
    output_contract: {
      ...contract.output_contract,
      structured_sections: normalizeSections(contract.output_contract.structured_sections ?? []),
      machine_readable_fields: sortStrings(contract.output_contract.machine_readable_fields ?? []),
      artifacts: normalizeArtifacts(contract.output_contract.artifacts ?? []),
      allowed_side_effects_summary: {
        ...contract.output_contract.allowed_side_effects_summary,
        filesystem_write_paths: sortStrings(
          contract.output_contract.allowed_side_effects_summary?.filesystem_write_paths ?? [],
        ),
      },
    },
    failure_contract: {
      ...contract.failure_contract,
      categories: normalizeFailureCategories(contract.failure_contract.categories ?? []),
      codes: sortStrings(contract.failure_contract.codes ?? []),
    },
    memory_contract: {
      ...contract.memory_contract,
      read_paths: uniqueStrings(contract.memory_contract.read_paths ?? []),
      write_paths: uniqueStrings(contract.memory_contract.write_paths ?? []),
      promote_paths: uniqueStrings(contract.memory_contract.promote_paths ?? []),
    },
    tool_contract: {
      ...contract.tool_contract,
      tools_allowed: sortStrings(contract.tool_contract.tools_allowed ?? []),
      tools_required: normalizeToolEntries(contract.tool_contract.tools_required ?? []),
      required_tools: normalizeToolEntries(
        contract.tool_contract.required_tools ?? contract.tool_contract.tools_required ?? [],
      ),
      required_mcp_servers: sortStrings(contract.tool_contract.required_mcp_servers ?? []),
    },
    capability_scope: {
      ...contract.capability_scope,
      requested: sortStrings(contract.capability_scope.requested ?? []),
      granted: sortStrings(contract.capability_scope.granted ?? []),
      negotiation: normalizeNegotiation(contract.capability_scope.negotiation ?? []),
      degraded_behavior_notes: sortStrings(contract.capability_scope.degraded_behavior_notes ?? []),
    },
    runtime_boundary: {
      ...contract.runtime_boundary,
      differences: sortStrings(contract.runtime_boundary.differences ?? []),
    },
  };
}
