import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { evaluatePolicy } from "@pairslash/policy-engine";

export interface RetrievalCapabilityFlags {
  retrieval_enabled: boolean;
  retrieval_repo_local: boolean;
  retrieval_artifact_index: boolean;
  retrieval_external_disabled_by_default: boolean;
  retrieval_no_authoritative_write: boolean;
}

export const RETRIEVAL_CAPABILITY_DEFAULTS: Readonly<RetrievalCapabilityFlags> = Object.freeze({
  retrieval_enabled: false,
  retrieval_repo_local: true,
  retrieval_artifact_index: false,
  retrieval_external_disabled_by_default: true,
  retrieval_no_authoritative_write: true,
});

export type RetrievalPolicyDecision = "allow" | "deny" | "require-preview";

export const RETRIEVAL_POLICY_CONTRACT = Object.freeze({
  decisions: {
    "retrieval.query.repo_local": "allow",
    "retrieval.query.artifact_local": "allow",
    "retrieval.query.external": "deny",
    "retrieval.index.build": "require-preview",
    "retrieval.index.refresh": "require-preview",
    "retrieval.memory.promote": "deny",
    "retrieval.hidden_write": "deny",
  } satisfies Record<string, RetrievalPolicyDecision>,
  no_hidden_write: true,
  no_implicit_promote: true,
  global_memory_precedence: "global-wins-on-conflict",
});

export type RetrievalSourceKind = "repo_local" | "artifact_local" | "external" | string;

export interface RetrievalSource {
  id: string;
  kind: RetrievalSourceKind;
  path: string;
}

export interface PolicyReason {
  code: string;
  message: string;
}

export interface SourcePolicy {
  overall_verdict: "allow" | "deny" | "require-preview";
  reasons: PolicyReason[];
}

export interface RetrievalResultEnvelope {
  source_id: string;
  source_kind: RetrievalSourceKind;
  path: string;
  label: "retrieved";
  authoritative: false;
  truth_tier: "supplemental";
  snippet: string;
}

export interface SourceReport {
  source_id: string;
  source_kind: RetrievalSourceKind;
  path: string;
  policy: SourcePolicy;
  results_count: number;
}

export interface RetrievalRequest {
  repoRoot: string;
  invocation?: string;
  query?: string;
  capabilities?: Partial<RetrievalCapabilityFlags>;
  sources?: RetrievalSource[];
  runtime?: string;
  target?: string;
  operation?: string;
  apply?: boolean;
  hidden_write_attempted?: boolean;
  implicit_promote_attempted?: boolean;
}

export interface RetrievalReport {
  invocation: string;
  query: string;
  authoritative: false;
  label: "retrieved";
  truth_tier: "supplemental";
  write_shaped: boolean;
  capability_flags: RetrievalCapabilityFlags;
  engine_verdict: unknown | null;
  source_reports: SourceReport[];
  results: RetrievalResultEnvelope[];
}

export interface GlobalMemoryRecord {
  key?: string;
  value?: string;
  [key: string]: unknown;
}

export interface RetrievedFactResolution {
  conflict: boolean;
  winner: "retrieved" | "global_memory";
  effective_value: unknown;
  authoritative_source: "retrieved" | "global_project_memory";
}

const RETRIEVAL_CONTRACT_ID = "pairslash-retrieval-addon";
const CONTRACT_ENVELOPE_SCHEMA_VERSION = "2.0.0";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function listFiles(rootDir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const childPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(childPath));
      continue;
    }
    if (entry.isFile()) {
      out.push(childPath);
    }
  }
  return out;
}

function isWriteShaped(request: RetrievalRequest): boolean {
  const operation = normalizeText(request.operation);
  return (
    request.apply === true ||
    request.hidden_write_attempted === true ||
    request.implicit_promote_attempted === true ||
    operation.includes("write") ||
    operation.includes("promote") ||
    operation.includes("apply") ||
    operation.includes("index.build") ||
    operation.includes("index.refresh")
  );
}

function buildCapabilityPolicy({
  sourceKind,
  capabilities,
}: {
  sourceKind: RetrievalSourceKind;
  capabilities: RetrievalCapabilityFlags;
}): SourcePolicy {
  if (!capabilities.retrieval_enabled) {
    return {
      overall_verdict: "deny",
      reasons: [{ code: "RETRIEVAL-DISABLED", message: "Retrieval is disabled by default." }],
    };
  }
  if (sourceKind === "repo_local" && !capabilities.retrieval_repo_local) {
    return {
      overall_verdict: "deny",
      reasons: [{ code: "RETRIEVAL-REPO-LOCAL-DISABLED", message: "Repo-local retrieval is disabled." }],
    };
  }
  if (sourceKind === "artifact_local" && !capabilities.retrieval_artifact_index) {
    return {
      overall_verdict: "deny",
      reasons: [{ code: "RETRIEVAL-ARTIFACT-INDEX-DISABLED", message: "Artifact retrieval is disabled." }],
    };
  }
  if (sourceKind === "external") {
    return {
      overall_verdict: "deny",
      reasons: [{ code: "RETRIEVAL-EXTERNAL-DENIED", message: "External retrieval remains disabled by policy." }],
    };
  }
  return {
    overall_verdict: "allow",
    reasons: [{ code: "RETRIEVAL-ALLOWED", message: "Retrieval is explicitly enabled for this source." }],
  };
}

function writeShapePolicy(request: RetrievalRequest): PolicyReason[] {
  const reasons: PolicyReason[] = [];
  const operation = normalizeText(request.operation);
  const promoteShaped =
    request.implicit_promote_attempted === true || operation.includes("promote");
  const hiddenWriteShaped =
    request.hidden_write_attempted === true ||
    request.apply === true ||
    operation.includes("write") ||
    operation.includes("apply");
  const indexShaped =
    operation.includes("index.build") || operation.includes("index.refresh");
  if (promoteShaped) {
    reasons.push({
      code: "RETRIEVAL-PROMOTE-DENIED",
      message: `retrieval.memory.promote is ${RETRIEVAL_POLICY_CONTRACT.decisions["retrieval.memory.promote"]}: retrieved facts never auto-promote to Global Project Memory.`,
    });
  }
  if (hiddenWriteShaped) {
    reasons.push({
      code: "RETRIEVAL-HIDDEN-WRITE",
      message: `retrieval.hidden_write is ${RETRIEVAL_POLICY_CONTRACT.decisions["retrieval.hidden_write"]}: this slice has no write path.`,
    });
  }
  if (indexShaped) {
    reasons.push({
      code: "RETRIEVAL-INDEX-REQUIRES-PREVIEW",
      message: `retrieval.index.* decisions are ${RETRIEVAL_POLICY_CONTRACT.decisions["retrieval.index.build"]}: index operations must go through the explicit preview path, not a query.`,
    });
  }
  return reasons;
}

function buildRetrievalContract(runtime: string, target: string): Record<string, unknown> {
  return {
    kind: "contract-envelope",
    schema_version: CONTRACT_ENVELOPE_SCHEMA_VERSION,
    contract_id: RETRIEVAL_CONTRACT_ID,
    runtime,
    target,
    canonical_entrypoint: "/skills",
    workflow_class: "read-oriented",
    risk_level: "low",
    source: { type: "api", pack_id: RETRIEVAL_CONTRACT_ID },
    input_contract: {
      required_fields: ["query"],
      optional_fields: ["sources", "capabilities"],
      accepted_sources: ["cli", "workflow", "api"],
      accepted_modes: ["read"],
      schema_refs: ["packages/core/spec-core/schemas/pack-manifest-v2.schema.yaml@2.2.0"],
      validation_hints: {
        schema_refs: ["packages/core/spec-core/schemas/pack-manifest-v2.schema.yaml@2.2.0"],
        error_codes: ["RETRIEVAL-DISABLED", "RETRIEVAL-HIDDEN-WRITE", "RETRIEVAL-PROMOTE-DENIED"],
        strict_required_fields: true,
        reject_unknown_fields: false,
      },
    },
    output_contract: {
      output_shape: "structured-json",
      structured_sections: [
        { id: "results", label: "retrieved results", required: true, machine_readable: true },
      ],
      machine_readable_fields: ["results", "truth_tier", "authoritative"],
      artifacts: [],
      allowed_side_effects_summary: {
        memory: "read",
        network_allowed: false,
        destructive_allowed: false,
        secret_touching_allowed: false,
        preview_required: false,
        explicit_approval_required: false,
        filesystem_write_paths: [],
      },
    },
    failure_contract: {
      no_silent_fallback: true,
      categories: [
        {
          code: "RETRIEVAL-BLOCKED",
          type: "policy-blocked",
          retryable: false,
          description: "Retrieval request denied by policy.",
        },
      ],
      codes: ["RETRIEVAL-BLOCKED"],
    },
    memory_contract: {
      mode: "read",
      target_scope: "global-project-memory",
      authoritative_write_allowed: false,
      preview_required: false,
      authority_mode: "read-only",
      global_project_memory: "read",
      task_memory: "read",
      session_artifacts: "read",
      explicit_write_only: true,
      no_hidden_write: true,
      read_paths: [".pairslash/project-memory", ".pairslash/task-memory", ".pairslash/sessions"],
      write_paths: [],
      promote_paths: [],
    },
    tool_contract: {
      tools_allowed: [],
      tools_required: [],
      required_mcp_servers: [],
      network_allowance: false,
      destructive_allowance: false,
      secret_touching_allowance: false,
    },
    capability_scope: {
      runtime_scope: "both",
      requested: [],
      granted: [],
      negotiation: [],
      degraded_behavior_notes: [],
    },
    runtime_boundary: {
      adapter: runtime,
      enforcement_mode: "policy-contract",
      differences: [],
    },
  };
}

function evaluateEngineVerdict({
  request,
  runtime,
  target,
}: {
  request: RetrievalRequest;
  runtime: string;
  target: string;
}): unknown {
  const contract = buildRetrievalContract(runtime, target);
  return evaluatePolicy({
    contract,
    request: {
      action: "retrieval.query",
      requested_runtime: runtime,
      requested_target: target,
      apply: request.apply === true,
      preview_requested: false,
      approval: "none",
      hidden_write_attempted: request.hidden_write_attempted === true || request.apply === true,
      implicit_promote_attempted: request.implicit_promote_attempted === true,
      workflow_class: "read-oriented",
      read_only_workflow: true,
    },
  });
}

function searchSource({
  repoRoot,
  query,
  source,
}: {
  repoRoot: string;
  query: string;
  source: RetrievalSource;
}): RetrievalResultEnvelope[] {
  const searchRoot = join(repoRoot, source.path);
  const normalizedQuery = normalizeText(query);
  const results: RetrievalResultEnvelope[] = [];
  for (const filePath of listFiles(searchRoot)) {
    const contents = readFileSync(filePath, "utf8");
    if (!normalizeText(contents).includes(normalizedQuery)) {
      continue;
    }
    results.push({
      source_id: source.id,
      source_kind: source.kind,
      path: filePath,
      label: "retrieved",
      authoritative: false,
      truth_tier: "supplemental",
      snippet: contents.trim().slice(0, 280),
    });
  }
  return results;
}

export function runRetrievalQuery(request: RetrievalRequest): RetrievalReport;
export function runRetrievalQuery({
  repoRoot,
  invocation = "explicit",
  query = "",
  capabilities = {},
  sources = [],
  runtime,
  target,
  operation,
  apply,
  hidden_write_attempted,
  implicit_promote_attempted,
}: RetrievalRequest = {} as RetrievalRequest): RetrievalReport {
  const request: RetrievalRequest = {
    repoRoot,
    invocation,
    query,
    capabilities,
    sources,
    runtime,
    target,
    operation,
    apply,
    hidden_write_attempted,
    implicit_promote_attempted,
  };
  const capabilityFlags: RetrievalCapabilityFlags = {
    ...RETRIEVAL_CAPABILITY_DEFAULTS,
    ...capabilities,
  };
  const writeShaped = isWriteShaped(request);
  const writeReasons = writeShapePolicy(request);
  const engineVerdict =
    runtime !== undefined && target !== undefined
      ? evaluateEngineVerdict({ request, runtime, target })
      : null;
  const engineDenied =
    engineVerdict !== null &&
    typeof engineVerdict === "object" &&
    (engineVerdict as { overall_verdict?: unknown }).overall_verdict === "deny";
  const sourceReports: SourceReport[] = [];
  const results: RetrievalResultEnvelope[] = [];
  for (const source of sources) {
    const policy = buildCapabilityPolicy({
      sourceKind: source.kind,
      capabilities: capabilityFlags,
    });
    if (writeReasons.length > 0) {
      policy.reasons = [...policy.reasons, ...writeReasons];
    }
    if (writeShaped || engineDenied) {
      policy.overall_verdict = "deny";
    }
    const matches =
      policy.overall_verdict === "allow"
        ? searchSource({ repoRoot, query: String(query), source })
        : [];
    sourceReports.push({
      source_id: source.id,
      source_kind: source.kind,
      path: source.path,
      policy,
      results_count: matches.length,
    });
    results.push(...matches);
  }
  return {
    invocation,
    query: String(query),
    authoritative: false,
    label: "retrieved",
    truth_tier: "supplemental",
    write_shaped: writeShaped,
    capability_flags: capabilityFlags,
    engine_verdict: engineVerdict,
    source_reports: sourceReports,
    results,
  };
}

export function resolveRetrievedFactAgainstGlobalMemory({
  factKey,
  retrievedValue,
  globalMemoryRecords = [],
}: {
  factKey?: string;
  retrievedValue?: unknown;
  globalMemoryRecords?: GlobalMemoryRecord[];
} = {}): RetrievedFactResolution {
  const globalMatch = globalMemoryRecords.find((record) => record?.key === factKey) ?? null;
  if (!globalMatch) {
    return {
      conflict: false,
      winner: "retrieved",
      effective_value: retrievedValue,
      authoritative_source: "retrieved",
    };
  }
  const globalValue = globalMatch.value;
  const conflict = normalizeText(globalValue) !== normalizeText(retrievedValue);
  return {
    conflict,
    winner: "global_memory",
    effective_value: globalValue,
    authoritative_source: "global_project_memory",
  };
}
