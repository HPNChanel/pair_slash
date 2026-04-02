export const RETRIEVAL_CAPABILITY_FLAGS = Object.freeze([
  "retrieval_enabled",
  "retrieval_repo_local",
  "retrieval_artifact_index",
  "retrieval_external_disabled_by_default",
  "retrieval_no_authoritative_write",
]);

export const RETRIEVAL_CAPABILITY_DEFAULTS = Object.freeze({
  retrieval_enabled: false,
  retrieval_repo_local: true,
  retrieval_artifact_index: false,
  retrieval_external_disabled_by_default: true,
  retrieval_no_authoritative_write: true,
});

export function resolveRetrievalCapabilities(input = {}) {
  const resolved = { ...RETRIEVAL_CAPABILITY_DEFAULTS };
  for (const capability of RETRIEVAL_CAPABILITY_FLAGS) {
    if (capability in input) {
      resolved[capability] = Boolean(input[capability]);
    }
  }

  // Retrieval lane must remain non-authoritative even if callers pass false.
  resolved.retrieval_no_authoritative_write = true;
  return resolved;
}
