import {
  DEFAULT_PUBLIC_COMPATIBILITY_LANES,
  DEFAULT_PUBLIC_KNOWN_ISSUES,
  DEFAULT_PUBLIC_RELEASE_GATES,
  DEFAULT_PUBLIC_SUPPORT_POLICY,
} from "./pack-catalog.js";

// Legacy fallback exports. Operational consumers should prefer repo-scoped
// support data via pack-catalog helpers exported from the top-level spec-core index.
export const PUBLIC_SUPPORT_POLICY = DEFAULT_PUBLIC_SUPPORT_POLICY;
export const PUBLIC_COMPATIBILITY_LANES = DEFAULT_PUBLIC_COMPATIBILITY_LANES;
export const PUBLIC_KNOWN_ISSUES = DEFAULT_PUBLIC_KNOWN_ISSUES;
export const PUBLIC_RELEASE_GATES = DEFAULT_PUBLIC_RELEASE_GATES;
