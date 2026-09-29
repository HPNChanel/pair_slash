import {
  dedupeRemediationActions,
  planInstall,
  planUpdate,
} from "@pairslash/installer";
import {
  REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE,
  createCheckResult,
} from "../helpers.ts";

export function runUpdatePreviewRisk(context: any) {
  if (!context.state || context.state.packs.length === 0) {
    return createCheckResult({
      id: "install_state.update_preview_risk",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "no installed packs require update-risk analysis yet",
      evidence: {},
    });
  }

  try {
    const envelope = planUpdate({
      repoRoot: context.repoRoot,
      runtime: context.runtime,
      target: context.target,
      packs: context.state.packs.map((pack: any) => pack.id),
    });
    const blocked = envelope.plan.operations.filter((operation: any) => operation.kind === "blocked_conflict");
    const preserved = envelope.plan.operations.filter((operation: any) =>
      ["preserve_override", "reconcile_unmanaged"].includes(operation.kind),
    );
    if (envelope.plan.errors.length > 0 || blocked.length > 0) {
      return createCheckResult({
        id: "install_state.update_preview_risk",
        group: "install_state",
        status: "fail",
        runtime: context.runtime,
        target: context.target,
        inputs: {},
        summary: "update preview found blocking conflicts or plan errors for the installed footprint",
        remediation: "Run `pairslash update --preview` and resolve blocked conflicts before applying changes.",
        evidence: {
          errors: envelope.plan.errors,
          blocked_conflicts: blocked.map((operation: any) => ({
            pack_id: operation.pack_id,
            relative_path: operation.relative_path,
            reason: operation.reason,
            reason_code: operation.reason_code ?? null,
          })),
        },
        blockingForInstall: true,
        reasonCodes: blocked.map((operation: any) => operation.reason_code),
        remediationActions: dedupeRemediationActions(
          blocked.flatMap((operation: any) => operation.remediation_actions ?? []),
        ),
      });
    }
    if (preserved.length > 0) {
      return createCheckResult({
        id: "install_state.update_preview_risk",
        group: "install_state",
        status: "degraded",
        runtime: context.runtime,
        target: context.target,
        inputs: {},
        summary: `${preserved.length} local override path(s) would be preserved during update`,
        remediation: "Review preserved overrides with `pairslash update --preview` before updating the pack.",
        evidence: {
          preserved_overrides: preserved.map((operation: any) => ({
            pack_id: operation.pack_id,
            relative_path: operation.relative_path,
            reason: operation.reason,
            reason_code: operation.reason_code ?? null,
            kind: operation.kind,
            management_mode: operation.management_mode ?? null,
            reconcile_mode: operation.reconcile_mode ?? null,
          })),
        },
        reasonCodes: preserved.map((operation: any) => operation.reason_code),
        remediationActions: dedupeRemediationActions(
          preserved.flatMap((operation: any) => operation.remediation_actions ?? []),
        ),
      });
    }
  } catch (error) {
    return createCheckResult({
      id: "install_state.update_preview_risk",
      group: "install_state",
      status: "warn",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "update-risk analysis could not be completed from the current install state",
      remediation: "Rerun `pairslash update --preview` directly after fixing state or manifest issues.",
      evidence: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return createCheckResult({
    id: "install_state.update_preview_risk",
    group: "install_state",
    status: "pass",
    runtime: context.runtime,
    target: context.target,
    inputs: {},
    summary: "update preview reports no override-preservation or conflict risk",
    evidence: {},
  });
}

export function runInstallPreviewParity(context: any) {
  if (context.requestedPacks.length === 0) {
    return createCheckResult({
      id: "install_state.install_preview_parity",
      group: "install_state",
      status: "skip",
      runtime: context.runtime,
      target: context.target,
      inputs: {},
      summary: "skipped because doctor was not scoped to explicit pack install intent",
      evidence: {},
    });
  }

  const installedRequestedPacks = context.requestedPacks.filter((packId: any) =>
    (context.state?.packs ?? []).some((pack: any) => pack.id === packId),
  );
  if (installedRequestedPacks.length === 0) {
    return createCheckResult({
      id: "install_state.install_preview_parity",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        requested_packs: context.requestedPacks,
      },
      summary: "requested packs are not already PairSlash-managed for this runtime and target",
      evidence: {},
    });
  }

  const preview = planInstall({
    repoRoot: context.repoRoot,
    runtime: context.runtime,
    target: context.target,
    packs: installedRequestedPacks,
  });
  const redirects = preview.plan.operations.filter(
    (operation: any) => operation.reason_code === REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE,
  );
  if (redirects.length === 0) {
    return createCheckResult({
      id: "install_state.install_preview_parity",
      group: "install_state",
      status: "pass",
      runtime: context.runtime,
      target: context.target,
      inputs: {
        requested_packs: context.requestedPacks,
      },
      summary: "requested packs do not require install-to-update redirection",
      evidence: {},
    });
  }

  return createCheckResult({
    id: "install_state.install_preview_parity",
    group: "install_state",
    status: "fail",
    runtime: context.runtime,
    target: context.target,
    inputs: {
      requested_packs: context.requestedPacks,
    },
    summary: `${redirects.length} requested pack(s) are already managed; install preview redirects to update`,
    remediation: "Run `pairslash update --preview` for those packs instead of reinstalling them.",
    evidence: {
      redirects: redirects.map((operation: any) => ({
        pack_id: operation.pack_id,
        relative_path: operation.relative_path,
        reason: operation.reason,
        reason_code: operation.reason_code ?? null,
      })),
    },
    blockingForInstall: true,
    reasonCodes: [REASON_CODE_MANAGED_PACK_REQUIRES_UPDATE],
    remediationActions: dedupeRemediationActions(
      redirects.flatMap((operation: any) => operation.remediation_actions ?? []),
    ),
  });
}
