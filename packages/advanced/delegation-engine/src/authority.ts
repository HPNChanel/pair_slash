import { CAPABILITY_FLAGS, loadPackTrustAuthority } from "@pairslash/spec-core";

export const HIGH_RISK_CAPABILITY_NAMES = Object.freeze([
  "memory_write_global",
  "repo_write",
  "shell_exec",
  "test_exec",
  "mcp_client",
]);

export const WRITE_AUTHORITY_ROUTE = "pairslash-memory-write-global";

export interface PackAuthorityCapabilityGrant {
  allowed_packs: string[];
}

export interface PackAuthoritySnapshot {
  core_maintained_packs: string[];
  high_risk_capabilities: Record<string, PackAuthorityCapabilityGrant>;
}

export interface AuthorityReason {
  code: string;
  verdict: "deny";
  message: string;
}

const CANONICAL_CAPABILITY_NAMES: readonly string[] = CAPABILITY_FLAGS;

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(
    values.filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .map((value) => value.trim()),
  )].sort((left, right) => left.localeCompare(right));
}

export function loadDelegationPackAuthority(repoRoot: string): PackAuthoritySnapshot {
  const authority = loadPackTrustAuthority(repoRoot);
  const grants: Record<string, PackAuthorityCapabilityGrant> = {};
  const source = authority?.high_risk_capabilities ?? {};
  for (const capability of HIGH_RISK_CAPABILITY_NAMES) {
    grants[capability] = {
      allowed_packs: normalizeList(source[capability]?.allowed_packs),
    };
  }
  return {
    core_maintained_packs: normalizeList(authority?.core_maintained_packs),
    high_risk_capabilities: grants,
  };
}

export function evaluateAuthoritySubset({
  callerPackId = null,
  callerCapabilities = [],
  delegatedCapabilities = [],
  packAuthority = null,
}: {
  callerPackId?: string | null;
  callerCapabilities?: unknown;
  delegatedCapabilities?: unknown;
  packAuthority?: PackAuthoritySnapshot | null;
} = {}): AuthorityReason[] {
  const reasons: AuthorityReason[] = [];
  const delegated = normalizeList(delegatedCapabilities);
  const caller = normalizeList(callerCapabilities);

  const unknown = delegated.filter(
    (capability) => !CANONICAL_CAPABILITY_NAMES.includes(capability),
  );
  if (unknown.length > 0) {
    reasons.push({
      code: "DELEGATION-CAPABILITY-UNKNOWN",
      verdict: "deny",
      message: `delegated capabilities are outside the canonical taxonomy: ${unknown.join(", ")}`,
    });
  }

  for (const capability of delegated) {
    if (!caller.includes(capability)) {
      reasons.push({
        code: "DELEGATION-CAPABILITY-ESCALATION-DENIED",
        verdict: "deny",
        message: `delegated capability exceeds caller authority: ${capability}`,
      });
    }
  }

  const highRisk = delegated.filter((capability) =>
    HIGH_RISK_CAPABILITY_NAMES.includes(capability));
  if (highRisk.length === 0) {
    return reasons;
  }

  if (highRisk.includes("memory_write_global")) {
    reasons.push({
      code: "DELEGATION-GLOBAL-MEMORY-CAPABILITY-DENIED",
      verdict: "deny",
      message: `memory_write_global may never be delegated; route durable writes through ${WRITE_AUTHORITY_ROUTE}`,
    });
  }

  if (packAuthority === null) {
    reasons.push({
      code: "DELEGATION-AUTHORITY-SOURCE-REQUIRED",
      verdict: "deny",
      message: "high-risk capability delegation requires the pack-authority snapshot",
    });
    return reasons;
  }

  if (typeof callerPackId !== "string" || callerPackId.trim() === "") {
    reasons.push({
      code: "DELEGATION-AUTHORITY-CALLER-REQUIRED",
      verdict: "deny",
      message: "high-risk capability delegation requires the caller pack id",
    });
    return reasons;
  }

  for (const capability of highRisk) {
    const grant = packAuthority.high_risk_capabilities[capability];
    const allowedPacks = grant ? grant.allowed_packs : [];
    if (!allowedPacks.includes(callerPackId)) {
      reasons.push({
        code: "DELEGATION-HIGH-RISK-CAPABILITY-DENIED",
        verdict: "deny",
        message: `caller pack ${callerPackId} is not authorized to hold ${capability}`,
      });
    }
  }

  return reasons;
}
