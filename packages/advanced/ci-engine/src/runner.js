import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, relative, resolve } from "node:path";

import { resolveCiCapabilities } from "./capabilities.js";
import { CI_POLICY_ACTIONS, evaluateCiPolicy } from "./policy-contract.js";

const DEFAULT_MAX_SCAN_FILES = 1500;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;
const SKIP_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  ".pairslash",
  ".agents",
  ".github",
]);
const VERDICT_PRECEDENCE = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

const DEFAULT_CHECKS = Object.freeze([
  {
    id: "repo.packages_path_exists",
    type: "path_exists",
    path: "packages",
    required: true,
  },
  {
    id: "repo.core_packs_path_exists",
    type: "path_exists",
    path: "packs/core",
    required: true,
  },
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

function looksLikeText(filePath, maxBytes) {
  let stats = null;
  try {
    stats = statSync(filePath);
  } catch {
    return false;
  }
  if (!stats.isFile() || stats.size > maxBytes) {
    return false;
  }
  try {
    const content = readFileSync(filePath, "utf8");
    return !content.includes("\u0000");
  } catch {
    return false;
  }
}

function createRepoSummary({
  repoRoot,
  maxScanFiles,
  maxFileBytes,
}) {
  const files = [];
  collectFilesRecursive(repoRoot, files, maxScanFiles);

  let textFileCount = 0;
  for (const filePath of files) {
    if (looksLikeText(filePath, maxFileBytes)) {
      textFileCount += 1;
    }
  }

  return {
    repo_root: normalizePath(repoRoot),
    scanned_files: files.length,
    text_files: textFileCount,
    max_scan_files: maxScanFiles,
    sample_files: files
      .slice(0, 20)
      .map((filePath) => normalizePath(relative(repoRoot, filePath))),
  };
}

function runPathExistsCheck({ repoRoot, id, path, required }) {
  const resolvedPath = resolve(repoRoot, path);
  const insideRepo = isPathInside(repoRoot, resolvedPath);
  const exists = insideRepo ? existsSync(resolvedPath) : false;
  const status = exists ? "pass" : "fail";
  return {
    id,
    type: "path_exists",
    status,
    required,
    observed: {
      path: normalizePath(path),
      exists,
      inside_repo_boundary: insideRepo,
    },
    message: exists
      ? `path exists: ${path}`
      : insideRepo
        ? `path does not exist: ${path}`
        : `path is outside repo boundary: ${path}`,
  };
}

function runTextContainsCheck({ repoRoot, id, path, needle, required }) {
  const resolvedPath = resolve(repoRoot, path);
  const insideRepo = isPathInside(repoRoot, resolvedPath);
  let found = false;
  if (insideRepo && existsSync(resolvedPath)) {
    try {
      const content = readFileSync(resolvedPath, "utf8");
      found = content.includes(needle);
    } catch {
      found = false;
    }
  }
  return {
    id,
    type: "text_contains",
    status: found ? "pass" : "fail",
    required,
    observed: {
      path: normalizePath(path),
      contains_needle: found,
      inside_repo_boundary: insideRepo,
    },
    message: found
      ? `needle found in ${path}`
      : `needle not found in ${path}`,
  };
}

function runDeclaredChecks({
  repoRoot,
  checks = [],
}) {
  const declaredChecks = Array.isArray(checks) && checks.length > 0
    ? checks
    : DEFAULT_CHECKS;
  const results = [];
  for (const check of declaredChecks) {
    const id = typeof check?.id === "string" && check.id.trim() !== ""
      ? check.id
      : `check-${results.length + 1}`;
    const required = check?.required !== false;
    const type = typeof check?.type === "string" ? check.type : "path_exists";
    if (type === "path_exists") {
      const path = typeof check?.path === "string" && check.path.trim() !== ""
        ? check.path
        : ".";
      results.push(runPathExistsCheck({ repoRoot, id, path, required }));
      continue;
    }
    if (type === "text_contains") {
      const path = typeof check?.path === "string" && check.path.trim() !== ""
        ? check.path
        : ".";
      const needle = typeof check?.needle === "string" ? check.needle : "";
      results.push(runTextContainsCheck({ repoRoot, id, path, needle, required }));
      continue;
    }
    results.push({
      id,
      type,
      status: "fail",
      required,
      observed: null,
      message: `unsupported check type: ${type}`,
    });
  }
  return results;
}

function splitLines(value) {
  if (!value) {
    return [];
  }
  return value.replace(/\r\n/g, "\n").split("\n");
}

function buildUnifiedDiff(pathValue, beforeContent, afterContent) {
  const beforeLines = splitLines(beforeContent);
  const afterLines = splitLines(afterContent);
  const relativePath = normalizePath(pathValue);

  return [
    `diff --git a/${relativePath} b/${relativePath}`,
    `--- a/${relativePath}`,
    `+++ b/${relativePath}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
    ...beforeLines.map((line) => `-${line}`),
    ...afterLines.map((line) => `+${line}`),
    "",
  ].join("\n");
}

function readTextFileOrEmpty(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function createPatchArtifacts({
  repoRoot,
  patchCandidates = [],
}) {
  const artifacts = [];
  for (const candidate of patchCandidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const rawPath = typeof candidate.path === "string" && candidate.path.trim() !== ""
      ? candidate.path
      : null;
    if (!rawPath) {
      continue;
    }
    const absolutePath = resolve(repoRoot, rawPath);
    if (!isPathInside(repoRoot, absolutePath)) {
      continue;
    }

    const beforeContent = existsSync(absolutePath)
      ? readTextFileOrEmpty(absolutePath)
      : "";
    const afterContent = typeof candidate.after === "string"
      ? candidate.after
      : beforeContent;
    if (beforeContent === afterContent) {
      continue;
    }

    const targetPath = normalizePath(relative(repoRoot, absolutePath));
    const artifactId = typeof candidate.id === "string" && candidate.id.trim() !== ""
      ? candidate.id
      : `patch-${artifacts.length + 1}`;
    artifacts.push({
      kind: "ci-patch-artifact",
      schema_version: "0.1.0",
      artifact_id: artifactId,
      label: "candidate-artifact",
      authoritative: false,
      truth_tier: "supplemental",
      apply_mode: "manual-only",
      target_path: targetPath,
      diff: buildUnifiedDiff(targetPath, beforeContent, afterContent),
      description: typeof candidate.description === "string" ? candidate.description : null,
      source_file: basename(targetPath),
    });
  }
  return artifacts;
}

function pickOverallVerdict(verdicts = []) {
  if (verdicts.length === 0) {
    return "allow";
  }
  return verdicts.reduce((current, verdict) => {
    if ((VERDICT_PRECEDENCE[verdict] ?? VERDICT_PRECEDENCE.deny) > VERDICT_PRECEDENCE[current]) {
      return verdict;
    }
    return current;
  }, "allow");
}

function resolveRepoSnapshotRef(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0 && typeof result.stdout === "string") {
    const trimmed = result.stdout.trim();
    if (trimmed !== "") {
      return trimmed;
    }
  }
  return "working-tree";
}

function createProvenance({
  repoRoot,
  policyVerdict,
  capabilityFlags,
  provenance = {},
}) {
  const ciRunId = typeof provenance.ci_run_id === "string" && provenance.ci_run_id.trim() !== ""
    ? provenance.ci_run_id
    : randomUUID();
  const shimStatus = provenance.shim_status === "none"
    ? "none"
    : provenance.shim_status === "shim"
      ? "shim"
      : "unknown";
  const declaredLiveEvidence = provenance.live_evidence === true && shimStatus === "none";
  const evidenceTier = declaredLiveEvidence ? "live-disposable" : "deterministic-simulated";

  return {
    kind: "ci-provenance",
    schema_version: "0.1.0",
    ci_run_id: ciRunId,
    created_at: new Date().toISOString(),
    repo_snapshot_ref: resolveRepoSnapshotRef(repoRoot),
    runtime: typeof provenance.runtime === "string" ? provenance.runtime : "unknown",
    runtime_version: typeof provenance.runtime_version === "string" ? provenance.runtime_version : null,
    execution_context: typeof provenance.execution_context === "string"
      ? provenance.execution_context
      : "disposable",
    trigger_type: typeof provenance.trigger_type === "string" ? provenance.trigger_type : "manual",
    source_pack_id: "pairslash-ci-addon",
    lane_package_version: "0.1.0",
    policy_verdict: policyVerdict,
    capability_flags: capabilityFlags,
    shim_status: shimStatus,
    live_evidence: declaredLiveEvidence,
    evidence_tier: evidenceTier,
  };
}

function buildTraceSupportHint({ report, artifacts, provenance }) {
  return {
    kind: "ci-trace-support-hint",
    schema_version: "0.1.0",
    exportable: true,
    trace_event: {
      event_type: "ci.lane.report.created",
      outcome:
        report.status === "pass"
          ? "pass"
          : report.status === "fail"
            ? "failed"
            : "blocked",
      source_package: "@pairslash/ci-engine-advanced",
      source_module: "src/runner.js",
      payload: {
        ci_run_id: provenance.ci_run_id,
        policy_verdict: provenance.policy_verdict,
        evidence_tier: provenance.evidence_tier,
      },
      artifact_paths: artifacts.map((artifact) => artifact.artifact_id),
    },
    support_bundle: {
      recommended_file_name: `ci-lane-${provenance.ci_run_id}.json`,
      includes: ["report", "artifacts", "provenance", "policy_verdicts"],
    },
  };
}

function toOutcome(verdict) {
  if (verdict === "deny") {
    return "blocked";
  }
  if (verdict === "require-preview") {
    return "blocked";
  }
  if (verdict === "ask") {
    return "blocked";
  }
  return "allow";
}

export function createCiPlan({
  checks = [],
  patchCandidates = [],
} = {}) {
  return {
    kind: "ci-lane-plan",
    schema_version: "0.1.0",
    lane: "phase11-ci",
    explicit_opt_in_required: true,
    report_first: true,
    artifact_first: true,
    check_count: Array.isArray(checks) ? checks.length : 0,
    patch_candidate_count: Array.isArray(patchCandidates) ? patchCandidates.length : 0,
    planned_actions: [
      CI_POLICY_ACTIONS.READ_REPO,
      CI_POLICY_ACTIONS.RUN_CHECKS,
      ...(Array.isArray(patchCandidates) && patchCandidates.length > 0
        ? [CI_POLICY_ACTIONS.GENERATE_DIFF, CI_POLICY_ACTIONS.ATTACH_ARTIFACT]
        : []),
    ],
  };
}

export function runCiLane({
  repoRoot = process.cwd(),
  invocation = "explicit",
  capabilities = {},
  repoPolicyExplicit = false,
  checks = [],
  patchCandidates = [],
  provenance = {},
  maxScanFiles = DEFAULT_MAX_SCAN_FILES,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
} = {}) {
  const resolvedRepoRoot = resolve(repoRoot);
  const explicitInvocation = invocation === "explicit";
  const resolvedCapabilities = resolveCiCapabilities(capabilities);
  const liveEvidence = provenance.live_evidence === true && provenance.shim_status === "none";
  const policyInput = {
    capabilities: resolvedCapabilities,
    explicitInvocation,
    repoPolicyExplicit: Boolean(repoPolicyExplicit),
    liveEvidence,
  };

  const readRepoVerdict = evaluateCiPolicy({
    action: CI_POLICY_ACTIONS.READ_REPO,
    ...policyInput,
  });
  const runChecksVerdict = evaluateCiPolicy({
    action: CI_POLICY_ACTIONS.RUN_CHECKS,
    ...policyInput,
  });

  const activeVerdicts = [readRepoVerdict, runChecksVerdict];

  const repoSummary = toOutcome(readRepoVerdict.overall_verdict) === "allow"
    ? createRepoSummary({
        repoRoot: resolvedRepoRoot,
        maxScanFiles,
        maxFileBytes,
      })
    : null;
  const checkResults = toOutcome(runChecksVerdict.overall_verdict) === "allow"
    ? runDeclaredChecks({
        repoRoot: resolvedRepoRoot,
        checks,
      })
    : [];

  let patchArtifacts = [];
  if (Array.isArray(patchCandidates) && patchCandidates.length > 0) {
    const generateDiffVerdict = evaluateCiPolicy({
      action: CI_POLICY_ACTIONS.GENERATE_DIFF,
      ...policyInput,
    });
    activeVerdicts.push(generateDiffVerdict);

    if (toOutcome(generateDiffVerdict.overall_verdict) === "allow") {
      patchArtifacts = createPatchArtifacts({
        repoRoot: resolvedRepoRoot,
        patchCandidates,
      });
      if (patchArtifacts.length > 0) {
        const attachArtifactVerdict = evaluateCiPolicy({
          action: CI_POLICY_ACTIONS.ATTACH_ARTIFACT,
          ...policyInput,
        });
        activeVerdicts.push(attachArtifactVerdict);
        if (toOutcome(attachArtifactVerdict.overall_verdict) !== "allow") {
          patchArtifacts = [];
        }
      }
    }
  }

  const guardrailVerdicts = [
    evaluateCiPolicy({
      action: CI_POLICY_ACTIONS.COMMIT,
      ...policyInput,
    }),
    evaluateCiPolicy({
      action: CI_POLICY_ACTIONS.MERGE,
      ...policyInput,
    }),
    evaluateCiPolicy({
      action: CI_POLICY_ACTIONS.WRITE_TASK_MEMORY_CANDIDATE,
      ...policyInput,
    }),
    evaluateCiPolicy({
      action: CI_POLICY_ACTIONS.WRITE_GLOBAL_MEMORY,
      ...policyInput,
    }),
  ];

  const overallPolicyVerdict = pickOverallVerdict(
    activeVerdicts.map((verdict) => verdict.overall_verdict),
  );
  const requiredCheckFailures = checkResults.filter((check) => check.required !== false && check.status !== "pass");
  const activeBlocked = activeVerdicts.some((verdict) => toOutcome(verdict.overall_verdict) !== "allow");
  const reportStatus = activeBlocked
    ? "blocked"
    : requiredCheckFailures.length > 0
      ? "fail"
      : "pass";
  const provenanceRecord = createProvenance({
    repoRoot: resolvedRepoRoot,
    policyVerdict: overallPolicyVerdict,
    capabilityFlags: resolvedCapabilities,
    provenance,
  });

  const report = {
    kind: "ci-lane-report",
    schema_version: "0.1.0",
    lane: "phase11-ci",
    status: reportStatus,
    authoritative: false,
    label: "report",
    truth_tier: "supplemental",
    explicit_invocation: explicitInvocation,
    repo_policy_explicit: Boolean(repoPolicyExplicit),
    execution_mode: resolvedCapabilities.ci_plan_only ? "plan-only" : "execute",
    repo_summary: repoSummary,
    checks: checkResults,
    required_check_failures: requiredCheckFailures.map((entry) => entry.id),
  };

  const traceSupport = buildTraceSupportHint({
    report,
    artifacts: patchArtifacts,
    provenance: provenanceRecord,
  });

  return {
    kind: "ci-lane-run-result",
    schema_version: "0.1.0",
    lane: "phase11-ci",
    invocation,
    capability_flags: resolvedCapabilities,
    policy_verdicts: {
      overall: overallPolicyVerdict,
      active: activeVerdicts,
      guardrails: guardrailVerdicts,
    },
    plan: createCiPlan({
      checks,
      patchCandidates,
    }),
    report,
    artifacts: patchArtifacts,
    provenance: provenanceRecord,
    trace_support: traceSupport,
  };
}
