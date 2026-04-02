export const CI_CAPABILITY_FLAGS = Object.freeze([
  "ci_lane_enabled",
  "ci_plan_only",
  "ci_generate_patch_artifact",
  "ci_no_direct_memory_write",
  "ci_no_direct_repo_commit_default",
  "ci_requires_explicit_repo_policy",
]);

export const CI_CAPABILITY_DEFAULTS = Object.freeze({
  ci_lane_enabled: false,
  ci_plan_only: true,
  ci_generate_patch_artifact: false,
  ci_no_direct_memory_write: true,
  ci_no_direct_repo_commit_default: true,
  ci_requires_explicit_repo_policy: true,
});

export function resolveCiCapabilities(input = {}) {
  const resolved = { ...CI_CAPABILITY_DEFAULTS };
  for (const capability of CI_CAPABILITY_FLAGS) {
    if (capability in input) {
      resolved[capability] = Boolean(input[capability]);
    }
  }

  // Phase 11 CI lane invariants: no direct memory writes and no direct commit by default.
  resolved.ci_no_direct_memory_write = true;
  resolved.ci_no_direct_repo_commit_default = true;
  resolved.ci_requires_explicit_repo_policy = true;

  return resolved;
}
