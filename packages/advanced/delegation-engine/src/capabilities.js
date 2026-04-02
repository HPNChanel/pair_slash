export const DELEGATION_CAPABILITY_FLAGS = Object.freeze([
  "delegation_lane_enabled",
  "delegation_read_only_workers",
  "delegation_analysis_workers",
  "delegation_patch_proposal_workers",
  "delegation_write_candidate_workers",
  "delegation_no_chain_spawning",
  "delegation_no_global_memory_write",
  "delegation_no_new_front_door",
]);

export const DELEGATION_CAPABILITY_DEFAULTS = Object.freeze({
  delegation_lane_enabled: false,
  delegation_read_only_workers: true,
  delegation_analysis_workers: true,
  delegation_patch_proposal_workers: false,
  delegation_write_candidate_workers: false,
  delegation_no_chain_spawning: true,
  delegation_no_global_memory_write: true,
  delegation_no_new_front_door: true,
});

export function resolveDelegationCapabilities(input = {}) {
  const resolved = { ...DELEGATION_CAPABILITY_DEFAULTS };
  for (const capability of DELEGATION_CAPABILITY_FLAGS) {
    if (capability in input) {
      resolved[capability] = Boolean(input[capability]);
    }
  }

  // Delegation lane invariants for the first slice.
  resolved.delegation_no_chain_spawning = true;
  resolved.delegation_no_global_memory_write = true;
  resolved.delegation_no_new_front_door = true;

  return resolved;
}
