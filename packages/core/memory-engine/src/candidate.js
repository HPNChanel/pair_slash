import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import YAML from "yaml";

import {
  CANDIDATE_REPORT_SCHEMA_VERSION,
  resolveReadAuthority,
  validateCandidateReport,
} from "@pairslash/spec-core";

const SOURCE_LAYERS = ["task-memory", "session", "staging"];
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);
const VALID_KINDS = new Set([
  "decision",
  "command",
  "glossary",
  "constraint",
  "ownership",
  "incident-lesson",
  "pattern",
]);
const RECORD_EXTENSIONS = new Set([".yaml", ".yml"]);
const ROOT_FILES = {
  command: "20-commands.yaml",
  glossary: "30-glossary.yaml",
  ownership: "40-ownership.yaml",
  constraint: "50-constraints.yaml",
};
const DIRECTORY_FILES = {
  decision: "60-architecture-decisions",
  pattern: "70-known-good-patterns",
  "incident-lesson": "80-incidents-and-lessons",
};

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function candidateId(seed) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

function parseYamlDocuments(path) {
  return YAML.parseAllDocuments(readFileSync(path, "utf8"))
    .map((document) => document.toJSON())
    .filter(Boolean);
}

function buildClaimKey(record) {
  return [
    normalizeText(record.kind),
    normalizeText(record.title),
    normalizeText(record.scope),
    normalizeText(record.scope_detail),
  ].join("|");
}

function routeTargetFile(record) {
  if (DIRECTORY_FILES[record.kind]) {
    return `${DIRECTORY_FILES[record.kind]}/${slugify(record.title)}.yaml`;
  }
  return ROOT_FILES[record.kind] ?? "90-memory-index.yaml";
}

function normalizeEvidence(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const unique = new Set();
  const out = [];
  for (const entry of values) {
    const normalized = String(entry ?? "").trim();
    if (!normalized || unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    out.push(normalized);
  }
  return out;
}

function coerceLayerRecord(layerId, rawRecord) {
  if (!rawRecord || typeof rawRecord !== "object") {
    return null;
  }
  if (
    layerId === "staging" &&
    rawRecord.kind === "memory-write-staging-artifact" &&
    rawRecord.request?.record &&
    typeof rawRecord.request.record === "object"
  ) {
    rawRecord = rawRecord.request.record;
  }
  if (typeof rawRecord.kind !== "string" || typeof rawRecord.title !== "string") {
    return null;
  }
  if (!VALID_KINDS.has(rawRecord.kind)) {
    return null;
  }
  if (typeof rawRecord.statement !== "string" || rawRecord.statement.trim() === "") {
    return null;
  }
  return {
    kind: rawRecord.kind,
    title: rawRecord.title,
    statement: rawRecord.statement,
    scope: typeof rawRecord.scope === "string" ? rawRecord.scope : "whole-project",
    scope_detail: typeof rawRecord.scope_detail === "string" ? rawRecord.scope_detail : null,
    evidence: normalizeEvidence(rawRecord.evidence),
    confidence: typeof rawRecord.confidence === "string" ? rawRecord.confidence : null,
    action: typeof rawRecord.action === "string" ? rawRecord.action : null,
  };
}

function collectLayerRecords({ repoRoot, layer }) {
  const records = [];
  const warnings = [];
  const sortedPaths = (layer.resolved_paths ?? []).slice().sort((left, right) => left.localeCompare(right));
  for (const relativePath of sortedPaths) {
    if (!RECORD_EXTENSIONS.has(extname(relativePath).toLowerCase())) {
      continue;
    }
    const absolutePath = resolve(repoRoot, relativePath);
    try {
      const documents = parseYamlDocuments(absolutePath);
      for (const document of documents) {
        const record = coerceLayerRecord(layer.layer, document);
        if (!record) {
          continue;
        }
        records.push({
          layer: layer.layer,
          file: relativePath,
          precedence: layer.precedence,
          claim_key: buildClaimKey(record),
          ...record,
        });
      }
    } catch (error) {
      warnings.push(`unreadable:${relativePath}:${error.message}`);
    }
  }
  return { records, warnings };
}

function deriveConfidence(record) {
  if (record.confidence && VALID_CONFIDENCE.has(record.confidence)) {
    return {
      confidence: record.confidence,
      reason: "source-record-confidence",
    };
  }
  if (record.evidence.length >= 2) {
    return {
      confidence: "medium",
      reason: "inferred-multi-evidence",
    };
  }
  if (record.evidence.length === 1) {
    return {
      confidence: "low",
      reason: "inferred-single-evidence",
    };
  }
  return {
    confidence: "low",
    reason: "missing-evidence",
  };
}

function classifyCandidate({ duplicate, conflict, evidenceCount }) {
  if (duplicate) {
    return {
      novelty: "duplicate",
      classification: "duplicate-existing",
      recommended_next_action: "KEEP_IN_TASK_MEMORY",
      reason_to_promote: "No promotion needed; claim already exists in Global Project Memory.",
      reason_not_to_promote_yet: "Candidate is a semantic duplicate of an active Global record.",
    };
  }
  if (conflict) {
    return {
      novelty: "supersede-candidate",
      classification: "needs-supersede-review",
      recommended_next_action: "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL",
      reason_to_promote: "Candidate may require explicit supersede review against an active Global claim.",
      reason_not_to_promote_yet: "Conflicting statement with Global Project Memory must be resolved explicitly.",
    };
  }
  if (evidenceCount === 0) {
    return {
      novelty: "new",
      classification: "too-weak-do-not-promote",
      recommended_next_action: "REJECT_CANDIDATES",
      reason_to_promote: "No promotion signal because evidence is missing.",
      reason_not_to_promote_yet: "Candidate has no explicit evidence payload.",
    };
  }
  return {
    novelty: "new",
    classification: "keep-as-candidate",
    recommended_next_action: "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL",
    reason_to_promote: "Evidence-backed candidate not found in Global Project Memory.",
    reason_not_to_promote_yet: "Requires explicit write workflow for authoritative promotion.",
  };
}

function findGlobalMatch(record, globalByClaimKey, globalByIdentity) {
  const byClaim = globalByClaimKey.get(record.claim_key);
  if (byClaim) {
    return byClaim;
  }
  const identity = [
    normalizeText(record.kind),
    normalizeText(record.title),
    normalizeText(record.scope),
    normalizeText(record.scope_detail),
  ].join("|");
  return globalByIdentity.get(identity) ?? null;
}

function chooseNextAction(candidates) {
  if (candidates.length === 0) {
    return "REJECT_CANDIDATES";
  }
  if (
    candidates.some((candidate) =>
      ["keep-as-candidate", "needs-supersede-review"].includes(candidate.classification),
    )
  ) {
    return "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL";
  }
  if (candidates.every((candidate) => candidate.classification === "too-weak-do-not-promote")) {
    return "REJECT_CANDIDATES";
  }
  return "KEEP_IN_TASK_MEMORY";
}

export function buildMemoryCandidateReport({
  repoRoot,
  runtime = "codex_cli",
  target = "repo",
  taskScope = null,
  evidenceSources = [],
  strictness = "strict-gate-fail-fast",
  maxCandidates = 20,
} = {}) {
  if (typeof taskScope !== "string" || taskScope.trim() === "") {
    throw new Error("candidate-input-missing: --task-scope is required");
  }
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
    throw new Error("candidate-input-invalid: --max-candidates must be an integer >= 1");
  }

  const resolution = resolveReadAuthority({
    repoRoot,
    packId: "pairslash-memory-candidate",
  });
  const globalLayer = (resolution.layers ?? []).find((layer) => layer.layer === "global-project-memory");
  if (!globalLayer || (globalLayer.resolved_paths ?? []).length === 0) {
    throw new Error("candidate-context-insufficient: authoritative Global Project Memory could not be resolved");
  }

  const globalCollected = collectLayerRecords({ repoRoot, layer: globalLayer });
  const globalByClaimKey = new Map();
  const globalByIdentity = new Map();
  for (const record of globalCollected.records) {
    if (!globalByClaimKey.has(record.claim_key)) {
      globalByClaimKey.set(record.claim_key, record);
    }
    const identity = [
      normalizeText(record.kind),
      normalizeText(record.title),
      normalizeText(record.scope),
      normalizeText(record.scope_detail),
    ].join("|");
    if (!globalByIdentity.has(identity)) {
      globalByIdentity.set(identity, record);
    }
  }

  const sourceLayers = (resolution.layers ?? [])
    .filter((layer) => SOURCE_LAYERS.includes(layer.layer))
    .sort((left, right) => left.precedence - right.precedence);
  const sourceRecords = [];
  const sourceWarnings = [];
  for (const layer of sourceLayers) {
    const collected = collectLayerRecords({ repoRoot, layer });
    sourceRecords.push(...collected.records);
    sourceWarnings.push(...collected.warnings);
  }

  if (sourceRecords.length === 0) {
    throw new Error(
      "candidate-context-insufficient: no candidate records found in task-memory/session/staging",
    );
  }

  const sortedSourceRecords = sourceRecords
    .slice()
    .sort((left, right) => {
      if (left.precedence !== right.precedence) {
        return left.precedence - right.precedence;
      }
      if (left.file !== right.file) {
        return left.file.localeCompare(right.file);
      }
      return left.claim_key.localeCompare(right.claim_key);
    });
  const limitedRecords = sortedSourceRecords.slice(0, maxCandidates);

  const candidates = limitedRecords.map((record, index) => {
    const matchedGlobal = findGlobalMatch(record, globalByClaimKey, globalByIdentity);
    const candidateStatement = normalizeText(record.statement);
    const globalStatement = normalizeText(matchedGlobal?.statement);
    const duplicate = Boolean(
      matchedGlobal &&
        candidateStatement !== "" &&
        globalStatement !== "" &&
        candidateStatement === globalStatement,
    );
    const conflict = Boolean(
      matchedGlobal &&
        candidateStatement !== "" &&
        globalStatement !== "" &&
        candidateStatement !== globalStatement,
    );
    const supersede = conflict || record.action === "supersede";
    const confidence = deriveConfidence(record);
    const classification = classifyCandidate({
      duplicate,
      conflict,
      evidenceCount: record.evidence.length,
    });
    const reasons = [];
    if (duplicate) {
      reasons.push("statement-match-with-global");
    }
    if (conflict) {
      reasons.push("statement-conflict-with-global");
    }
    if (record.action === "supersede") {
      reasons.push("source-action-supersede");
    }
    if (reasons.length === 0) {
      reasons.push("no-authoritative-match");
    }
    return {
      id: `C${String(index + 1).padStart(3, "0")}-${candidateId(
        `${record.layer}\u0000${record.file}\u0000${record.claim_key}`,
      )}`,
      source_layer: record.layer,
      source_file: record.file,
      claim_key: record.claim_key,
      kind: record.kind,
      title: record.title,
      statement: record.statement,
      scope: record.scope,
      scope_detail: record.scope_detail,
      evidence: record.evidence,
      confidence: confidence.confidence,
      confidence_reason: confidence.reason,
      novelty: classification.novelty,
      classification: classification.classification,
      reason_to_promote: classification.reason_to_promote,
      reason_not_to_promote_yet: classification.reason_not_to_promote_yet,
      target_file_hint: `.pairslash/project-memory/${routeTargetFile(record)}`,
      matched_global_record: matchedGlobal
        ? {
            layer: matchedGlobal.layer,
            file: matchedGlobal.file,
            kind: matchedGlobal.kind,
            title: matchedGlobal.title,
            scope: matchedGlobal.scope,
            scope_detail: matchedGlobal.scope_detail,
            statement: matchedGlobal.statement,
          }
        : null,
      suspicion: {
        duplicate,
        conflict,
        supersede,
        reasons,
      },
      recommended_next_action: classification.recommended_next_action,
    };
  });

  if (candidates.every((candidate) => candidate.evidence.length === 0)) {
    throw new Error("candidate-context-insufficient: extracted candidates have no evidence");
  }

  const duplicatesFound = candidates
    .filter((candidate) => candidate.suspicion.duplicate)
    .map((candidate) => candidate.id);
  const conflictsFound = candidates
    .filter((candidate) => candidate.suspicion.conflict)
    .map((candidate) => candidate.id);
  const missingEvidence = candidates
    .filter((candidate) => candidate.evidence.length === 0)
    .map((candidate) => candidate.id);
  const unresolvedContext = [
    ...(resolution.missing_paths ?? []),
    ...(resolution.warnings ?? []),
    ...sourceWarnings,
  ];

  const report = {
    kind: "memory-candidate-report",
    schema_version: CANDIDATE_REPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    runtime,
    target,
    task_scope: taskScope,
    strictness,
    read_profile_id: resolution.profile_id,
    read_only: true,
    precedence_rule: resolution.record_resolution?.precedence_rule ?? [],
    plan: {
      task_scope: taskScope,
      evidence_sources:
        evidenceSources.length > 0
          ? evidenceSources.slice()
          : sourceLayers.flatMap((layer) => layer.resolved_paths ?? []),
      candidate_count_estimate: sortedSourceRecords.length,
      risk_notes: unresolvedContext,
    },
    candidates,
    reconciliation: {
      existing_records_checked: globalCollected.records
        .map((record) => record.file)
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => left.localeCompare(right)),
      duplicates_found: duplicatesFound,
      conflicts_found: conflictsFound,
      supersede_review_needed: conflictsFound,
      missing_evidence: missingEvidence,
      unresolved_context: unresolvedContext,
    },
    next_action: chooseNextAction(candidates),
  };

  const errors = validateCandidateReport(report);
  if (errors.length > 0) {
    throw new Error(`invalid candidate report :: ${errors.join("; ")}`);
  }
  return report;
}
