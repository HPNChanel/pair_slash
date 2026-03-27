import { accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, join, posix } from "node:path";
import process from "node:process";

export const runtime = "codex_cli";
export const shortName = "codex";
export const bundleKind = "codex-skill-bundle";
export const canonicalEntrypoint = "/skills";
export const executable = "codex";
export const supportedInstallSurfaces = [
  "canonical_skill",
  "support_doc",
  "metadata",
  "context",
  "config",
  "mcp",
];
export const supportedTriggerSurfaces = ["canonical_skill", "direct_invocation"];

export const RUNTIME_CODEX_ADAPTER_ERROR_CODES = Object.freeze({
  CONTRACT_REQUIRED: "PRA-CODEX-CONTRACT-001",
  POLICY_REQUIRED: "PRA-CODEX-POLICY-001",
  CONTRACT_BUILD_FAILED: "PRA-CODEX-CONTRACT-002",
  UNSUPPORTED_TRIGGER_SURFACE: "PRA-CODEX-SURFACE-001",
  DIRECT_INVOCATION_UNAVAILABLE: "PRA-CODEX-SURFACE-002",
  POLICY_BLOCKED: "PRA-CODEX-POLICY-002",
  PREVIEW_REQUIRED: "PRA-CODEX-POLICY-003",
  APPROVAL_REQUIRED: "PRA-CODEX-POLICY-004",
});

function uniqueSorted(values) {
  return [...new Set((values ?? []).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function buildBlockingError({
  code,
  message,
  contractFields = [],
  runtimeFactors = [],
  details = null,
}) {
  return {
    code,
    message,
    contract_fields: uniqueSorted(contractFields),
    runtime_factors: uniqueSorted(runtimeFactors),
    details,
  };
}

function getPackId({ manifest, contract }) {
  return contract?.source?.pack_id ?? manifest?.pack_name ?? null;
}

function getCanonicalEntry({ manifest, contract }) {
  return contract?.canonical_entrypoint ?? manifest?.canonical_entrypoint ?? canonicalEntrypoint;
}

function getDirectInvocation({ manifest, contract }) {
  return (
    contract?.direct_invocation ??
    manifest?.runtime_bindings?.[runtime]?.direct_invocation ??
    null
  );
}

function getBindingCompatibility(manifest, surface) {
  const compatibility = manifest?.runtime_bindings?.[runtime]?.compatibility ?? {};
  if (surface === "canonical_skill") {
    return compatibility.canonical_picker ?? "supported";
  }
  if (surface === "direct_invocation") {
    return compatibility.direct_invocation ?? "supported";
  }
  return "blocked";
}

function listSupportedTriggerSurfacesInternal({ manifest = null, contract = null } = {}) {
  const supported = [];
  if (getCanonicalEntry({ manifest, contract }) === canonicalEntrypoint) {
    const status = getBindingCompatibility(manifest, "canonical_skill");
    if (status !== "blocked") {
      supported.push("canonical_skill");
    }
  }
  if (getDirectInvocation({ manifest, contract })) {
    const status = getBindingCompatibility(manifest, "direct_invocation");
    if (status !== "blocked") {
      supported.push("direct_invocation");
    }
  }
  return uniqueSorted(supported);
}

function buildHookAssist() {
  return {
    status: "unsupported",
    mode: "none",
    path: null,
    notes: [
      "Codex CLI does not expose a native hook enforcement surface.",
      "PairSlash wrapper/runtime adapter remains the sole enforcement boundary.",
    ],
  };
}

function normalizeRequestedSurface(request = {}) {
  const surface = request.trigger_surface ?? request.triggerSurface ?? request.required_surface ?? request.requiredSurface;
  return typeof surface === "string" && surface.trim() !== "" ? surface : "canonical_skill";
}

function normalizeExecutionMode(request = {}) {
  return request.apply === true ? "apply" : "preview";
}

function normalizeRequest(request = {}) {
  return {
    ...request,
    requested_surface: normalizeRequestedSurface(request),
    execution_mode: normalizeExecutionMode(request),
    preview_requested:
      request.preview_requested ??
      request.previewRequested ??
      (request.apply === true ? false : true),
    approval: request.approval ?? "none",
    capability_request: request.capability_request ?? request.capabilityRequest ?? [],
    hidden_write_attempted:
      request.hidden_write_attempted ?? request.hiddenWriteAttempted ?? false,
    implicit_promote_attempted:
      request.implicit_promote_attempted ?? request.implicitPromoteAttempted ?? false,
    fallback_attempted:
      request.fallback_attempted ?? request.fallbackAttempted ?? false,
    read_only_workflow: request.read_only_workflow ?? request.readOnlyWorkflow ?? false,
    available_tools: request.available_tools ?? request.availableTools ?? [],
  };
}

function resolveSelectedLaunchPath(requestedSurface, { manifest, contract }) {
  if (requestedSurface === "direct_invocation") {
    return getDirectInvocation({ manifest, contract });
  }
  return getCanonicalEntry({ manifest, contract });
}

function buildExplanation(result) {
  if (result.status === "blocked" && result.blocking_errors.length > 0) {
    return result.blocking_errors.map((entry) => `${entry.code}: ${entry.message}`).join("; ");
  }
  if (typeof result.policy_verdict?.explanation === "string" && result.policy_verdict.explanation.trim() !== "") {
    return result.policy_verdict.explanation;
  }
  return `codex runtime adapter accepted ${result.requested_surface} within PairSlash wrapper enforcement`;
}

function buildResult({
  manifest = null,
  contract = null,
  request,
  policyVerdict = null,
  status,
  blockingErrors = [],
  selectedLaunchPath = null,
  notes = [],
}) {
  const normalizedRequest = normalizeRequest(request);
  const result = {
    kind: "runtime-enforcement-result",
    runtime,
    target: contract?.target ?? null,
    pack_id: getPackId({ manifest, contract }),
    contract_id: contract?.contract_id ?? null,
    canonical_entrypoint: getCanonicalEntry({ manifest, contract }),
    direct_invocation: getDirectInvocation({ manifest, contract }),
    requested_surface: normalizedRequest.requested_surface,
    execution_mode: normalizedRequest.execution_mode,
    selected_launch_path: selectedLaunchPath,
    supported_surfaces: listSupportedTriggerSurfacesInternal({ manifest, contract }),
    policy_verdict: policyVerdict,
    status,
    blocking_errors: blockingErrors,
    no_silent_fallback: true,
    primary_enforcement: "pairslash-wrapper",
    hook_assist: buildHookAssist(),
    notes: uniqueSorted(notes),
  };
  result.explanation = buildExplanation(result);
  return result;
}

function buildPolicyBlockingError(policyVerdict, normalizedRequest) {
  const primaryReason = policyVerdict?.reasons?.[0] ?? {};
  if (normalizedRequest.execution_mode === "preview") {
    return null;
  }
  if (Array.isArray(policyVerdict?.blocked_operations) && policyVerdict.blocked_operations.length === 0) {
    return null;
  }
  if (policyVerdict?.overall_verdict === "require-preview") {
    return buildBlockingError({
      code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.PREVIEW_REQUIRED,
      message: primaryReason.message ?? "preview is required before apply on Codex runtime",
      contractFields: primaryReason.contract_fields ?? [],
      runtimeFactors: [
        ...(primaryReason.runtime_factors ?? []),
        "runtime-surface:codex-wrapper",
      ],
      details: {
        overall_verdict: policyVerdict?.overall_verdict ?? null,
      },
    });
  }
  if (policyVerdict?.overall_verdict === "ask") {
    return buildBlockingError({
      code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.APPROVAL_REQUIRED,
      message: primaryReason.message ?? "explicit approval is required before apply on Codex runtime",
      contractFields: primaryReason.contract_fields ?? [],
      runtimeFactors: [
        ...(primaryReason.runtime_factors ?? []),
        "runtime-surface:codex-wrapper",
      ],
      details: {
        overall_verdict: policyVerdict?.overall_verdict ?? null,
      },
    });
  }
  if (
    policyVerdict?.overall_verdict === "deny" ||
    policyVerdict?.blocked_operations?.includes("apply") ||
    policyVerdict?.blocked_operations?.includes("apply-unconfirmed")
  ) {
    return buildBlockingError({
      code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.POLICY_BLOCKED,
      message: primaryReason.message ?? "policy blocked apply on Codex runtime",
      contractFields: primaryReason.contract_fields ?? [],
      runtimeFactors: [
        ...(primaryReason.runtime_factors ?? []),
        "runtime-surface:codex-wrapper",
      ],
      details: {
        overall_verdict: policyVerdict?.overall_verdict ?? null,
      },
    });
  }
  return null;
}

export function renderDirectInvocation(packId) {
  return `$${packId}`;
}

export function resolveConfigHome({ repoRoot, target }) {
  return target === "repo" ? join(repoRoot, ".agents") : join(homedir(), ".agents");
}

export function resolveInstallRoot(options) {
  return join(resolveConfigHome(options), "skills");
}

export function resolvePackInstallDir(options, packId) {
  return join(resolveInstallRoot(options), packId);
}

export function resolveAssetPath(asset) {
  switch (asset.install_surface) {
    case "canonical_skill":
    case "support_doc":
      return asset.source_relpath ?? asset.file_name;
    case "metadata":
      return posix.join("agents", asset.file_name);
    case "context":
      return posix.join("fragments", "context", asset.file_name);
    case "config":
      return posix.join("fragments", "config", asset.file_name);
    case "mcp":
      return posix.join("fragments", "mcp", asset.file_name);
    default:
      throw new Error(`codex runtime does not support install surface ${asset.install_surface}`);
  }
}

function toPosix(value) {
  return value.split("\\").join("/");
}

export function validateAssetRelativePath(asset, relativePath) {
  const normalizedPath = toPosix(relativePath);
  const expectedPath = resolveAssetPath({
    install_surface: asset.install_surface,
    source_relpath: asset.source_relpath ?? asset.source_path ?? null,
    file_name: asset.file_name ?? basename(normalizedPath),
  });
  if (normalizedPath !== expectedPath) {
    throw new Error(
      `codex runtime path ${normalizedPath} does not match install surface ${asset.install_surface} -> ${expectedPath}`,
    );
  }
  return normalizedPath;
}

export function resolveRuntimeAssetPath(asset) {
  const candidate =
    asset.generated_relpath ??
    asset.generated_path ??
    asset.source_relpath ??
    asset.source_path ??
    asset.file_name;
  if (!candidate) {
    throw new Error("codex runtime asset is missing a relative path");
  }
  return validateAssetRelativePath(asset, candidate);
}

export function supportsInstallSurface(surface) {
  return supportedInstallSurfaces.includes(surface);
}

export function listSupportedTriggerSurfaces(options = {}) {
  return listSupportedTriggerSurfacesInternal(options);
}

export function supportsTriggerSurface(surface, options = {}) {
  return listSupportedTriggerSurfacesInternal(options).includes(surface);
}

export function describeEnforcementBoundary(manifest = null) {
  return [
    "slash-entrypoint:/skills",
    `direct-invocation-prefix:${renderDirectInvocation(manifest?.pack_name ?? "pack-id").slice(0, 1)}`,
    `install-surfaces:${supportedInstallSurfaces.join(",")}`,
    `trigger-surfaces:${supportedTriggerSurfaces.join(",")}`,
    "metadata-surface:agents/openai.yaml",
  ];
}

export function describePolicyEnforcement() {
  return {
    runtime,
    primary_enforcement: "pairslash-wrapper",
    hook_support: "none",
    supported_surfaces: [
      "canonical_skill",
      "config",
      "context",
      "direct_invocation",
      "mcp",
      "metadata",
      "support_doc",
    ],
    surface_notes: [
      "PairSlash wrapper/runtime adapter is the primary enforcement boundary for Codex CLI.",
      "Codex CLI is not assumed to provide a native hook enforcement surface.",
      "Direct invocation never overrides /skills as the canonical entrypoint.",
    ],
  };
}

export function enforceContract({ manifest = null, contract = null, policyVerdict = null, request = {} } = {}) {
  const normalizedRequest = normalizeRequest(request);
  if (!contract || typeof contract !== "object") {
    return buildResult({
      manifest,
      contract,
      request: normalizedRequest,
      policyVerdict,
      status: "blocked",
      blockingErrors: [
        buildBlockingError({
          code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.CONTRACT_REQUIRED,
          message: "runtime enforcement requires a contract envelope",
          runtimeFactors: ["runtime:codex_cli"],
        }),
      ],
    });
  }
  if (!policyVerdict || typeof policyVerdict !== "object") {
    return buildResult({
      manifest,
      contract,
      request: normalizedRequest,
      policyVerdict,
      status: "blocked",
      blockingErrors: [
        buildBlockingError({
          code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.POLICY_REQUIRED,
          message: "runtime enforcement requires a policy verdict",
          runtimeFactors: ["runtime:codex_cli"],
        }),
      ],
    });
  }

  const requestedSurface = normalizedRequest.requested_surface;
  const supportedSurfaces = listSupportedTriggerSurfacesInternal({ manifest, contract });
  if (!supportedSurfaces.includes(requestedSurface)) {
    return buildResult({
      manifest,
      contract,
      request: normalizedRequest,
      policyVerdict,
      status: "blocked",
      blockingErrors: [
        buildBlockingError({
          code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.UNSUPPORTED_TRIGGER_SURFACE,
          message: `surface ${requestedSurface} is unsupported on Codex runtime; no silent fallback is allowed`,
          contractFields: ["canonical_entrypoint", "direct_invocation", "runtime_boundary.differences"],
          runtimeFactors: [
            `requested_surface:${requestedSurface}`,
            `supported_surfaces:${supportedSurfaces.join(",") || "none"}`,
          ],
          details: {
            compatibility: getBindingCompatibility(manifest, requestedSurface),
          },
        }),
      ],
      notes: ["Codex enforcement remains wrapper-only; unsupported surfaces are blocked explicitly."],
    });
  }

  const selectedLaunchPath = resolveSelectedLaunchPath(requestedSurface, { manifest, contract });
  if (requestedSurface === "direct_invocation" && !selectedLaunchPath) {
    return buildResult({
      manifest,
      contract,
      request: normalizedRequest,
      policyVerdict,
      status: "blocked",
      blockingErrors: [
        buildBlockingError({
          code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.DIRECT_INVOCATION_UNAVAILABLE,
          message: "direct invocation was requested but the Codex runtime binding does not provide one",
          contractFields: ["direct_invocation"],
          runtimeFactors: ["requested_surface:direct_invocation"],
        }),
      ],
    });
  }

  const policyError = buildPolicyBlockingError(policyVerdict, normalizedRequest);
  if (policyError) {
    return buildResult({
      manifest,
      contract,
      request: normalizedRequest,
      policyVerdict,
      status: "blocked",
      blockingErrors: [policyError],
    });
  }

  return buildResult({
    manifest,
    contract,
    request: normalizedRequest,
    policyVerdict,
    status: "allow",
    selectedLaunchPath,
    notes: ["Canonical /skills entrypoint remains authoritative for Codex workflows."],
  });
}

export async function enforceWorkflow({
  manifest,
  runtime: requestedRuntime = runtime,
  target = "repo",
  action = "run",
  request = {},
} = {}) {
  const normalizedRequest = normalizeRequest(request);
  const [{ buildContractEnvelope, buildMemoryWriteContract }, { evaluatePolicy }] = await Promise.all([
    import("@pairslash/contract-engine"),
    import("@pairslash/policy-engine"),
  ]);

  let contract;
  try {
    contract =
      manifest?.workflow_class === "write-authority" || manifest?.pack_name === "pairslash-memory-write-global"
        ? buildMemoryWriteContract({ manifest, runtime: requestedRuntime, target })
        : buildContractEnvelope({
            manifest,
            runtime: requestedRuntime,
            target,
            action,
            sourceType: "workflow",
          });
  } catch (error) {
    return buildResult({
      manifest,
      contract: null,
      request: normalizedRequest,
      policyVerdict: null,
      status: "blocked",
      blockingErrors: [
        buildBlockingError({
          code: RUNTIME_CODEX_ADAPTER_ERROR_CODES.CONTRACT_BUILD_FAILED,
          message: `unable to build Codex runtime contract :: ${error.code ? `${error.code}: ` : ""}${error.message}`,
          runtimeFactors: [
            `runtime:${requestedRuntime}`,
            `target:${target}`,
            `requested_surface:${normalizedRequest.requested_surface}`,
          ],
          details: {
            source_error_code: error.code ?? null,
          },
        }),
      ],
      notes: ["The runtime lane was blocked explicitly; PairSlash did not reroute execution to another surface."],
    });
  }

  const policyVerdict = evaluatePolicy({
    contract,
    request: {
      ...normalizedRequest,
      action,
      apply: normalizedRequest.execution_mode === "apply",
      preview_requested: normalizedRequest.preview_requested,
      requested_runtime: requestedRuntime,
      requested_target: target,
      required_surface: normalizedRequest.requested_surface,
      trigger_surface: normalizedRequest.requested_surface,
    },
  });
  return enforceContract({
    manifest,
    contract,
    policyVerdict,
    request: normalizedRequest,
  });
}

function spawnRuntime(args) {
  const options = { encoding: "utf8" };
  const direct = spawnSync(executable, args, options);
  if (
    process.platform !== "win32" ||
    !["ENOENT", "EINVAL"].includes(direct.error?.code ?? "")
  ) {
    return direct;
  }
  return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", executable, ...args], options);
}

function extractSemver(rawValue) {
  const match = typeof rawValue === "string" ? rawValue.match(/(\d+\.\d+\.\d+)/) : null;
  return match?.[1] ?? null;
}

export function detectRuntime() {
  const result = spawnRuntime(["--version"]);
  const rawVersion = result.stdout?.trim() || result.stderr?.trim() || "";
  const version = extractSemver(rawVersion) || rawVersion || "unknown";
  if (result.status === 0) {
    return {
      available: true,
      executable,
      version,
    };
  }
  return {
    available: false,
    executable,
    version: null,
    error: result.error?.message || result.stderr?.trim() || "codex not found",
  };
}

export function checkWritablePath(path) {
  try {
    accessSync(path, constants.W_OK);
    return { writable: true };
  } catch (error) {
    return { writable: false, error: error.message };
  }
}
