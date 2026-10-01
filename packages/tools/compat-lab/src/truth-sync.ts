// sync-truth: preview-first multi-file truth promotion.
//
// Computes the lane truth update as a set of file operations
// ({path, before, after}) covering the lane record yaml, the runtime
// surface matrix yaml, the regenerated compatibility matrix markdown,
// affected pack manifest live_workflow_refs, the runtime-verification
// promotion log, an audit entry, and a transaction journal. Preview
// renders unified diffs; apply writes atomically, re-validates via
// loadPublicSupportSnapshot, and rolls back every write on failure.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import YAML from "yaml";

import {
  loadPublicSupportSnapshot,
  stableJson,
  stableYaml,
} from "@pairslash/spec-core";

import {
  renderCompatibilityMatrixMarkdown,
} from "./matrix.ts";

const MATRIX_YAML_PATH = "docs/compatibility/runtime-surface-matrix.yaml";
const MATRIX_MD_PATH = "docs/compatibility/compatibility-matrix.md";
const VERIFICATION_DOC_PATH = "docs/compatibility/runtime-verification.md";
const AUDIT_ROOT = ".pairslash/audit-log";
const JOURNAL_ROOT = ".pairslash/staging/sync-truth";

const RUNG_ORDER = Object.freeze(["prep", "preview", "stable-tested"]);
const SIDE_STATES = new Set(["degraded", "blocked"]);
const LIVE_EVIDENCE_RANK: Record<string, number> = Object.freeze({
  live_smoke: 0,
  live_verification: 1,
  repeated_live_verification: 2,
});
const LIVE_EVIDENCE_CLASSES = new Set(Object.keys(LIVE_EVIDENCE_RANK));
const ALL_SUPPORT_LEVELS = new Set(["prep", "preview", "stable-tested", "degraded", "blocked"]);
const ALLOWED_VERDICTS = new Set(["pass", "partial", "fail", "blocked", "unrecorded", "not_recorded", "not_applicable"]);
const ALLOWED_FRESHNESS = new Set(["none-recorded", "fresh", "stale", "expired"]);

const RECORD_FIELD_ORDER = [
  "evidence_id",
  "evidence_class",
  "failure_type",
  "captured_at",
  "freshness_state",
  "stale_at",
  "expire_at",
  "owner_id",
  "runtime_id",
  "target",
  "os_lane",
  "host_profile_id",
  "pack_scope",
  "workflow_scope",
  "capability_scope",
  "entrypoint_path_used",
  "command",
  "runtime_version",
  "shell_family",
  "verdict",
  "summary",
  "artifact_paths",
  "command_capture_refs",
  "refs",
];

export interface TruthSyncFileOp {
  path: string;
  before: string;
  after: string;
}

export interface TruthSyncPlan {
  kind: "sync-truth-plan";
  schema_version: "1.0.0";
  ok: boolean;
  errors: string[];
  lane_id: string | null;
  runtime_id: string | null;
  from_level: string | null;
  to_level: string | null;
  evidence_class: string | null;
  record_id: string | null;
  actor: string;
  at: string;
  ops: TruthSyncFileOp[];
  diffs: { path: string; diff: string }[];
  notes: string[];
}

interface LaneMirror {
  matrix: Record<string, any>;
  lane: Record<string, any>;
  laneIndex: number;
  record: Record<string, any>;
  recordPath: string;
}

// ---------- yaml scalar helpers ----------

function scalarYaml(value: unknown): string {
  return YAML.stringify(value).trimEnd();
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(
    value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
      .map((entry) => entry.trim()),
  )].sort((left, right) => left.localeCompare(right));
}

// ---------- surgical yaml patching ----------

function topLevelBlockEnd(lines: string[], startIndex: number): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line !== "" && !/^\s/.test(line)) {
      return index;
    }
  }
  return lines.length;
}

function findTopLevelKey(lines: string[], key: string): number {
  const needle = new RegExp(`^${key}:`);
  for (let index = 0; index < lines.length; index += 1) {
    if (needle.test(lines[index])) {
      return index;
    }
  }
  return -1;
}

function replaceTopLevelScalar(text: string, key: string, value: unknown): string {
  const lines = text.split("\n");
  const index = findTopLevelKey(lines, key);
  if (index === -1) {
    throw new Error(`sync-truth: missing top-level key ${key}`);
  }
  const end = topLevelBlockEnd(lines, index);
  if (end !== index + 1) {
    throw new Error(`sync-truth: ${key} is not a scalar field`);
  }
  lines[index] = `${key}: ${scalarYaml(value)}`;
  return lines.join("\n");
}

function patchNestedMap(text: string, topKey: string, entries: Record<string, string>): string {
  if (Object.keys(entries).length === 0) {
    return text;
  }
  const lines = text.split("\n");
  const start = findTopLevelKey(lines, topKey);
  if (start === -1) {
    throw new Error(`sync-truth: missing top-level key ${topKey}`);
  }
  const end = topLevelBlockEnd(lines, start);
  const remaining = { ...entries };
  for (let index = start + 1; index < end; index += 1) {
    const match = lines[index].match(/^(\s+)([A-Za-z0-9_]+):.*$/);
    if (match && match[2] in remaining) {
      lines[index] = `${match[1]}${match[2]}: ${scalarYaml(remaining[match[2]])}`;
      delete remaining[match[2]];
    }
  }
  const additions = Object.keys(remaining)
    .sort()
    .map((key) => `  ${key}: ${scalarYaml(remaining[key])}`);
  lines.splice(end, 0, ...additions);
  return lines.join("\n");
}

function findIndentedKey(lines: string[], key: string): { index: number; indent: string } | null {
  const needle = new RegExp(`^(\\s+)${key}:`);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(needle);
    if (match) {
      return { index, indent: match[1] };
    }
  }
  return null;
}

function indentedBlockEnd(lines: string[], startIndex: number, indent: string): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line !== "" && !line.startsWith(`${indent} `) && !line.startsWith(`${indent}-`)) {
      return index;
    }
  }
  return lines.length;
}

// Patches `<mapKey>.<listKey>` (e.g. live_workflow_refs.codex_cli) wherever the
// map key appears, preserving the file's own indentation.
function appendToNestedList(text: string, mapKey: string, listKey: string, items: string[]): string {
  if (items.length === 0) {
    return text;
  }
  const lines = text.split("\n");
  const map = findIndentedKey(lines, mapKey);
  if (map === null) {
    throw new Error(`sync-truth: missing key ${mapKey}`);
  }
  const mapEnd = indentedBlockEnd(lines, map.index, map.indent);
  const itemIndent = `${map.indent}  `;
  let listIndex = -1;
  for (let index = map.index + 1; index < mapEnd; index += 1) {
    if (lines[index].startsWith(`${itemIndent}${listKey}:`)) {
      listIndex = index;
      break;
    }
  }
  if (listIndex === -1) {
    // List key absent — create `  <listKey>:` with items at the end of the map block.
    const newLines = [`${itemIndent}${listKey}:`, ...items.map((item) => `${itemIndent}  - ${scalarYaml(item)}`)];
    lines.splice(mapEnd, 0, ...newLines);
    return lines.join("\n");
  }
  if (/:\s*\[\]\s*$/.test(lines[listIndex])) {
    lines[listIndex] = `${itemIndent}${listKey}:`;
    const itemLines = items.map((item) => `${itemIndent}  - ${scalarYaml(item)}`);
    lines.splice(listIndex + 1, 0, ...itemLines);
    return lines.join("\n");
  }
  let insertAt = listIndex + 1;
  const dashPrefix = `${itemIndent}  -`;
  while (insertAt < lines.length && lines[insertAt].startsWith(dashPrefix)) {
    insertAt += 1;
  }
  const itemLines = items.map((item) => `${dashPrefix} ${scalarYaml(item)}`);
  lines.splice(insertAt, 0, ...itemLines);
  return lines.join("\n");
}

function appendToTopLevelList(text: string, key: string, items: string[]): string {
  if (items.length === 0) {
    return text;
  }
  const lines = text.split("\n");
  const start = findTopLevelKey(lines, key);
  if (start === -1) {
    throw new Error(`sync-truth: missing top-level key ${key}`);
  }
  const end = topLevelBlockEnd(lines, start);
  if (/:\s*\[\]\s*$/.test(lines[start])) {
    lines[start] = `${key}:`;
    lines.splice(start + 1, 0, ...items.map((item) => `  - ${scalarYaml(item)}`));
    return lines.join("\n");
  }
  const itemLines = items.map((item) => `  - ${scalarYaml(item)}`);
  lines.splice(end, 0, ...itemLines);
  return lines.join("\n");
}

function appendRecordBlock(text: string, key: string, record: Record<string, unknown>): string {
  const blockLines: string[] = [];
  const keys = RECORD_FIELD_ORDER.filter((field) => field in record);
  for (const field of Object.keys(record)) {
    if (!keys.includes(field)) {
      keys.push(field);
    }
  }
  let first = true;
  for (const field of keys) {
    const value = record[field];
    const prefix = first ? "  - " : "    ";
    first = false;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        blockLines.push(`${prefix}${field}: []`);
      } else {
        blockLines.push(`${prefix}${field}:`);
        for (const item of value) {
          blockLines.push(`${" ".repeat(prefix.length)}  - ${scalarYaml(item)}`);
        }
      }
    } else {
      blockLines.push(`${prefix}${field}: ${scalarYaml(value)}`);
    }
  }
  const lines = text.split("\n");
  const start = findTopLevelKey(lines, key);
  if (start === -1) {
    throw new Error(`sync-truth: missing top-level key ${key}`);
  }
  const end = topLevelBlockEnd(lines, start);
  lines.splice(end, 0, ...blockLines);
  return lines.join("\n");
}

// ---------- unified diff ----------

function lcsDiff(beforeText: string, afterText: string): { op: " " | "-" | "+"; line: string }[] {
  const before = beforeText.split("\n");
  const after = afterText.split("\n");
  const rows = before.length + 1;
  const cols = after.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops: { op: " " | "-" | "+"; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      ops.push({ op: " ", line: before[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ op: "-", line: before[i] });
      i += 1;
    } else {
      ops.push({ op: "+", line: after[j] });
      j += 1;
    }
  }
  while (i < before.length) {
    ops.push({ op: "-", line: before[i] });
    i += 1;
  }
  while (j < after.length) {
    ops.push({ op: "+", line: after[j] });
    j += 1;
  }
  return ops;
}

export function unifiedDiff(path: string, beforeText: string, afterText: string): string {
  const ops = lcsDiff(beforeText.replace(/\r\n/g, "\n"), afterText.replace(/\r\n/g, "\n"));
  const hunks: { start: number; lines: typeof ops }[] = [];
  const context = 3;
  let index = 0;
  while (index < ops.length) {
    if (ops[index].op === " ") {
      index += 1;
      continue;
    }
    const start = Math.max(0, index - context);
    let end = index;
    while (end < ops.length && (ops[end].op !== " " || end - index <= context * 2 + 1)) {
      if (ops[end].op !== " ") {
        index = end;
      }
      end += 1;
    }
    const stop = Math.min(ops.length, index + context + 1);
    hunks.push({ start, lines: ops.slice(start, stop) });
    index = stop;
  }
  const out = [`--- a/${path}`, `+++ b/${path}`];
  let beforeCursor = 1;
  let afterCursor = 1;
  let consumed = 0;
  for (const hunk of hunks) {
    const skipped = ops.slice(consumed, hunk.start);
    beforeCursor += skipped.filter((entry) => entry.op !== "+").length;
    afterCursor += skipped.filter((entry) => entry.op !== "-").length;
    const beforeCount = hunk.lines.filter((entry) => entry.op !== "+").length;
    const afterCount = hunk.lines.filter((entry) => entry.op !== "-").length;
    out.push(`@@ -${beforeCursor},${beforeCount} +${afterCursor},${afterCount} @@`);
    for (const entry of hunk.lines) {
      out.push(`${entry.op}${entry.line}`);
    }
    beforeCursor += beforeCount;
    afterCursor += afterCount;
    consumed = hunk.start + hunk.lines.length;
  }
  return out.join("\n");
}

// ---------- validation ----------

function isoNow(at: string | null | undefined): string {
  if (typeof at === "string" && at.trim() !== "" && !Number.isNaN(Date.parse(at))) {
    return new Date(at).toISOString();
  }
  return new Date().toISOString();
}

function isIso(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

function validateIncomingRecord(
  record: Record<string, any>,
  lane: Record<string, any>,
  errors: string[],
): void {
  for (const field of [
    "evidence_id",
    "captured_at",
    "owner_id",
    "runtime_id",
    "target",
    "os_lane",
    "host_profile_id",
    "entrypoint_path_used",
    "command",
    "summary",
    "verdict",
    "stale_at",
    "expire_at",
  ]) {
    if (typeof record[field] !== "string" || record[field].trim() === "") {
      errors.push(`sync-truth:record-missing-field:${field}`);
    }
  }
  if (errors.length > 0) {
    return;
  }
  if (!isIso(record.captured_at) || !isIso(record.stale_at) || !isIso(record.expire_at)) {
    errors.push("sync-truth:record-invalid-timestamp");
  }
  if (Date.parse(record.stale_at) > Date.parse(record.expire_at)) {
    errors.push("sync-truth:record-stale-after-expire");
  }
  if (!ALLOWED_VERDICTS.has(record.verdict)) {
    errors.push(`sync-truth:record-invalid-verdict:${record.verdict}`);
  }
  if (!ALLOWED_FRESHNESS.has(record.freshness_state)) {
    errors.push(`sync-truth:record-invalid-freshness:${record.freshness_state}`);
  }
  if ("evidence_class" in record && !LIVE_EVIDENCE_CLASSES.has(record.evidence_class)) {
    errors.push(`sync-truth:record-invalid-evidence-class:${record.evidence_class}`);
  }
  for (const field of ["runtime_id", "target", "os_lane"]) {
    if (record[field] !== lane[field]) {
      errors.push(`sync-truth:record-lane-mismatch:${field}`);
    }
  }
  for (const field of ["pack_scope", "workflow_scope", "capability_scope"]) {
    if (!Array.isArray(record[field]) || record[field].length === 0) {
      errors.push(`sync-truth:record-empty-scope:${field}`);
    }
  }
}

function findLane(repoRoot: string, laneId: string, errors: string[]): LaneMirror | null {
  const matrixPath = resolve(repoRoot, MATRIX_YAML_PATH);
  if (!existsSync(matrixPath)) {
    errors.push(`sync-truth:matrix-missing:${MATRIX_YAML_PATH}`);
    return null;
  }
  const matrix = YAML.parse(readFileSync(matrixPath, "utf8"));
  const lanes = Array.isArray(matrix?.runtime_lanes) ? matrix.runtime_lanes : [];
  const laneIndex = lanes.findIndex((lane: any) => lane?.lane_id === laneId);
  if (laneIndex === -1) {
    errors.push(`sync-truth:lane-not-found:${laneId}`);
    return null;
  }
  const lane = lanes[laneIndex];
  const recordPath = lane?.evidence_data_ref;
  if (typeof recordPath !== "string" || recordPath.trim() === "") {
    errors.push(`sync-truth:lane-missing-evidence-data-ref:${laneId}`);
    return null;
  }
  const absolute = resolve(repoRoot, recordPath);
  if (!absolute.startsWith(resolve(repoRoot))) {
    errors.push(`sync-truth:lane-record-escapes-repo:${recordPath}`);
    return null;
  }
  if (!existsSync(absolute)) {
    errors.push(`sync-truth:lane-record-missing:${recordPath}`);
    return null;
  }
  const record = YAML.parse(readFileSync(absolute, "utf8"));
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    errors.push(`sync-truth:lane-record-invalid:${recordPath}`);
    return null;
  }
  return { matrix, lane, laneIndex, record, recordPath };
}

function rungRank(level: string | null | undefined): number | null {
  const index = RUNG_ORDER.indexOf(level ?? "");
  return index === -1 ? null : index;
}

function meetsPromotionRules({
  level,
  rules,
  bestEvidence,
  hostProfileCount,
  surfaceVerdicts,
  freshness,
  caveatSummary,
  negativeRecordCount,
}: {
  level: string;
  rules: Record<string, any>;
  bestEvidence: string | null;
  hostProfileCount: number;
  surfaceVerdicts: Record<string, any>;
  freshness: string;
  caveatSummary: string;
  negativeRecordCount: number;
}): string[] {
  const ruleKey = level === "stable-tested" ? "stable_tested" : level;
  const rule = rules?.[ruleKey];
  if (!rule || typeof rule !== "object") {
    return [`sync-truth:no-promotion-rule:${level}`];
  }
  const failures: string[] = [];
  if (rule.requires_negative_live_evidence === true && negativeRecordCount === 0) {
    failures.push(`${level}-requires-negative-live-evidence`);
  }
  if (typeof rule.minimum_evidence_class === "string") {
    const requiredRank = LIVE_EVIDENCE_RANK[rule.minimum_evidence_class];
    const bestRank = bestEvidence !== null ? LIVE_EVIDENCE_RANK[bestEvidence] : undefined;
    if (requiredRank === undefined) {
      failures.push(`${level}-rule-unknown-evidence-class:${rule.minimum_evidence_class}`);
    } else if (bestRank === undefined || bestRank < requiredRank) {
      failures.push(`${level}-requires-evidence:${rule.minimum_evidence_class}`);
    }
  }
  if (typeof rule.minimum_host_profiles === "number" && hostProfileCount < rule.minimum_host_profiles) {
    failures.push(`${level}-requires-host-profiles:${rule.minimum_host_profiles}`);
  }
  if (rule.requires_canonical_entrypoint === true && surfaceVerdicts?.canonical_picker !== "pass") {
    failures.push(`${level}-requires-canonical-picker-pass`);
  }
  if (rule.requires_documented_caveat === true && caveatSummary.trim() === "") {
    failures.push(`${level}-requires-caveat-summary`);
  }
  if (rule.promotion_blocked_without_live === true && (bestEvidence === null || !(bestEvidence in LIVE_EVIDENCE_RANK))) {
    failures.push(`${level}-blocked-without-live-evidence`);
  }
  if (
    ["preview", "stable-tested"].includes(level) &&
    freshness !== "fresh"
  ) {
    failures.push(`${level}-requires-fresh-evidence`);
  }
  return failures;
}

function derivedHostProfileCount(record: Record<string, any>): number {
  const ids = new Set<string>();
  for (const entry of record.live_records ?? []) {
    if (typeof entry?.host_profile_id === "string" && entry.host_profile_id.trim() !== "") {
      ids.add(entry.host_profile_id);
    }
  }
  return ids.size;
}

function derivedLastVerifiedAt(record: Record<string, any>): string | null {
  const stamps = (record.live_records ?? [])
    .map((entry: any) => entry?.captured_at)
    .filter((entry: unknown): entry is string => typeof entry === "string" && !Number.isNaN(Date.parse(entry)));
  if (stamps.length === 0) {
    return null;
  }
  return stamps.sort((left: string, right: string) => Date.parse(right) - Date.parse(left))[0];
}

function derivedFreshness(record: Record<string, any>, nowIso: string): string {
  const liveRecords = Array.isArray(record.live_records) ? record.live_records : [];
  if (liveRecords.length === 0) {
    return "none-recorded";
  }
  const newest = liveRecords
    .map((entry: any) => ({ captured: Date.parse(entry?.captured_at), stale: Date.parse(entry?.stale_at), expire: Date.parse(entry?.expire_at) }))
    .filter((entry) => !Number.isNaN(entry.captured))
    .sort((left, right) => right.captured - left.captured)[0];
  if (!newest) {
    return "none-recorded";
  }
  const now = Date.parse(nowIso);
  if (!Number.isNaN(newest.expire) && now > newest.expire) {
    return "expired";
  }
  if (!Number.isNaN(newest.stale) && now > newest.stale) {
    return "stale";
  }
  return "fresh";
}

function deriveBestEvidenceClass(record: Record<string, any>): string | null {
  let best: string | null = null;
  for (const entry of record.live_records ?? []) {
    const candidate = entry?.evidence_class;
    if (typeof candidate !== "string" || !(candidate in LIVE_EVIDENCE_RANK)) {
      continue;
    }
    if (best === null || LIVE_EVIDENCE_RANK[candidate] > LIVE_EVIDENCE_RANK[best]) {
      best = candidate;
    }
  }
  return best;
}

// ---------- main ----------

export interface TruthSyncInput {
  laneId?: string | null;
  bumpEvidence?: string | null;
  supportLevel?: string | null;
  record?: Record<string, any> | null;
  liveRefs?: string[];
  surfaceVerdicts?: Record<string, string>;
  caveatSummary?: string | null;
  actor?: string;
  at?: string | null;
}

export function planTruthSync({
  repoRoot,
  input,
}: {
  repoRoot: string;
  input: TruthSyncInput;
}): TruthSyncPlan {
  const errors: string[] = [];
  const notes: string[] = [];
  const at = isoNow(input.at);
  const actor = typeof input.actor === "string" && input.actor.trim() !== ""
    ? input.actor.trim()
    : "pairslash-sync-truth";
  const laneId = typeof input.laneId === "string" ? input.laneId.trim() : "";
  if (laneId === "") {
    errors.push("sync-truth:lane-required");
  }
  const mirror = laneId ? findLane(repoRoot, laneId, errors) : null;
  if (errors.length > 0 || mirror === null) {
    return {
      kind: "sync-truth-plan",
      schema_version: "1.0.0",
      ok: false,
      errors,
      lane_id: laneId || null,
      runtime_id: null,
      from_level: null,
      to_level: null,
      evidence_class: input.bumpEvidence ?? null,
      record_id: null,
      actor,
      at,
      ops: [],
      diffs: [],
      notes,
    };
  }
  const { matrix, lane, record, recordPath } = mirror;
  const nextRecord = JSON.parse(JSON.stringify(record));

  // --- merge incoming record ---
  const incoming = input.record ?? null;
  let recordId: string | null = null;
  if (incoming !== null) {
    validateIncomingRecord(incoming, lane, errors);
    const targetList = "failure_type" in incoming ? "negative_live_records" : "live_records";
    nextRecord[targetList] = [...(nextRecord[targetList] ?? []), incoming];
    recordId = incoming.evidence_id ?? null;
    for (const field of ["pack_scope", "workflow_scope", "capability_scope"]) {
      nextRecord[field] = normalizeList([...(nextRecord[field] ?? []), ...(incoming[field] ?? [])]);
    }
  }

  // --- evidence bump ---
  const bump = input.bumpEvidence ?? null;
  if (bump !== null) {
    if (!LIVE_EVIDENCE_CLASSES.has(bump)) {
      errors.push(`sync-truth:invalid-evidence-class:${bump}`);
    } else {
      const derived = deriveBestEvidenceClass(nextRecord);
      const current = record.best_live_evidence_class ?? null;
      const floor = [derived, current]
        .filter((entry): entry is string => entry !== null)
        .reduce<string | null>(
          (best, entry) =>
            best === null || LIVE_EVIDENCE_RANK[entry] > LIVE_EVIDENCE_RANK[best]
              ? entry
              : best,
          null,
        );
      if (floor !== null && LIVE_EVIDENCE_RANK[bump] < LIVE_EVIDENCE_RANK[floor]) {
        errors.push(`sync-truth:evidence-downgrade-denied:${floor}->${bump}`);
      } else {
        nextRecord.best_live_evidence_class = bump;
      }
    }
  }

  // --- derived fields ---
  nextRecord.host_profile_count = derivedHostProfileCount(nextRecord);
  nextRecord.last_verified_at = derivedLastVerifiedAt(nextRecord) ?? record.last_verified_at ?? null;
  nextRecord.freshness_state = derivedFreshness(nextRecord, at);
  if (Array.isArray(input.liveRefs) && input.liveRefs.length > 0) {
    const merged = normalizeList([...(nextRecord.live_evidence_refs ?? []), ...input.liveRefs]);
    for (const ref of input.liveRefs) {
      if (!existsSync(resolve(repoRoot, ref))) {
        errors.push(`sync-truth:live-ref-missing:${ref}`);
      }
    }
    nextRecord.live_evidence_refs = merged;
  }
  if (input.surfaceVerdicts && Object.keys(input.surfaceVerdicts).length > 0) {
    nextRecord.surface_verdicts = { ...(nextRecord.surface_verdicts ?? {}), ...input.surfaceVerdicts };
  }
  const caveatSummary = typeof input.caveatSummary === "string" && input.caveatSummary.trim() !== ""
    ? input.caveatSummary.trim()
    : nextRecord.caveat_summary;
  nextRecord.caveat_summary = caveatSummary;

  const negativeCount = Array.isArray(nextRecord.negative_live_records)
    ? nextRecord.negative_live_records.length
    : 0;
  const bestEvidence = nextRecord.best_live_evidence_class ?? null;
  const rules = matrix?.evidence_policy?.promotion_rules ?? {};

  // --- resolve target level ---
  const currentLevel = record.current_public_support_level;
  const requestedLevel = input.supportLevel ?? null;
  const meets = (level: string) => meetsPromotionRules({
    level,
    rules,
    bestEvidence,
    hostProfileCount: nextRecord.host_profile_count,
    surfaceVerdicts: nextRecord.surface_verdicts ?? {},
    freshness: nextRecord.freshness_state,
    caveatSummary: caveatSummary ?? "",
    negativeRecordCount: negativeCount,
  });

  let targetLevel: string;
  if (requestedLevel !== null) {
    if (!ALL_SUPPORT_LEVELS.has(requestedLevel)) {
      errors.push(`sync-truth:invalid-support-level:${requestedLevel}`);
      targetLevel = currentLevel;
    } else {
      targetLevel = requestedLevel;
    }
  } else {
    // Auto-resolve: minimum rung that keeps the lane internally valid, else current.
    const currentRank = rungRank(currentLevel);
    if (currentRank === null) {
      targetLevel = currentLevel;
    } else if (currentLevel === "prep" && bestEvidence !== null && LIVE_EVIDENCE_RANK[bestEvidence] >= LIVE_EVIDENCE_RANK.live_verification) {
      targetLevel = "preview";
    } else if (
      currentLevel === "preview" &&
      bestEvidence === "repeated_live_verification" &&
      nextRecord.host_profile_count >= 2 &&
      nextRecord.freshness_state === "fresh"
    ) {
      targetLevel = "stable-tested";
    } else {
      targetLevel = currentLevel;
    }
  }

  // --- ladder + policy gate ---
  const targetRank = rungRank(targetLevel);
  if (SIDE_STATES.has(targetLevel)) {
    const failures = meets(targetLevel);
    errors.push(...failures.map((failure) => `sync-truth:policy:${failure}`));
  } else if (targetRank !== null) {
    const currentRank = rungRank(currentLevel);
    const effectiveCurrentRank = currentRank ?? (currentLevel === "degraded" ? 0 : null);
    if (effectiveCurrentRank === null) {
      errors.push(`sync-truth:blocked-lane-manual:${currentLevel}`);
    } else if (targetRank > effectiveCurrentRank + 1) {
      errors.push(`sync-truth:ladder-skip:${currentLevel}->${targetLevel}`);
    } else {
      const failures = meets(targetLevel);
      errors.push(...failures.map((failure) => `sync-truth:policy:${failure}`));
    }
  }

  nextRecord.current_public_support_level = targetLevel;

  if (errors.length > 0) {
    return {
      kind: "sync-truth-plan",
      schema_version: "1.0.0",
      ok: false,
      errors: normalizeList(errors),
      lane_id: laneId,
      runtime_id: record.runtime_id ?? null,
      from_level: currentLevel,
      to_level: null,
      evidence_class: bump,
      record_id: recordId,
      actor,
      at,
      ops: [],
      diffs: [],
      notes,
    };
  }

  // --- file ops ---
  const ops: TruthSyncFileOp[] = [];
  const readCurrent = (relativePath: string): string => {
    const absolute = resolve(repoRoot, relativePath);
    return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
  };

  // 1. lane record yaml — surgical patch preserving hand formatting.
  let laneText = readCurrent(recordPath);
  try {
    const scalarPatches: Record<string, unknown> = {
      current_public_support_level: targetLevel,
      best_live_evidence_class: nextRecord.best_live_evidence_class ?? null,
      freshness_state: nextRecord.freshness_state,
      last_verified_at: nextRecord.last_verified_at,
      host_profile_count: nextRecord.host_profile_count,
      caveat_summary: nextRecord.caveat_summary,
    };
    for (const [key, value] of Object.entries(scalarPatches)) {
      if (record[key] !== value) {
        laneText = replaceTopLevelScalar(laneText, key, value);
      }
    }
    for (const field of ["pack_scope", "workflow_scope", "capability_scope"]) {
      const existing = normalizeList(record[field]);
      const additions = normalizeList(nextRecord[field]).filter((entry) => !existing.includes(entry));
      laneText = appendToTopLevelList(laneText, field, additions);
    }
    const existingLiveRefs = normalizeList(record.live_evidence_refs);
    const newLiveRefs = normalizeList(nextRecord.live_evidence_refs).filter((ref) => !existingLiveRefs.includes(ref));
    laneText = appendToTopLevelList(laneText, "live_evidence_refs", newLiveRefs);
    const verdictPatch: Record<string, string> = {};
    for (const [key, value] of Object.entries(nextRecord.surface_verdicts ?? {})) {
      if (record.surface_verdicts?.[key] !== value) {
        verdictPatch[key] = value as string;
      }
    }
    laneText = patchNestedMap(laneText, "surface_verdicts", verdictPatch);
    if (incoming !== null) {
      const listKey = "failure_type" in incoming ? "negative_live_records" : "live_records";
      laneText = appendRecordBlock(laneText, listKey, incoming);
    }
  } catch (error) {
    errors.push(`sync-truth:lane-patch-failed:${error instanceof Error ? error.message : String(error)}`);
  }
  ops.push({ path: recordPath, before: readCurrent(recordPath), after: laneText });

  // 2. matrix yaml — regenerate canonical rendering of the mirrored lane entry.
  const matrixBefore = readCurrent(MATRIX_YAML_PATH);
  const matrixDoc = JSON.parse(JSON.stringify(matrix));
  const matrixLane = matrixDoc.runtime_lanes[mirror.laneIndex];
  matrixLane.support_level = targetLevel;
  matrixLane.actual_evidence_class = nextRecord.best_live_evidence_class ?? null;
  matrixLane.freshness_state = nextRecord.freshness_state;
  matrixLane.host_profile_count = nextRecord.host_profile_count;
  matrixLane.last_verified_at = nextRecord.last_verified_at;
  matrixLane.surface_verdicts = nextRecord.surface_verdicts;
  matrixLane.live_evidence_refs = normalizeList(nextRecord.live_evidence_refs);
  matrixLane.negative_evidence_refs = normalizeList(nextRecord.negative_evidence_refs);
  matrixLane.deterministic_evidence_refs = normalizeList(nextRecord.deterministic_evidence_refs);
  matrixLane.fake_evidence_refs = normalizeList(nextRecord.fake_acceptance_evidence_refs);
  matrixLane.shim_evidence_refs = normalizeList(nextRecord.shim_acceptance_evidence_refs);
  matrixLane.claim_guard_refs = normalizeList(nextRecord.claim_guard_refs);
  const matrixAfter = stableYaml(matrixDoc);
  if (matrixAfter.trim() !== matrixBefore.trim()) {
    ops.push({ path: MATRIX_YAML_PATH, before: matrixBefore, after: matrixAfter.endsWith("\n") ? matrixAfter : `${matrixAfter}\n` });
  }

  // 3. compatibility-matrix.md — render against the patched snapshot.
  const patchedSnapshot = {
    evidence_policy: matrixDoc.evidence_policy,
    version: matrixDoc.version,
    support_policy: matrixDoc.support_policy,
    runtime_lanes: matrixDoc.runtime_lanes,
    known_issues: matrixDoc.known_issues,
    release_gates: matrixDoc.release_gates,
  };
  const mdBefore = readCurrent(MATRIX_MD_PATH);
  const mdAfter = renderCompatibilityMatrixMarkdown({ repoRoot, snapshot: patchedSnapshot });
  if (mdAfter.trim() !== mdBefore.trim()) {
    ops.push({ path: MATRIX_MD_PATH, before: mdBefore, after: mdAfter.endsWith("\n") ? mdAfter : `${mdAfter}\n` });
  }

  // 4. affected pack manifests — ensure live_workflow_refs[runtime] includes the lane data ref.
  const packScopes = normalizeList(nextRecord.pack_scope);
  for (const packId of packScopes) {
    const manifestRel = `packs/core/${packId}/pack.manifest.yaml`;
    const manifestAbs = resolve(repoRoot, manifestRel);
    if (!existsSync(manifestAbs)) {
      notes.push(`sync-truth:pack-manifest-skipped:${packId}`);
      continue;
    }
    const manifestText = readCurrent(manifestRel);
    const parsed = YAML.parse(manifestText);
    const refs = parsed?.support?.workflow_evidence?.live_workflow_refs?.[lane.runtime_id];
    if (!Array.isArray(refs)) {
      notes.push(`sync-truth:pack-manifest-no-live-refs-slot:${packId}`);
      continue;
    }
    if (refs.includes(recordPath)) {
      continue;
    }
    try {
      const patched = appendToNestedList(manifestText, "live_workflow_refs", lane.runtime_id, [recordPath]);
      ops.push({ path: manifestRel, before: manifestText, after: patched });
    } catch (error) {
      errors.push(`sync-truth:manifest-patch-failed:${packId}:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 5. runtime-verification.md — append a dated promotion log line.
  const verificationText = readCurrent(VERIFICATION_DOC_PATH);
  const logLine = `- ${at.slice(0, 10)} — sync-truth: lane \`${laneId}\` ${currentLevel} → ${targetLevel}; best live evidence ${nextRecord.best_live_evidence_class ?? "none"}; actor ${actor}${recordId ? `; record ${recordId}` : ""}.`;
  let verificationAfter: string;
  const promotionLogHeader = "## Promotion log";
  if (verificationText.includes(promotionLogHeader)) {
    verificationAfter = verificationText.replace(promotionLogHeader, `${promotionLogHeader}\n\n${logLine}`);
  } else {
    verificationAfter = `${verificationText.replace(/\s+$/, "")}\n\n${promotionLogHeader}\n\n${logLine}\n`;
  }
  if (verificationAfter !== verificationText) {
    ops.push({ path: VERIFICATION_DOC_PATH, before: verificationText, after: verificationAfter });
  }

  // 6. audit entry.
  const stamp = at.replace(/[-:]/g, "").replace("T", "").slice(0, 12);
  const auditRel = `${AUDIT_ROOT}/${stamp.slice(0, 8)}-${stamp.slice(8)}-truth-sync-${laneId}.yaml`;
  const auditEntry = {
    timestamp: at,
    action: "truth-sync",
    kind: "system-record-refresh",
    title: `sync-truth ${laneId}: ${currentLevel} → ${targetLevel}`,
    target_file: [recordPath, MATRIX_YAML_PATH, MATRIX_MD_PATH].join(", "),
    updated_by: actor,
    confidence: "high",
    result: "pending",
    notes: `evidence_class=${nextRecord.best_live_evidence_class ?? "none"}${recordId ? ` record=${recordId}` : ""}`,
  };
  ops.push({ path: auditRel, before: "", after: `${stableYaml(auditEntry)}\n` });

  // 7. journal skeleton (rewritten on apply with final status).
  const journalRel = `${JOURNAL_ROOT}/${stamp}-sync-truth-${laneId}.json`;

  if (errors.length > 0) {
    return {
      kind: "sync-truth-plan",
      schema_version: "1.0.0",
      ok: false,
      errors: normalizeList(errors),
      lane_id: laneId,
      runtime_id: record.runtime_id ?? null,
      from_level: currentLevel,
      to_level: targetLevel,
      evidence_class: bump,
      record_id: recordId,
      actor,
      at,
      ops: [],
      diffs: [],
      notes,
    };
  }

  const diffs = ops
    .filter((op) => op.before !== op.after)
    .map((op) => ({ path: op.path, diff: unifiedDiff(op.path, op.before, op.after) }));

  return {
    kind: "sync-truth-plan",
    schema_version: "1.0.0",
    ok: true,
    errors: [],
    lane_id: laneId,
    runtime_id: lane.runtime_id ?? record.runtime_id ?? null,
    from_level: currentLevel,
    to_level: targetLevel,
    evidence_class: bump,
    record_id: recordId,
    actor,
    at,
    ops: ops.filter((op) => op.before !== op.after),
    diffs,
    notes: [...notes, `journal:${journalRel}`],
  };
}

function atomicWrite(absolute: string, contents: string): void {
  const tmpPath = `${absolute}.tmp-${process.pid}`;
  writeFileSync(tmpPath, contents, "utf8");
  renameSync(tmpPath, absolute);
}

export function applyTruthSync({
  repoRoot,
  plan,
}: {
  repoRoot: string;
  plan: TruthSyncPlan;
}): {
  kind: "sync-truth-result";
  ok: boolean;
  status: "committed" | "rolled-back" | "refused";
  errors: string[];
  written: string[];
  journal: string | null;
} {
  if (!plan || plan.kind !== "sync-truth-plan" || !plan.ok) {
    return {
      kind: "sync-truth-result",
      ok: false,
      status: "refused",
      errors: ["sync-truth:apply-requires-valid-plan"],
      written: [],
      journal: null,
    };
  }
  const journalNote = plan.notes.find((note) => note.startsWith("journal:"));
  const journalRel = journalNote ? journalNote.slice("journal:".length) : null;
  const journalAbs = journalRel ? resolve(repoRoot, journalRel) : null;
  const journal = {
    kind: "sync-truth-journal",
    schema_version: "1.0.0",
    lane_id: plan.lane_id,
    from_level: plan.from_level,
    to_level: plan.to_level,
    evidence_class: plan.evidence_class,
    record_id: plan.record_id,
    actor: plan.actor,
    at: plan.at,
    status: "started",
    ops: plan.ops.map((op) => ({ path: op.path, bytes: op.after.length })),
    committed_at: null as string | null,
    errors: [] as string[],
  };
  if (journalAbs) {
    mkdirSync(dirname(journalAbs), { recursive: true });
    atomicWrite(journalAbs, `${stableJson(journal)}\n`);
  }

  const backups = new Map<string, string | null>();
  const written: string[] = [];
  const errors: string[] = [];
  try {
    for (const op of plan.ops) {
      const absolute = resolve(repoRoot, op.path);
      if (!absolute.startsWith(resolve(repoRoot))) {
        throw new Error(`sync-truth:op-escapes-repo:${op.path}`);
      }
      if (!backups.has(op.path)) {
        backups.set(op.path, existsSync(absolute) ? readFileSync(absolute, "utf8") : null);
      }
      mkdirSync(dirname(absolute), { recursive: true });
      atomicWrite(absolute, op.after);
      written.push(op.path);
    }
    loadPublicSupportSnapshot(repoRoot);
    journal.status = "committed";
    journal.committed_at = new Date().toISOString();
  } catch (error) {
    errors.push(`sync-truth:apply-failed:${error instanceof Error ? error.message : String(error)}`);
    for (const [path, before] of backups) {
      const absolute = resolve(repoRoot, path);
      try {
        if (before === null) {
          rmSync(absolute, { force: true });
        } else {
          atomicWrite(absolute, before);
        }
      } catch (rollbackError) {
        errors.push(`sync-truth:rollback-failed:${path}:${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
    }
    journal.status = "rolled-back";
    journal.errors = errors;
  }
  if (journalAbs) {
    atomicWrite(journalAbs, `${stableJson(journal)}\n`);
  }
  return {
    kind: "sync-truth-result",
    ok: journal.status === "committed",
    status: journal.status === "committed" ? "committed" : "rolled-back",
    errors,
    written: journal.status === "committed" ? written : [],
    journal: journalRel,
  };
}
