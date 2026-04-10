import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import YAML from "yaml";

import {
  MEMORY_AUDIT_REPORT_SCHEMA_VERSION,
  exists,
  loadProjectMemoryRecords,
  resolveReadAuthority,
  validateMemoryAuditReport,
  validateMutableProjectMemoryRecord,
  validateProjectMemoryIndex,
  validateProjectMemoryStructure,
  validateSystemRecord,
} from "@pairslash/spec-core";

const VALID_AUDIT_SCOPES = new Set(["full", "project-memory-only", "index-only"]);
const VALID_AUDIT_MODES = new Set(["report-only", "fix-proposal"]);
const VALID_FINDING_TYPES = new Set([
  "duplicate",
  "stale",
  "conflict",
  "orphan-ref",
  "schema-drift",
  "index-gap",
  "scope-error",
]);
const FINDING_TYPE_ORDER = [
  "conflict",
  "duplicate",
  "orphan-ref",
  "index-gap",
  "schema-drift",
  "scope-error",
  "stale",
];
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];
const TYPE_COUNTS_TEMPLATE = Object.freeze(
  Object.fromEntries([...VALID_FINDING_TYPES].map((type) => [type, 0])),
);
const SEVERITY_COUNTS_TEMPLATE = Object.freeze(
  Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, 0])),
);
const INDEX_PATH = ".pairslash/project-memory/90-memory-index.yaml";

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildClaimKey(record) {
  return [
    normalizeText(record.kind),
    normalizeText(record.title),
    normalizeText(record.scope),
    normalizeText(record.scope_detail),
  ].join("|");
}

function relativeMemoryPath(file) {
  return `.pairslash/project-memory/${String(file ?? "").replace(/^\/+/, "")}`;
}

function nextFindingId(index) {
  return `F-${String(index + 1).padStart(3, "0")}`;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function loadIndexRecord(repoRoot) {
  const absolutePath = resolve(repoRoot, INDEX_PATH);
  if (!exists(absolutePath)) {
    return { record: null, parseError: null };
  }
  try {
    return {
      record: YAML.parse(readFileSync(absolutePath, "utf8")) ?? null,
      parseError: null,
    };
  } catch (error) {
    return {
      record: null,
      parseError: error.message,
    };
  }
}

function allowFindingType(type, auditScope) {
  if (auditScope === "index-only") {
    return ["orphan-ref", "index-gap", "schema-drift"].includes(type);
  }
  if (auditScope === "project-memory-only") {
    return ["duplicate", "stale", "orphan-ref", "index-gap", "schema-drift", "scope-error"].includes(type);
  }
  return true;
}

function buildDuplicateFindings(loaded) {
  const groups = new Map();
  for (const entry of loaded.mutableEntries) {
    const record = entry.record ?? {};
    const key = [
      buildClaimKey(record),
      normalizeText(record.statement),
    ].join("|");
    const bucket = groups.get(key) ?? [];
    bucket.push(entry);
    groups.set(key, bucket);
  }
  return [...groups.values()]
    .filter((entries) => entries.length > 1)
    .map((entries) => {
      const first = entries[0];
      return {
        severity: "medium",
        type: "duplicate",
        claim_key: buildClaimKey(first.record),
        selected_layer: "global-project-memory",
        shadowed_layer: "global-project-memory",
        file_or_record: `${first.record.kind}/${first.record.title}`,
        explanation: "Authoritative project memory contains duplicate active records for the same claim and statement.",
        evidence: uniqueSorted(entries.map((entry) => relativeMemoryPath(entry.relativePath))),
        recommended_fix:
          "Collapse duplicate authoritative records into one active claim and route any durable replacement through pairslash-memory-write-global.",
        write_workflow_needed: true,
      };
    });
}

function buildStructureFindings(repoRoot) {
  return validateProjectMemoryStructure(repoRoot).map((error) => {
    const missingPath = error.split(": ").slice(1).join(": ");
    return {
      severity: missingPath === INDEX_PATH ? "high" : "medium",
      type: missingPath === INDEX_PATH ? "index-gap" : "schema-drift",
      claim_key: null,
      selected_layer: missingPath.startsWith(".pairslash/project-memory/") ? "global-project-memory" : null,
      shadowed_layer: null,
      file_or_record: missingPath,
      explanation: error,
      evidence: [missingPath],
      recommended_fix:
        missingPath === INDEX_PATH
          ? "Restore the authoritative memory index before claiming read-authority completion."
          : "Restore the canonical memory path so read workflows do not depend on implicit fallback state.",
      write_workflow_needed: false,
    };
  });
}

function buildValidationFindings(loaded) {
  const findings = [];

  for (const error of loaded.errors) {
    const [file] = error.split(" :: ");
    findings.push({
      severity: "high",
      type: "schema-drift",
      claim_key: null,
      selected_layer: "global-project-memory",
      shadowed_layer: null,
      file_or_record: file,
      explanation: error,
      evidence: [file],
      recommended_fix: "Repair unreadable YAML before relying on the affected authoritative record set.",
      write_workflow_needed: false,
    });
  }

  for (const entry of loaded.systemEntries) {
    for (const error of validateSystemRecord(entry.record)) {
      findings.push({
        severity: "high",
        type: "schema-drift",
        claim_key: null,
        selected_layer: "global-project-memory",
        shadowed_layer: null,
        file_or_record: relativeMemoryPath(entry.relativePath),
        explanation: error,
        evidence: [relativeMemoryPath(entry.relativePath)],
        recommended_fix: "Correct the system record schema before using it as authoritative project memory.",
        write_workflow_needed: false,
      });
    }
  }

  for (const entry of loaded.mutableEntries) {
    for (const error of validateMutableProjectMemoryRecord(entry.record)) {
      const type = error.includes("scope") ? "scope-error" : "schema-drift";
      findings.push({
        severity: type === "scope-error" ? "medium" : "high",
        type,
        claim_key: buildClaimKey(entry.record),
        selected_layer: "global-project-memory",
        shadowed_layer: null,
        file_or_record: relativeMemoryPath(entry.relativePath),
        explanation: error,
        evidence: [relativeMemoryPath(entry.relativePath)],
        recommended_fix:
          type === "scope-error"
            ? "Fix the record scope and scope_detail so claim resolution remains deterministic."
            : "Repair the mutable record schema before treating it as authoritative memory.",
        write_workflow_needed: false,
      });
    }
  }

  return findings;
}

function buildIndexFindings({ repoRoot, indexRecord, parseError, loaded }) {
  const findings = [];
  if (parseError) {
    findings.push({
      severity: "high",
      type: "schema-drift",
      claim_key: null,
      selected_layer: "global-project-memory",
      shadowed_layer: null,
      file_or_record: INDEX_PATH,
      explanation: `failed to parse memory index :: ${parseError}`,
      evidence: [INDEX_PATH],
      recommended_fix: "Repair the memory index YAML before relying on index-backed authoritative reads.",
      write_workflow_needed: false,
    });
    return findings;
  }
  if (!indexRecord || typeof indexRecord !== "object") {
    return findings;
  }

  for (const error of validateProjectMemoryIndex(indexRecord, loaded)) {
    findings.push({
      severity: error.includes("index missing coverage") ? "high" : "medium",
      type: error.includes("index missing coverage") ? "index-gap" : "schema-drift",
      claim_key: null,
      selected_layer: "global-project-memory",
      shadowed_layer: null,
      file_or_record: INDEX_PATH,
      explanation: error,
      evidence: [INDEX_PATH],
      recommended_fix:
        error.includes("index missing coverage")
          ? "Rebuild deterministic index coverage so Global Project Memory can be resolved without implicit gaps."
          : "Repair the memory index structure and rerun the audit.",
      write_workflow_needed: false,
    });
  }

  const indexEntries = Array.isArray(indexRecord.records) ? indexRecord.records : [];
  for (const entry of indexEntries) {
    if (!entry || typeof entry !== "object" || typeof entry.file !== "string" || entry.file.trim() === "") {
      continue;
    }
    const repoRelativePath = relativeMemoryPath(entry.file);
    if (!exists(resolve(repoRoot, repoRelativePath))) {
      findings.push({
        severity: "high",
        type: "orphan-ref",
        claim_key: null,
        selected_layer: "global-project-memory",
        shadowed_layer: null,
        file_or_record: repoRelativePath,
        explanation: "The memory index points to a record file that does not exist in the repository.",
        evidence: [INDEX_PATH, repoRelativePath],
        recommended_fix: "Remove or repair the stale index entry, then rerun the audit to confirm authoritative coverage.",
        write_workflow_needed: false,
      });
    }
  }

  return findings;
}

function buildConflictFindings(resolution) {
  return (resolution.record_resolution?.conflicts ?? []).map((conflict) => ({
    severity:
      conflict.selected_layer === "global-project-memory" && conflict.shadowed_layer !== "global-project-memory"
        ? "high"
        : "critical",
    type: "conflict",
    claim_key: conflict.claim_key,
    selected_layer: conflict.selected_layer,
    shadowed_layer: conflict.shadowed_layer,
    file_or_record: `${conflict.selected_file} <- ${conflict.shadowed_file}`,
    explanation:
      `${conflict.selected_layer} remains authoritative for the claim while ${conflict.shadowed_layer} carries contradictory supporting content (${conflict.reason}).`,
    evidence: uniqueSorted([conflict.selected_file, conflict.shadowed_file]),
    recommended_fix:
      conflict.selected_layer === "global-project-memory"
        ? "Keep Global authoritative, then reconcile the lower-layer contradiction or route any durable truth change through pairslash-memory-write-global."
        : "Resolve contradictory authoritative records explicitly before calling the read path complete.",
    write_workflow_needed: true,
  }));
}

function applyScopeAndFocus(findings, { auditScope, focus }) {
  return findings.filter((finding) => {
    if (!allowFindingType(finding.type, auditScope)) {
      return false;
    }
    if (focus.length > 0 && !focus.includes(finding.type)) {
      return false;
    }
    return true;
  });
}

function sortFindings(findings) {
  return findings
    .slice()
    .sort((left, right) => {
      const severityDelta = SEVERITY_ORDER.indexOf(left.severity) - SEVERITY_ORDER.indexOf(right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      const typeDelta = FINDING_TYPE_ORDER.indexOf(left.type) - FINDING_TYPE_ORDER.indexOf(right.type);
      if (typeDelta !== 0) {
        return typeDelta;
      }
      return `${left.file_or_record}\u0000${left.explanation}`.localeCompare(
        `${right.file_or_record}\u0000${right.explanation}`,
      );
    })
    .map((finding, index) => ({
      id: nextFindingId(index),
      ...finding,
    }));
}

function summarizeFindings(findings, unresolvedContext) {
  const severityCounts = structuredClone(SEVERITY_COUNTS_TEMPLATE);
  const typeCounts = structuredClone(TYPE_COUNTS_TEMPLATE);
  for (const finding of findings) {
    severityCounts[finding.severity] += 1;
    typeCounts[finding.type] += 1;
  }
  return {
    total_findings: findings.length,
    severity_counts: severityCounts,
    type_counts: typeCounts,
    unresolved_context: unresolvedContext,
    hard_conflict_count: findings.filter((finding) => finding.type === "conflict").length,
    write_handoff_count: findings.filter((finding) => finding.write_workflow_needed).length,
  };
}

function buildRemediationOrder(findings) {
  const ordered = uniqueSorted(findings.map((finding) => finding.recommended_fix));
  return ordered.length > 0
    ? ordered
    : ["No remediation required; rerun the audit after authoritative memory changes or new supporting evidence."];
}

function chooseNextAction(findings) {
  if (findings.some((finding) => finding.write_workflow_needed)) {
    return "USE_PAIRSLASH_MEMORY_WRITE_GLOBAL";
  }
  if (findings.length > 0) {
    return "FIX_INDEX_AND_RERUN";
  }
  return "KEEP_AS_REPORT";
}

export function buildMemoryAuditReport({
  repoRoot,
  runtime = "codex_cli",
  target = "repo",
  auditScope = null,
  mode = "report-only",
  focus = [],
} = {}) {
  if (typeof auditScope !== "string" || !VALID_AUDIT_SCOPES.has(auditScope)) {
    throw new Error("audit-input-invalid: --audit-scope must be one of full, project-memory-only, index-only");
  }
  if (typeof mode !== "string" || !VALID_AUDIT_MODES.has(mode)) {
    throw new Error("audit-input-invalid: --mode must be one of report-only or fix-proposal");
  }
  if (!Array.isArray(focus)) {
    throw new Error("audit-input-invalid: --focus must be a comma-separated list");
  }
  const normalizedFocus = uniqueSorted(focus.map((entry) => String(entry).trim()).filter(Boolean));
  const invalidFocus = normalizedFocus.filter((entry) => !VALID_FINDING_TYPES.has(entry));
  if (invalidFocus.length > 0) {
    throw new Error(`audit-input-invalid: unsupported --focus values: ${invalidFocus.join(", ")}`);
  }

  const resolution = resolveReadAuthority({
    repoRoot,
    packId: "pairslash-memory-audit",
  });
  const loaded = loadProjectMemoryRecords(repoRoot);
  const { record: indexRecord, parseError } = loadIndexRecord(repoRoot);
  const unresolvedContext = uniqueSorted([
    ...(resolution.missing_paths ?? []),
    ...(resolution.warnings ?? []),
    ...loaded.errors,
    ...(parseError ? [`${INDEX_PATH} :: ${parseError}`] : []),
  ]);

  const findings = sortFindings(
    applyScopeAndFocus(
      [
        ...buildConflictFindings(resolution),
        ...buildDuplicateFindings(loaded),
        ...buildStructureFindings(repoRoot),
        ...buildValidationFindings(loaded),
        ...buildIndexFindings({ repoRoot, indexRecord, parseError, loaded }),
      ],
      { auditScope, focus: normalizedFocus },
    ),
  );

  const report = {
    kind: "memory-audit-report",
    schema_version: MEMORY_AUDIT_REPORT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    runtime,
    target,
    audit_scope: auditScope,
    mode,
    focus: normalizedFocus,
    read_profile_id: resolution.profile_id,
    read_only: true,
    precedence_rule: resolution.record_resolution?.precedence_rule ?? [],
    plan: {
      audit_scope: auditScope,
      mode,
      focus: normalizedFocus,
      files_checked: uniqueSorted(
        (resolution.layers ?? []).flatMap((layer) => layer.resolved_paths ?? []),
      ),
      authoritative_sources: uniqueSorted(resolution.authoritative_sources ?? []),
      risk_notes: unresolvedContext,
    },
    findings,
    summary: summarizeFindings(findings, unresolvedContext),
    remediation_order: buildRemediationOrder(findings),
    next_action: chooseNextAction(findings),
    resolution,
  };

  const errors = validateMemoryAuditReport(report);
  if (errors.length > 0) {
    throw new Error(`invalid memory audit report :: ${errors.join("; ")}`);
  }
  return report;
}
