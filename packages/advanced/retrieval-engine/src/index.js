import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const RETRIEVAL_CAPABILITY_DEFAULTS = Object.freeze({
  retrieval_enabled: false,
  retrieval_repo_local: true,
  retrieval_artifact_index: false,
  retrieval_external_disabled_by_default: true,
  retrieval_no_authoritative_write: true,
});

export const RETRIEVAL_POLICY_CONTRACT = Object.freeze({
  decisions: {
    "retrieval.query.repo_local": "allow",
    "retrieval.query.artifact_local": "allow",
    "retrieval.query.external": "deny",
    "retrieval.index.build": "require-preview",
    "retrieval.index.refresh": "require-preview",
    "retrieval.memory.promote": "deny",
    "retrieval.hidden_write": "deny",
  },
  no_hidden_write: true,
  no_implicit_promote: true,
  global_memory_precedence: "global-wins-on-conflict",
});

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function listFiles(rootDir) {
  const out = [];
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

function buildPolicy({ sourceKind, capabilities }) {
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

function searchSource({ repoRoot, query, source }) {
  const searchRoot = join(repoRoot, source.path);
  const normalizedQuery = normalizeText(query);
  const results = [];
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

export function runRetrievalQuery({
  repoRoot,
  invocation = "explicit",
  query = "",
  capabilities = {},
  sources = [],
} = {}) {
  const capabilityFlags = {
    ...RETRIEVAL_CAPABILITY_DEFAULTS,
    ...capabilities,
  };
  const sourceReports = [];
  const results = [];
  for (const source of sources) {
    const policy = buildPolicy({
      sourceKind: source.kind,
      capabilities: capabilityFlags,
    });
    const matches =
      policy.overall_verdict === "allow"
        ? searchSource({
            repoRoot,
            query,
            source,
          })
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
    query,
    authoritative: false,
    label: "retrieved",
    truth_tier: "supplemental",
    capability_flags: capabilityFlags,
    source_reports: sourceReports,
    results,
  };
}

export function resolveRetrievedFactAgainstGlobalMemory({
  factKey,
  retrievedValue,
  globalMemoryRecords = [],
} = {}) {
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
