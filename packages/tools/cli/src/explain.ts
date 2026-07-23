// PairSlash CLI explain-context / explain-policy artifact builders.
//
// Phase M1 (modernization foundation): extracted from bin/pairslash.js.
// No behavioral change — the existing cli.test.js suite is the contract.

import {
  resolveReadAuthority,
  validateContextExplanation,
  validatePolicyExplanation,
} from "@pairslash/spec-core";
import { buildContractEnvelope, buildMemoryWriteContract } from "@pairslash/contract-engine";
import { evaluatePolicy } from "@pairslash/policy-engine";
import {
  emitTraceEvent,
  resolveTelemetryMode,
  resolveTraceRoot,
} from "@pairslash/trace";
import { runDoctor } from "@pairslash/doctor";

import {
  deriveToolAvailability,
  getRuntimeAdapter,
  resolveSelectedPackRecord,
} from "./internals.ts";

export function buildMemoryReadArtifacts(resolution) {
  const collectLayerPaths = (...layerIds) =>
    (resolution.layers ?? [])
      .filter((layer) => layerIds.includes(layer.layer))
      .flatMap((layer) => layer.resolved_paths ?? [])
      .sort((left, right) => left.localeCompare(right));
  return {
    global_project_memory: collectLayerPaths("global-project-memory"),
    task_memory: collectLayerPaths("task-memory"),
    session_artifacts: collectLayerPaths("session", "staging"),
    session_layer: collectLayerPaths("session"),
    staging_artifacts: collectLayerPaths("staging"),
    audit_log: collectLayerPaths("audit-log"),
  };
}

export function buildContextExplanationArtifact({ repoRoot, options }) {
  const { record } = resolveSelectedPackRecord(repoRoot, options.packs);
  const packId = record?.packId ?? null;
  const report = runDoctor({
    repoRoot,
    runtime: options.runtime,
    target: options.target,
    packs: packId ? [packId] : [],
  });
  const adapter = getRuntimeAdapter(report.runtime);
  const manifest = record?.manifest ?? null;
  const memoryResolution = resolveReadAuthority({
    repoRoot,
    packId,
    manifest,
  });
  const artifact = {
    kind: "context-explanation",
    schema_version: "1.1.0",
    generated_at: new Date().toISOString(),
    runtime: report.runtime,
    target: report.target,
    pack_id: packId,
    manifest_path: record?.manifestPath ?? null,
    canonical_entrypoint: manifest?.canonical_entrypoint ?? "/skills",
    direct_invocation: manifest?.runtime_bindings?.[report.runtime]?.direct_invocation ?? null,
    supported_trigger_surfaces: adapter.listSupportedTriggerSurfaces({ manifest }),
    config_home: report.environment_summary.config_home,
    install_root: report.environment_summary.install_root,
    state_path: report.environment_summary.state_path,
    trace_root: resolveTraceRoot(repoRoot),
    telemetry_mode: resolveTelemetryMode(repoRoot),
    runtime_executable: report.environment_summary.runtime_executable,
    runtime_version: report.environment_summary.runtime_version,
    runtime_available: report.environment_summary.runtime_available,
    cwd: report.environment_summary.cwd,
    repo_root: report.environment_summary.repo_root,
    os: report.environment_summary.os,
    shell: report.environment_summary.shell,
    tool_availability: deriveToolAvailability(report, packId, manifest),
    memory_reads: buildMemoryReadArtifacts(memoryResolution),
    memory_resolution: memoryResolution,
  };
  const validationErrors = validateContextExplanation(artifact);
  if (validationErrors.length > 0) {
    throw new Error(`invalid context explanation :: ${validationErrors.join("; ")}`);
  }
  return artifact;
}

export function buildPolicyExplanationArtifact({ repoRoot, options }) {
  const { record } = resolveSelectedPackRecord(repoRoot, options.packs);
  if (!record) {
    throw new Error("policy-explain-requires-pack: no valid pack manifest found");
  }
  const report = runDoctor({
    repoRoot,
    runtime: options.runtime,
    target: options.target,
    packs: [record.packId],
  });
  const action =
    record.packId === "pairslash-memory-write-global" || record.manifest.workflow_class === "write-authority"
      ? "memory.write-global"
      : "run";
  const contract =
    action === "memory.write-global"
      ? buildMemoryWriteContract({
          manifest: record.manifest,
          runtime: report.runtime,
          target: report.target,
        })
      : buildContractEnvelope({
          manifest: record.manifest,
          runtime: report.runtime,
          target: report.target,
          action,
          sourceType: "workflow",
          sourcePath: record.manifestPath,
        });
  const requiredSurface = options.surface ?? "canonical_skill";
  const verdict = evaluatePolicy({
    contract,
    request: {
      action,
      apply: options.apply,
      preview_requested: options.apply ? options.preview : true,
      requested_runtime: report.runtime,
      requested_target: report.target,
      required_surface: requiredSurface,
      trigger_surface: requiredSurface,
    },
  });
  const artifact = {
    kind: "policy-explanation",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    runtime: report.runtime,
    target: report.target,
    action,
    contract_id: contract.contract_id ?? null,
    overall_verdict: verdict.overall_verdict,
    summary: verdict.explanation?.summary ?? "No policy summary available.",
    decisive_reason_codes: verdict.explanation?.decisive_reason_codes ?? [],
    decisive_contract_fields: verdict.explanation?.decisive_contract_fields ?? [],
    decisive_runtime_factors: verdict.explanation?.decisive_runtime_factors ?? [],
    preview_required: verdict.preview_required,
    approval_required: verdict.approval_required,
    no_silent_fallback: verdict.explanation?.no_silent_fallback === true,
    allowed_operations: verdict.allowed_operations ?? [],
    blocked_operations: verdict.blocked_operations ?? [],
    reasons: verdict.reasons ?? [],
    capability_negotiation: verdict.capability_negotiation ?? [],
    verdict,
  };
  const validationErrors = validatePolicyExplanation(artifact);
  if (validationErrors.length > 0) {
    throw new Error(`invalid policy explanation :: ${validationErrors.join("; ")}`);
  }
  return {
    artifact,
    runtimeProbe: {
      runtime: report.runtime,
      target: report.target,
      executable: report.environment_summary.runtime_executable,
      version: report.environment_summary.runtime_version,
      available: report.environment_summary.runtime_available,
    },
  };
}

export function tryBuildPolicyExplanationArtifact({ repoRoot, options }) {
  try {
    return buildPolicyExplanationArtifact({ repoRoot, options });
  } catch {
    return null;
  }
}

export function emitRuntimeHostProbed(traceContext, probe) {
  emitTraceEvent(traceContext, {
    eventType: "runtime.host_probed",
    outcome: probe.available ? "pass" : "failed",
    runtime: probe.runtime ?? traceContext.runtime,
    target: probe.target ?? traceContext.target,
    failureDomain: probe.available ? "none" : "runtime_host",
    sourcePackage: "@pairslash/cli",
    sourceModule: "bin/pairslash.ts",
    payload: {
      executable: probe.executable ?? null,
      version: probe.version ?? null,
      available: probe.available === true,
    },
    summary: probe.available
      ? `runtime host probe passed for ${probe.runtime}`
      : `runtime host probe failed for ${probe.runtime}`,
  });
}
