import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { stableYaml } from "@pairslash/spec-core";

export const ROOT_FILES = {
  command: "20-commands.yaml",
  glossary: "30-glossary.yaml",
  ownership: "40-ownership.yaml",
  constraint: "50-constraints.yaml",
};

export const DIRECTORY_FILES = {
  decision: "60-architecture-decisions",
  pattern: "70-known-good-patterns",
  "incident-lesson": "80-incidents-and-lessons",
};

export const SYSTEM_RECORD_FILES = new Set([
  "00-project-charter.yaml",
  "10-stack-profile.yaml",
  "90-memory-index.yaml",
]);

export const AUTHORITATIVE_LAYERS = new Set(["global-project-memory"]);
export const CANDIDATE_LAYERS = new Set(["task-memory", "session", "staging"]);

export const ALLOWED_RECORD_FIELDS = new Set([
  "kind",
  "title",
  "statement",
  "evidence",
  "scope",
  "scope_detail",
  "confidence",
  "action",
  "tags",
  "source_refs",
  "supersedes",
  "updated_by",
  "timestamp",
]);

export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return value ?? [];
  }
  return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function stableHash(value) {
  return createHash("sha256").update(stableYaml(value)).digest("hex");
}

export function buildStage(name, status, notes = []) {
  return {
    name,
    status,
    blocking: status === "blocked",
    notes: notes.filter(Boolean),
  };
}

export function buildApproval({ required = true, state = "pending" }: any = {}) {
  return {
    required,
    state,
    confirmation_phrase: required ? "write-global" : null,
  };
}

export function buildArtifactReference({ artifactId, artifactPath, requestKey, contentFingerprint, exists: present }) {
  return {
    artifact_id: artifactId,
    path: artifactPath,
    request_key: requestKey,
    content_fingerprint: contentFingerprint,
    exists: present,
  };
}

export function buildArtifactPath({ repoRoot, requestIdentity, record }) {
  const artifactId = stableHash(requestIdentity).slice(0, 16);
  const relativePath = `.pairslash/staging/memory-write-${artifactId}-${slugify(record.title)}.yaml`;
  return {
    artifactId,
    relativePath,
    absolutePath: resolve(repoRoot, relativePath),
  };
}

export function authorityErrors(contract: any, policyContext: any = {}) {
  const errors = [];
  if (
    contract.memory_contract?.authoritative_write_allowed &&
    (policyContext.read_only_workflow === true ||
      policyContext.workflow_class === "read-oriented" ||
      policyContext.authority_mode === "read-only")
  ) {
    errors.push("authority:read-only-workflow");
  }
  if (policyContext.implicit_promote_attempted) {
    errors.push("authority:implicit-promote-blocked");
  }
  return errors;
}

export function buildRecordId(record) {
  return `${record.kind}/${record.title}`;
}

export function scopesMatch(left, right) {
  return (
    left.scope === right.scope &&
    normalizeText(left.scope_detail ?? "") === normalizeText(right.scope_detail ?? "")
  );
}

export function titlesMatch(left, right) {
  return normalizeText(left.title) === normalizeText(right.title);
}

export function statementsMatch(left, right) {
  return normalizeText(left.statement) === normalizeText(right.statement);
}
