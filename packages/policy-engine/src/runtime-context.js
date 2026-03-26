import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function getAdapter(runtime) {
  return runtime === "codex_cli" ? codexAdapter : copilotAdapter;
}

export function buildRuntimeEnforcementContext(contract) {
  const adapter = getAdapter(contract.runtime);
  const descriptor = adapter.describePolicyEnforcement();
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
