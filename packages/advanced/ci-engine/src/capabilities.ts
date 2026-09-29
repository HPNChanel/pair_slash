export interface CiCapabilityFlags {
  ci_lane_enabled: boolean;
  ci_plan_only: boolean;
  ci_generate_patch_artifact: boolean;
  ci_no_direct_memory_write: boolean;
  ci_no_direct_repo_commit_default: boolean;
  ci_requires_explicit_repo_policy: boolean;
}

export const CI_CAPABILITY_FLAGS: readonly string[] = Object.freeze([
  "ci_lane_enabled",
  "ci_plan_only",
  "ci_generate_patch_artifact",
  "ci_no_direct_memory_write",
  "ci_no_direct_repo_commit_default",
  "ci_requires_explicit_repo_policy",
]);

export const CI_CAPABILITY_DEFAULTS: Readonly<CiCapabilityFlags> = Object.freeze({
  ci_lane_enabled: false,
  ci_plan_only: true,
  ci_generate_patch_artifact: false,
  ci_no_direct_memory_write: true,
  ci_no_direct_repo_commit_default: true,
  ci_requires_explicit_repo_policy: true,
});

export function resolveCiCapabilities(
  input: Partial<CiCapabilityFlags> = {},
): CiCapabilityFlags {
  const resolved = { ...CI_CAPABILITY_DEFAULTS };
  for (const capability of CI_CAPABILITY_FLAGS) {
    if (capability in input) {
      resolved[capability as keyof CiCapabilityFlags] = Boolean(
        input[capability as keyof CiCapabilityFlags],
      );
    }
  }

  // Phase 11 CI lane invariants: no direct memory writes and no direct commit by default.
  resolved.ci_no_direct_memory_write = true;
  resolved.ci_no_direct_repo_commit_default = true;
  resolved.ci_requires_explicit_repo_policy = true;

  return resolved;
}
