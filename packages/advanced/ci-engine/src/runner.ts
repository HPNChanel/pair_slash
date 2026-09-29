import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { stableYaml } from "@pairslash/spec-core";

import {
  resolveCiCapabilities,
  type CiCapabilityFlags,
} from "./capabilities.ts";
import {
  CI_POLICY_ACTIONS,
  evaluateCiPolicy,
  type CiPolicyVerdict,
  type CiPolicyVerdictValue,
} from "./policy-contract.ts";

const DEFAULT_MAX_SCAN_FILES = 1500;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;
const SKIP_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  ".pairslash",
  ".agents",
  ".github",
]);
const VERDICT_PRECEDENCE: Readonly<Record<CiPolicyVerdictValue, number>> = Object.freeze({
  allow: 0,
  ask: 1,
  "require-preview": 2,
  deny: 3,
});

export const CI_PROPOSALS_STAGING_DIR = join(
  ".pairslash",
  "staging",
  "ci-proposals",
);

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

interface CiCheckInput {
  id?: string;
  type?: string;
  path?: string;
  needle?: string;
  required?: boolean;
}

export interface CiCheckResult {
  id: string;
  type: string;
  status: "pass" | "fail";
  required: boolean;
  observed: unknown;
  message: string;
}

interface CiPatchCandidate {
  id?: string;
  path?: string;
  after?: string;
  description?: string;
}

export interface CiPatchArtifact {
  kind: "ci-patch-artifact";
  schema_version: "0.1.0";
  artifact_id: string;
  label: "candidate-artifact";
  authoritative: false;
  truth_tier: "supplemental";
  apply_mode: "manual-only";
  target_path: string;
  diff: string;
  description: string | null;
  source_file: string;
}

export interface CiProvenanceInput {
  ci_run_id?: string;
  created_at?: string;
  commit_sha?: string;
  runtime?: string;
  runtime_version?: string;
  execution_context?: string;
  trigger_type?: string;
  shim_status?: "none" | "shim";
  live_evidence?: boolean;
}

export interface CiProvenance {
  kind: "ci-provenance";
  schema_version: "0.1.0";
  ci_run_id: string;
  ci_run_id_origin: "explicit" | "generated";
  created_at: string;
  commit_sha: string | null;
  repo_snapshot_ref: string;
  runtime: string;
  runtime_version: string | null;
  execution_context: string;
  trigger_type: string;
  source_pack_id: "pairslash-ci-addon";
  lane_package_version: "0.1.0";
  policy_verdict: CiPolicyVerdictValue;
  capability_flags: CiCapabilityFlags;
  shim_status: "none" | "shim" | "unknown";
  live_evidence: boolean;
  evidence_tier: "live-disposable" | "deterministic-simulated";
}

export interface CiProposalWriteResult {
  kind: "ci-proposal-write-result";
  schema_version: "0.1.0";
  staging_dir: string;
  run_dir: string | null;
  written: string[];
  refused: boolean;
  errors: string[];
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const resolvedRoot = resolve(rootPath);
  const resolvedCandidate = resolve(candidatePath);
  const root = process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;
  const candidate = process.platform === "win32" ? resolvedCandidate.toLowerCase() : resolvedCandidate;
  return candidate === root || candidate.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`);
}

function collectFilesRecursive(rootPath: string, files: string[], maxFiles: number): void {
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

function looksLikeText(filePath: string, maxBytes: number): boolean {
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
}: {
  repoRoot: string;
  maxScanFiles: number;
  maxFileBytes: number;
}) {
  const files: string[] = [];
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

function runPathExistsCheck({
  repoRoot,
  id,
  path,
  required,
}: {
  repoRoot: string;
  id: string;
  path: string;
  required: boolean;
}): CiCheckResult {
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

function runTextContainsCheck({
  repoRoot,
  id,
  path,
  needle,
  required,
}: {
  repoRoot: string;
  id: string;
  path: string;
  needle: string;
  required: boolean;
}): CiCheckResult {
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
}: {
  repoRoot: string;
  checks?: CiCheckInput[];
}): CiCheckResult[] {
  const declaredChecks: CiCheckInput[] = Array.isArray(checks) && checks.length > 0
    ? checks
    : [...DEFAULT_CHECKS];
  const results: CiCheckResult[] = [];
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

function splitLines(value: string): string[] {
  if (!value) {
    return [];
  }
  return value.replace(/\r\n/g, "\n").split("\n");
}

function buildUnifiedDiff(pathValue: string, beforeContent: string, afterContent: string): string {
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

function readTextFileOrEmpty(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function createPatchArtifacts({
  repoRoot,
  patchCandidates = [],
}: {
  repoRoot: string;
  patchCandidates?: CiPatchCandidate[];
}): CiPatchArtifact[] {
  const artifacts: CiPatchArtifact[] = [];
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

function pickOverallVerdict(verdicts: CiPolicyVerdictValue[] = []): CiPolicyVerdictValue {
  if (verdicts.length === 0) {
    return "allow";
  }
  return verdicts.reduce<CiPolicyVerdictValue>((current, verdict) => {
    if ((VERDICT_PRECEDENCE[verdict] ?? VERDICT_PRECEDENCE.deny) > VERDICT_PRECEDENCE[current]) {
      return verdict;
    }
    return current;
  }, "allow");
}

function resolveRepoSnapshotRef(repoRoot: string): string | null {
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
  return null;
}

function createProvenance({
  repoRoot,
  policyVerdict,
  capabilityFlags,
  provenance = {},
}: {
  repoRoot: string;
  policyVerdict: CiPolicyVerdictValue;
  capabilityFlags: CiCapabilityFlags;
  provenance?: CiProvenanceInput;
}): CiProvenance {
  const explicitRunId =
    typeof provenance.ci_run_id === "string" && provenance.ci_run_id.trim() !== "";
  const ciRunId = explicitRunId ? (provenance.ci_run_id as string).trim() : randomUUID();
  const explicitSha =
    typeof provenance.commit_sha === "string" && provenance.commit_sha.trim() !== "";
  const commitSha = explicitSha
    ? (provenance.commit_sha as string).trim()
    : resolveRepoSnapshotRef(repoRoot);
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
    ci_run_id_origin: explicitRunId ? "explicit" : "generated",
    created_at:
      typeof provenance.created_at === "string" && provenance.created_at.trim() !== ""
        ? provenance.created_at
        : new Date().toISOString(),
    commit_sha: commitSha,
    repo_snapshot_ref: commitSha ?? "working-tree",
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

// Proposal provenance is fail-closed: a proposal artifact is valid only when
// the caller supplied an explicit run id, a real commit SHA, and the resolved
// capability declarations. Generated or missing provenance never writes.
export function validateProposalProvenance(provenance: CiProvenance): string[] {
  const errors: string[] = [];
  if (provenance.ci_run_id_origin !== "explicit" || provenance.ci_run_id.trim() === "") {
    errors.push("ci-provenance-run-id-missing: caller must supply ci_run_id");
  }
  if (typeof provenance.commit_sha !== "string" || provenance.commit_sha.trim() === "") {
    errors.push("ci-provenance-commit-sha-missing: caller must supply commit_sha");
  }
  if (!provenance.capability_flags || typeof provenance.capability_flags !== "object") {
    errors.push("ci-provenance-capabilities-missing: resolved capability flags required");
  }
  return errors;
}

function sanitizeArtifactName(value: string): string | null {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, "-");
  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    return null;
  }
  return cleaned;
}

function atomicWrite(filePath: string, contents: string): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, contents, "utf8");
  renameSync(tmpPath, filePath);
}

// Proposals are files under .pairslash/staging/ci-proposals/<ci_run_id>/ —
// never auto-applied, never written anywhere else. There is no apply path.
export function writeCiProposals({
  repoRoot,
  runResult,
}: {
  repoRoot: string;
  runResult: {
    artifacts?: CiPatchArtifact[];
    provenance?: CiProvenance;
  };
}): CiProposalWriteResult {
  const stagingDir = resolve(repoRoot, CI_PROPOSALS_STAGING_DIR);
  const result: CiProposalWriteResult = {
    kind: "ci-proposal-write-result",
    schema_version: "0.1.0",
    staging_dir: normalizePath(relative(repoRoot, stagingDir)),
    run_dir: null,
    written: [],
    refused: false,
    errors: [],
  };

  const artifacts = Array.isArray(runResult.artifacts) ? runResult.artifacts : [];
  if (artifacts.length === 0) {
    return result;
  }
  if (!runResult.provenance) {
    result.refused = true;
    result.errors.push("ci-proposals-refused: provenance record absent");
    return result;
  }
  const provenanceErrors = validateProposalProvenance(runResult.provenance);
  if (provenanceErrors.length > 0) {
    result.refused = true;
    result.errors.push(...provenanceErrors);
    return result;
  }

  const runDirName = sanitizeArtifactName(runResult.provenance.ci_run_id);
  if (runDirName === null) {
    result.refused = true;
    result.errors.push("ci-proposals-refused: ci_run_id is not a safe directory name");
    return result;
  }
  const runDir = resolve(stagingDir, runDirName);
  if (!isPathInside(stagingDir, runDir)) {
    result.refused = true;
    result.errors.push("ci-proposals-refused: run dir escapes staging boundary");
    return result;
  }

  const written: string[] = [];
  const indexEntries: unknown[] = [];
  for (const artifact of artifacts) {
    const artifactName = sanitizeArtifactName(artifact.artifact_id);
    if (artifactName === null) {
      result.errors.push(`ci-proposal-skipped: artifact id is not a safe file name: ${artifact.artifact_id}`);
      continue;
    }
    const patchPath = join(runDir, `${artifactName}.patch`);
    if (!isPathInside(runDir, patchPath)) {
      result.errors.push(`ci-proposal-skipped: artifact path escapes run dir: ${artifact.artifact_id}`);
      continue;
    }
    mkdirSync(runDir, { recursive: true });
    atomicWrite(patchPath, artifact.diff);
    written.push(normalizePath(relative(repoRoot, patchPath)));
    indexEntries.push({
      artifact_id: artifact.artifact_id,
      label: artifact.label,
      authoritative: false,
      truth_tier: "supplemental",
      apply_mode: "manual-only",
      target_path: artifact.target_path,
      patch_file: `${artifactName}.patch`,
      description: artifact.description,
    });
  }

  if (written.length > 0) {
    const indexPath = join(runDir, "proposals.yaml");
    atomicWrite(
      indexPath,
      stableYaml({
        kind: "ci-proposal-index",
        schema_version: "0.1.0",
        ci_run_id: runResult.provenance.ci_run_id,
        commit_sha: runResult.provenance.commit_sha,
        capability_flags: runResult.provenance.capability_flags,
        authoritative: false,
        apply_mode: "manual-only",
        proposals: indexEntries,
      }),
    );
    written.push(normalizePath(relative(repoRoot, indexPath)));
  }

  result.run_dir = written.length > 0
    ? normalizePath(relative(repoRoot, runDir))
    : null;
  result.written = written;
  return result;
}

function buildTraceSupportHint({
  report,
  artifacts,
  provenance,
}: {
  report: { status: string };
  artifacts: CiPatchArtifact[];
  provenance: CiProvenance;
}) {
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
      source_module: "src/runner.ts",
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

function toOutcome(verdict: CiPolicyVerdictValue): "blocked" | "allow" {
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
}: {
  checks?: CiCheckInput[];
  patchCandidates?: CiPatchCandidate[];
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
}: {
  repoRoot?: string;
  invocation?: string;
  capabilities?: Partial<CiCapabilityFlags>;
  repoPolicyExplicit?: boolean;
  checks?: CiCheckInput[];
  patchCandidates?: CiPatchCandidate[];
  provenance?: CiProvenanceInput;
  maxScanFiles?: number;
  maxFileBytes?: number;
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

  const activeVerdicts: CiPolicyVerdict[] = [readRepoVerdict, runChecksVerdict];

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

  let patchArtifacts: CiPatchArtifact[] = [];
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

  const guardrailVerdicts: CiPolicyVerdict[] = [
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
