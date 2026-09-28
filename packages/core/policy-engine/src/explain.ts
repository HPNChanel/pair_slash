function uniqueSorted(values: any): any[] {
  return [...new Set(values.filter(Boolean))].sort((left: any, right: any) => left.localeCompare(right));
}

export function buildPolicyExplanation(verdict: any) {
  const decisiveReasons = verdict.reasons.filter((reason: any) => reason.verdict === verdict.overall_verdict);
  const sources = decisiveReasons.length > 0 ? decisiveReasons : verdict.reasons;
  const decisiveContractFields = uniqueSorted(
    sources.flatMap((reason: any) => reason.contract_fields ?? []),
  );
  const decisiveRuntimeFactors = uniqueSorted(
    sources.flatMap((reason: any) => reason.runtime_factors ?? []),
  );
  const decisiveReasonCodes = uniqueSorted(sources.map((reason: any) => reason.code));
  const summary =
    verdict.overall_verdict === "allow"
      ? "Policy allows the requested operation within the declared contract and runtime boundary."
      : verdict.overall_verdict === "ask"
        ? "Policy requires an explicit user confirmation or approval step before apply can proceed."
        : verdict.overall_verdict === "require-preview"
          ? "Policy blocks apply until a preview has been shown for the risky or authoritative write."
          : "Policy denies the requested operation because it exceeds the declared contract or runtime boundary.";
  return {
    summary,
    decisive_reason_codes: decisiveReasonCodes,
    decisive_contract_fields: decisiveContractFields,
    decisive_runtime_factors: decisiveRuntimeFactors,
    no_silent_fallback: verdict.enforcement_context?.no_silent_fallback === true,
  };
}

export function explainPolicyVerdict(verdict: any) {
  const lines = [
    `Verdict: ${verdict.overall_verdict}`,
    verdict.explanation?.summary ?? "No explanation available.",
  ];
  for (const reason of verdict.reasons) {
    lines.push(`- ${reason.code}: ${reason.message}`);
    if ((reason.contract_fields ?? []).length > 0) {
      lines.push(`  contract: ${reason.contract_fields.join(", ")}`);
    }
    if ((reason.runtime_factors ?? []).length > 0) {
      lines.push(`  runtime: ${reason.runtime_factors.join(", ")}`);
    }
  }
  return lines.join("\n");
}
