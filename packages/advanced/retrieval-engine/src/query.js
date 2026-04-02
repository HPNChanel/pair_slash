import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, relative, resolve } from "node:path";

import { resolveRetrievalCapabilities } from "./capabilities.js";
import {
  evaluateRetrievalPolicy,
  RETRIEVAL_POLICY_ACTIONS,
} from "./policy-contract.js";
import { resolveRetrievedFacts } from "./conflicts.js";

const DEFAULT_MAX_RESULTS = 20;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;
const DEFAULT_MAX_FILES_PER_SOURCE = 1500;
const SKIP_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  ".pairslash",
  ".agents",
]);

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function isPathInside(rootPath, candidatePath) {
  const resolvedRoot = resolve(rootPath);
  const resolvedCandidate = resolve(candidatePath);
  const root = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;
  const candidate = process.platform === "win32" ? resolvedCandidate.toLowerCase() : resolvedCandidate;
  return candidate === root || candidate.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`);
}

function collectFilesRecursive(rootPath, files, maxFiles) {
  if (files.length >= maxFiles) {
    return;
  }
  let entries = [];
  try {
    entries = readdirSync(rootPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) {
      return;
    }
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }
      collectFilesRecursive(resolve(rootPath, entry.name), files, maxFiles);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    files.push(resolve(rootPath, entry.name));
  }
}

function readTextFileIfSafe(filePath, maxFileBytes) {
  let stats = null;
  try {
    stats = statSync(filePath);
  } catch {
    return null;
  }
  if (!stats.isFile() || stats.size > maxFileBytes) {
    return null;
  }
  try {
    const content = readFileSync(filePath, "utf8");
    if (content.includes("\u0000")) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

function buildExcerpt(content, startIndex, queryLength) {
  const prefix = Math.max(0, startIndex - 80);
  const suffix = Math.min(content.length, startIndex + queryLength + 180);
  return content
    .slice(prefix, suffix)
    .replace(/\s+/g, " ")
    .trim();
}

function countOccurrences(contentLower, needleLower) {
  if (!needleLower) {
    return 0;
  }
  let count = 0;
  let index = 0;
  while (index < contentLower.length) {
    const found = contentLower.indexOf(needleLower, index);
    if (found < 0) {
      break;
    }
    count += 1;
    index = found + needleLower.length;
  }
  return count;
}

function resolveSourceAction(kind) {
  if (kind === "repo_local") {
    return RETRIEVAL_POLICY_ACTIONS.QUERY_REPO_LOCAL;
  }
  if (kind === "artifact_local") {
    return RETRIEVAL_POLICY_ACTIONS.QUERY_ARTIFACT_LOCAL;
  }
  return RETRIEVAL_POLICY_ACTIONS.QUERY_EXTERNAL;
}

function isSecretLikePath(pathValue) {
  const normalized = normalizePath(pathValue).toLowerCase();
  const fileName = basename(normalized);
  return (
    normalized.includes("/.env") ||
    normalized.includes("/secrets") ||
    normalized.includes("/credential") ||
    normalized.includes("/token") ||
    fileName.startsWith(".env") ||
    fileName.includes("secret") ||
    fileName.includes("token") ||
    fileName.includes("credential") ||
    fileName === "id_rsa" ||
    fileName.endsWith(".pem")
  );
}

function createResult({
  repoRoot,
  sourceKind,
  sourcePath,
  sourceRef,
  filePath,
  queryLower,
  content,
  stale,
}) {
  const contentLower = content.toLowerCase();
  const matchIndex = contentLower.indexOf(queryLower);
  if (matchIndex < 0) {
    return null;
  }
  const lineNumber = content.slice(0, matchIndex).split("\n").length;
  const occurrences = countOccurrences(contentLower, queryLower);
  return {
    label: "retrieved",
    authoritative: false,
    truth_tier: "supplemental",
    source_kind: sourceKind,
    source_path: normalizePath(relative(repoRoot, filePath)),
    anchor: `line:${lineNumber}`,
    snapshot_or_commit_ref: sourceRef ?? "working-tree",
    indexed_at: null,
    confidence: occurrences >= 3 ? "high" : "medium",
    staleness: Boolean(stale),
    summary_or_excerpt: buildExcerpt(content, matchIndex, queryLower.length),
    match_count: occurrences,
    no_authoritative_write: true,
    query_source: normalizePath(sourcePath),
  };
}

function sortResults(results) {
  return results.slice().sort((left, right) => {
    const leftKey = `${left.source_path}\u0000${left.anchor}\u0000${left.summary_or_excerpt}`;
    const rightKey = `${right.source_path}\u0000${right.anchor}\u0000${right.summary_or_excerpt}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function runRetrievalQuery({
  repoRoot = process.cwd(),
  query,
  invocation = "explicit",
  sources = [],
  capabilities = {},
  retrievedFacts = [],
  globalMemoryRecords = [],
  maxResults = DEFAULT_MAX_RESULTS,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxFilesPerSource = DEFAULT_MAX_FILES_PER_SOURCE,
} = {}) {
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("query is required");
  }

  const resolvedRepoRoot = resolve(repoRoot);
  const queryLower = query.trim().toLowerCase();
  const explicitInvocation = invocation === "explicit";
  const resolvedCapabilities = resolveRetrievalCapabilities(capabilities);
  const sourceReports = [];
  const results = [];
  const declaredSources = Array.isArray(sources) ? sources : [];

  for (const source of declaredSources) {
    const sourceKind = typeof source?.kind === "string" ? source.kind : "unknown";
    const sourcePath = typeof source?.path === "string" && source.path.trim() !== ""
      ? source.path
      : ".";
    const sourceAbsolutePath = resolve(resolvedRepoRoot, sourcePath);
    const outsideRepoBoundary = !isPathInside(resolvedRepoRoot, sourceAbsolutePath);
    const policy = evaluateRetrievalPolicy({
      action: resolveSourceAction(sourceKind),
      capabilities: resolvedCapabilities,
      explicitInvocation,
      sourcePath,
      stale: Boolean(source?.stale),
      secretLikePath: isSecretLikePath(sourcePath),
      outsideRepoBoundary,
    });

    sourceReports.push({
      source_id: source?.id ?? null,
      source_kind: sourceKind,
      source_path: normalizePath(sourcePath),
      policy,
    });

    if (policy.overall_verdict !== "allow") {
      continue;
    }

    const files = [];
    collectFilesRecursive(sourceAbsolutePath, files, maxFilesPerSource);
    for (const filePath of files) {
      if (results.length >= maxResults) {
        break;
      }
      const content = readTextFileIfSafe(filePath, maxFileBytes);
      if (!content) {
        continue;
      }
      const result = createResult({
        repoRoot: resolvedRepoRoot,
        sourceKind,
        sourcePath,
        sourceRef: source?.snapshot_or_commit_ref,
        filePath,
        queryLower,
        content,
        stale: source?.stale,
      });
      if (result) {
        results.push(result);
      }
    }

    if (results.length >= maxResults) {
      break;
    }
  }

  const factResolutions = resolveRetrievedFacts({
    retrievedFacts,
    globalMemoryRecords,
  });
  const notes = [];
  if (!resolvedCapabilities.retrieval_enabled) {
    notes.push("retrieval is disabled by default");
  }
  if (!explicitInvocation) {
    notes.push("retrieval execution requires explicit invocation");
  }

  return {
    kind: "retrieval-query-result",
    schema_version: "0.1.0",
    lane: "phase11-retrieval",
    invocation,
    authoritative: false,
    label: "retrieved",
    truth_tier: "supplemental",
    no_authoritative_write: true,
    query: query.trim(),
    capability_flags: resolvedCapabilities,
    source_reports: sourceReports,
    results: sortResults(results),
    fact_resolutions: factResolutions,
    notes,
  };
}
