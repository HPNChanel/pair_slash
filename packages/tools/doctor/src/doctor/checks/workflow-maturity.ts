import {
  createCheckResult,
} from "../helpers.ts";
import {
  buildWorkflowMaturitySummary,
} from "../report.ts";

export function runWorkflowMaturityAlignment(context) {
  const summary = buildWorkflowMaturitySummary(context);
  if (summary.selected_pack_count === 0) {
    return createCheckResult({
      id: "manifest.workflow_maturity_alignment",
      group: "trust",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no selected core manifests available for workflow maturity evaluation",
      evidence: {
        workflow_maturity: summary,
      },
    });
  }

  const illegalTransitions = summary.selected_packs.filter((pack) => pack.workflow_transition_legal === false);
  if (illegalTransitions.length > 0) {
    return createCheckResult({
      id: "manifest.workflow_maturity_alignment",
      group: "trust",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${illegalTransitions.length} workflow maturity transition(s) are illegal`,
      remediation:
        "Fix support.workflow_transition and support.workflow_maturity in the affected manifests before promoting workflow claims.",
      evidence: {
        workflow_maturity: summary,
        illegal_transitions: illegalTransitions.map((pack) => ({
          pack_id: pack.pack_id,
          workflow_maturity: pack.workflow_maturity,
          effective_workflow_maturity: pack.effective_workflow_maturity,
        })),
      },
    });
  }

  const contradictoryClaims = summary.selected_packs.filter((pack) => pack.demoted);
  if (contradictoryClaims.length > 0) {
    return createCheckResult({
      id: "manifest.workflow_maturity_alignment",
      group: "trust",
      status: "fail",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${contradictoryClaims.length} workflow maturity claim(s) outrun evidence-backed effective maturity`,
      remediation:
        "Demote support.workflow_maturity or add the missing runtime, checklist, and release evidence before using stronger labels.",
      evidence: {
        workflow_maturity: summary,
        contradictory_claims: contradictoryClaims.map((pack) => ({
          pack_id: pack.pack_id,
          workflow_maturity: pack.workflow_maturity,
          effective_workflow_maturity: pack.effective_workflow_maturity,
          blockers: pack.workflow_maturity_blockers,
        })),
      },
    });
  }

  const blockedPacks = summary.selected_packs.filter(
    (pack) => pack.workflow_maturity_blocked || pack.workflow_maturity_blockers.length > 0,
  );
  if (blockedPacks.length > 0) {
    return createCheckResult({
      id: "manifest.workflow_maturity_alignment",
      group: "trust",
      status: "degraded",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: `${blockedPacks.length} workflow maturity label(s) are capped by active demotion blockers`,
      remediation:
        "Keep public wording at effective workflow maturity until blocker evidence is resolved and revalidated.",
      evidence: {
        workflow_maturity: summary,
        blocked_packs: blockedPacks.map((pack) => ({
          pack_id: pack.pack_id,
          blockers: pack.workflow_maturity_blockers,
          demotion_triggers_active: pack.workflow_demotion_triggers_active,
        })),
      },
    });
  }

  return createCheckResult({
    id: "manifest.workflow_maturity_alignment",
    group: "trust",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: `${summary.selected_pack_count} workflow maturity label(s) align with current evidence-backed effective maturity`,
    evidence: {
      workflow_maturity: summary,
    },
  });
}
