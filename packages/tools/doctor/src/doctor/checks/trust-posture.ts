import {
  createCheckResult,
} from "../helpers.ts";

export function normalizePackTrustReceipt(pack: any) {
  return (
    pack.trust_receipt ?? {
      source_class: "local-source",
      verification_status: "legacy",
      trust_tier: "local-dev",
      policy_action: "allow",
      signature_status: "missing",
      support_level: "local-dev",
      version_policy: {
        status: "legacy",
        blocking: false,
        summary: "legacy install state without trust receipt",
      },
      summary: "legacy install state without trust receipt",
      reasons: ["legacy-state:missing-trust-receipt"],
    }
  );
}

export function describeTrustPosture(receipt: any) {
  if (receipt.verification_status === "legacy") {
    return "legacy install state missing a trust receipt";
  }
  if (receipt.trust_tier === "local-dev") {
    return "local source only; not release-verified";
  }
  if (
    receipt.trust_tier === "verified-external" ||
    receipt.support_level === "publisher-verified" ||
    receipt.source_class === "external-trusted"
  ) {
    return "trusted by local policy only; not PairSlash-maintained support";
  }
  if (receipt.trust_tier === "first-party-official") {
    return "PairSlash first-party release with preview support posture";
  }
  if (receipt.trust_tier === "core-maintained") {
    return "PairSlash core-maintained release";
  }
  return receipt.summary ?? "review trust posture";
}

export function runInstalledTrustPosture(context: any) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "install_state.trust_posture",
      group: "trust",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no installed packs require trust posture verification yet",
      evidence: {},
    });
  }

  const failures = [];
  const warnings = [];
  for (const pack of context.state.packs) {
    const receipt = normalizePackTrustReceipt(pack);
    const summary = {
      pack_id: pack.id,
      source_class: receipt.source_class,
      verification_status: receipt.verification_status,
      trust_tier: receipt.trust_tier ?? "local-dev",
      signature_status: receipt.signature_status ?? "missing",
      support_level: receipt.support_level ?? "local-dev",
      policy_action: receipt.policy_action,
      summary: receipt.summary,
      trust_note: describeTrustPosture(receipt),
    };
    if (receipt.policy_action === "deny" || receipt.source_class === "external-unverified") {
      failures.push({
        ...summary,
        reason: "installed pack is not trusted by the local policy",
      });
      continue;
    }
    if (receipt.version_policy?.blocking) {
      failures.push({
        ...summary,
        reason: receipt.version_policy.summary,
      });
      continue;
    }
    if (
      receipt.verification_status === "legacy" ||
      receipt.policy_action === "ask" ||
      receipt.trust_tier === "local-dev" ||
      receipt.trust_tier === "verified-external" ||
      receipt.trust_tier === "first-party-official" ||
      receipt.support_level === "official-preview" ||
      receipt.support_level === "publisher-verified"
    ) {
      warnings.push(summary);
    }
  }

  if (failures.length > 0) {
    return createCheckResult({
      id: "install_state.trust_posture",
      group: "trust",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${failures.length} installed pack(s) violate the local trust policy`,
      remediation: "Reinstall from a trusted release or remove the untrusted pack before applying more updates.",
      evidence: {
        failures,
      },
      blockingForInstall: true,
    });
  }
  if (warnings.length > 0) {
    return createCheckResult({
      id: "install_state.trust_posture",
      group: "trust",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${warnings.length} installed pack(s) require trust review or carry non-core support posture`,
      remediation:
        "Review `doctor --format json` to identify legacy installs, local-source packs, and local-policy-trusted external packs. Reinstall legacy packs to attach trust receipts, and do not treat local-policy trust as PairSlash support.",
      evidence: {
        warnings,
      },
    });
  }
  return createCheckResult({
    id: "install_state.trust_posture",
    group: "trust",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "installed packs have release-verified trust receipts",
    evidence: {},
  });
}
