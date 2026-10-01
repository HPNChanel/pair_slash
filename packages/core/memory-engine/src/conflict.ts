import { relative, resolve } from "node:path";

import {
  AUTHORITATIVE_LAYERS,
  CANDIDATE_LAYERS,
  buildRecordId,
  safeScalarString,
  scopesMatch,
  statementsMatch,
  titlesMatch,
} from "./internal.ts";
import { routeTargetFile } from "./records.ts";

export function relativeFromProjectMemory(repoRoot: string, absolutePath: any) {
  return relative(resolve(repoRoot, ".pairslash", "project-memory"), safeScalarString(absolutePath)).replace(
    /\\/g,
    "/",
  );
}

export function summarizeEntry(entry: any, reasons: any = []) {
  const record = entry.record ?? {};
  return {
    layer: entry.layer,
    file: safeScalarString(entry.file).replace(/\\/g, "/"),
    kind: record.kind,
    title: record.title,
    scope: record.scope,
    scope_detail: record.scope_detail ?? null,
    statement: record.statement ?? null,
    artifact_path: entry.artifact_path ?? null,
    reasons: [...new Set(reasons)].sort((left: any, right: any) => left.localeCompare(right)),
  };
}

export function findSupersedeTarget(existingRecords: any, record: any) {
  return existingRecords.find(
    (entry: any) =>
      entry.layer === "global-project-memory" &&
      (buildRecordId(entry.record) === record.supersedes ||
        (entry.record?.kind === record.kind && titlesMatch(entry.record, record))),
  );
}

export function detectDuplicates(existingRecords: any, record: any) {
  return existingRecords.filter(
    (entry: any) =>
      AUTHORITATIVE_LAYERS.has(entry.layer) &&
      entry.record?.kind === record.kind &&
      titlesMatch(entry.record, record) &&
      scopesMatch(entry.record, record) &&
      statementsMatch(entry.record, record),
  );
}

export function detectConflicts(existingRecords: any, record: any) {
  return existingRecords.filter((entry: any) => {
    if (!AUTHORITATIVE_LAYERS.has(entry.layer)) {
      return false;
    }
    if (entry.record?.kind !== record.kind) {
      return false;
    }
    if (!scopesMatch(entry.record, record)) {
      return false;
    }
    if (statementsMatch(entry.record, record)) {
      return false;
    }
    return titlesMatch(entry.record, record) || buildRecordId(entry.record) === record.supersedes;
  });
}

export function detectShadowWarnings(existingRecords: any, record: any) {
  if (record.scope === "whole-project") {
    return [];
  }
  return existingRecords
    .filter(
      (entry: any) =>
        entry.layer === "global-project-memory" &&
        entry.record?.kind === record.kind &&
        entry.record?.scope === "whole-project",
    )
    .map((entry: any) => `scope-shadow:${buildRecordId(entry.record)}`);
}

export function findCandidateConflicts(existingRecords: any, record: any) {
  return existingRecords.filter((entry: any) => {
    if (!CANDIDATE_LAYERS.has(entry.layer)) {
      return false;
    }
    if (entry.record?.kind !== record.kind) {
      return false;
    }
    if (!(titlesMatch(entry.record, record) || scopesMatch(entry.record, record))) {
      return false;
    }
    return !statementsMatch(entry.record, record);
  });
}

export function collectRelatedRecords(existingRecords: any, record: any) {
  return existingRecords
    .filter((entry: any) => {
      if (entry.record?.kind !== record.kind) {
        return false;
      }
      return (
        titlesMatch(entry.record, record) ||
        scopesMatch(entry.record, record) ||
        buildRecordId(entry.record) === record.supersedes ||
        (record.scope !== "whole-project" && entry.record.scope === "whole-project")
      );
    })
    .map((entry: any) => {
      const reasons: string[] = [];
      if (titlesMatch(entry.record, record)) {
        reasons.push("title-match");
      }
      if (scopesMatch(entry.record, record)) {
        reasons.push("scope-match");
      }
      if (buildRecordId(entry.record) === record.supersedes) {
        reasons.push("supersede-target");
      }
      if (record.scope !== "whole-project" && entry.record.scope === "whole-project") {
        reasons.push("scope-shadow-source");
      }
      return summarizeEntry(entry, reasons);
    })
    .sort((left: any, right: any) => {
      const sortKey = (entry: any) =>
        `${safeScalarString(entry.layer)}\u0000${safeScalarString(entry.kind)}\u0000${safeScalarString(entry.title)}\u0000${entry.file}`;
      return sortKey(left).localeCompare(sortKey(right));
    });
}

export function resolveTargetRelativeFile(repoRoot: string, existingRecords: any, record: any) {
  const supersedeTarget = record.action === "supersede" ? findSupersedeTarget(existingRecords, record) : null;
  if (supersedeTarget?.layer === "global-project-memory") {
    return relativeFromProjectMemory(repoRoot, supersedeTarget.file);
  }
  return routeTargetFile(record);
}

// Re-export so pipeline module can reach them through a single import surface.
export { buildRecordId };
