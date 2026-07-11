import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import YAML from "yaml";

import { stableJson } from "@pairslash/spec-core";

const DEFAULT_EVIDENCE_PATH = "docs-private/releases/release-candidate-evidence-0.4.0.md";
const DEFAULT_RELEASE_LINE = "0.4.0";
const DEFAULT_WORKFLOW_NAME = "release-trust-candidate";
const DEFAULT_ARTIFACT_NAME = "release-trust-bundle-candidate";
const DEFAULT_ARTIFACT_PATH = "artifacts/release-trust";
const DEFAULT_ARTIFACT_VERIFY_COMMAND =
  "node scripts/verify-release-trust.mjs --trust-dir artifacts/release-trust";
const DEFAULT_ARTIFACT_VERIFY_MODE = "signed";

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    evidencePath: DEFAULT_EVIDENCE_PATH,
    releaseLine: DEFAULT_RELEASE_LINE,
    workflowName: DEFAULT_WORKFLOW_NAME,
    conclusion: "success",
    artifactName: DEFAULT_ARTIFACT_NAME,
    artifactPath: DEFAULT_ARTIFACT_PATH,
    artifactVerifyMode: DEFAULT_ARTIFACT_VERIFY_MODE,
    artifactVerifyCommand: DEFAULT_ARTIFACT_VERIFY_COMMAND,
    artifactVerifyResult: "pass",
    fromGithub: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo-root") {
      options.repoRoot = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--evidence") {
      options.evidencePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--release-line") {
      options.releaseLine = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--workflow-name") {
      options.workflowName = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--run-id") {
      options.workflowRunId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--run-url") {
      options.workflowRunUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--conclusion") {
      options.conclusion = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--ref") {
      options.workflowRef = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--commit-sha") {
      options.workflowCommitSha = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--release-tag") {
      options.releaseTag = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--release-commit-binding") {
      options.releaseCommitBinding = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--key-id") {
      options.artifactKeyId = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--artifact-verify-result") {
      options.artifactVerifyResult = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--recorded-by") {
      options.recordedBy = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--recorded-at-utc") {
      options.recordedAtUtc = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--from-github") {
      options.fromGithub = true;
      continue;
    }
    throw new Error(`unknown flag: ${token}`);
  }

  return options;
}

function normalizeValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function isPlaceholder(value) {
  const normalized = normalizeValue(value).toLowerCase();
  return normalized === "" || ["pending", "tbd", "todo", "n/a", "na", "unset"].includes(normalized);
}

function requireValue(value, label, failures) {
  if (isPlaceholder(value)) {
    failures.push(`${label} must be recorded and cannot be placeholder text`);
    return;
  }
  if (normalizeValue(value) === "") {
    failures.push(`${label} is required`);
  }
}

function requireExactString(value, expected, label, failures) {
  if (normalizeValue(value) !== expected) {
    failures.push(`${label} must be '${expected}'`);
  }
}

function requireNumeric(value, label, failures) {
  if (!/^\d+$/.test(normalizeValue(value))) {
    failures.push(`${label} must be a numeric GitHub run id`);
  }
}

function runValidation(record, releaseLine) {
  const failures = [];
  const workflow = record.workflow ?? {};

  requireExactString(record.schema_version, "1.0.0", "schema_version", failures);
  requireExactString(record.release_line, releaseLine, "release_line", failures);
  requireValue(record.release_tag, "release_tag", failures);
  requireValue(record.release_commit_binding, "release_commit_binding", failures);

  requireExactString(workflow.name, DEFAULT_WORKFLOW_NAME, "workflow.name", failures);
  requireValue(workflow.run_id, "workflow.run_id", failures);
  requireNumeric(workflow.run_id, "workflow.run_id", failures);
  if (!normalizeValue(workflow.run_url).startsWith("https://github.com/")) {
    failures.push("workflow.run_url must point to a GitHub run URL");
  }
  requireValue(workflow.run_url, "workflow.run_url", failures);
  requireExactString(workflow.conclusion, "success", "workflow.conclusion", failures);
  requireValue(workflow.ref, "workflow.ref", failures);
  requireValue(workflow.commit_sha, "workflow.commit_sha", failures);
  if (!/^[0-9a-f]{40}$/i.test(normalizeValue(workflow.commit_sha))) {
    failures.push("workflow.commit_sha must be a 40-character git SHA");
  }

  requireExactString(record.artifact.name, DEFAULT_ARTIFACT_NAME, "artifact.name", failures);
  requireExactString(record.artifact.path, DEFAULT_ARTIFACT_PATH, "artifact.path", failures);
  requireExactString(record.artifact.verify_mode, DEFAULT_ARTIFACT_VERIFY_MODE, "artifact.verify_mode", failures);
  requireValue(record.artifact.verify_command, "artifact.verify_command", failures);
  if (!normalizeValue(record.artifact.verify_command).includes("scripts/verify-release-trust.mjs")) {
    failures.push("artifact.verify_command must invoke scripts/verify-release-trust.mjs");
  }
  requireExactString(record.artifact.verify_result, "pass", "artifact.verify_result", failures);
  requireValue(record.artifact.key_id, "artifact.key_id", failures);

  requireValue(record.recorded_by, "recorded_by", failures);
  requireValue(record.recorded_at_utc, "recorded_at_utc", failures);
  if (Number.isNaN(Date.parse(normalizeValue(record.recorded_at_utc)))) {
    failures.push("recorded_at_utc must be a valid ISO-8601 timestamp");
  }

  return failures;
}

function requireEvidenceFile(path) {
  if (!existsSync(path)) {
    throw new Error(`release-candidate evidence file not found: ${path}`);
  }
}

function buildEvidenceFromOptions(options) {
  const runId = options.workflowRunId || process.env.GITHUB_RUN_ID || "";
  const repo = process.env.GITHUB_REPOSITORY || "";
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const ref = options.workflowRef || process.env.GITHUB_REF || "";
  const commitSha = options.workflowCommitSha || process.env.GITHUB_SHA || "";
  const runUrl =
    options.workflowRunUrl ||
    (runId && repo ? `${serverUrl}/${repo}/actions/runs/${runId}` : "");
  const tagFromRef = ref.startsWith("refs/tags/") ? ref.replace(/^refs\/tags\//, "") : "";

  return {
    schema_version: "1.0.0",
    release_line: options.releaseLine,
    release_tag: options.releaseTag || tagFromRef,
    release_commit_binding: options.releaseCommitBinding || commitSha,
    workflow: {
      name: options.workflowName,
      run_id: runId,
      run_url: runUrl,
      conclusion: options.conclusion,
      ref,
      commit_sha: commitSha,
    },
    artifact: {
      name: options.artifactName,
      path: options.artifactPath,
      verify_mode: options.artifactVerifyMode,
      verify_command: options.artifactVerifyCommand,
      verify_result: options.artifactVerifyResult,
      key_id: options.artifactKeyId || "",
    },
    checklist_path: "docs-private/releases/release-checklist-0.4.0.md",
    scoped_verdict_path: "docs/releases/scoped-release-verdict.md",
    recorded_by: options.recordedBy || process.env.GITHUB_ACTOR || "",
    recorded_at_utc: options.recordedAtUtc || new Date().toISOString(),
  };
}

function resolveFromGithubDefaults(options) {
  if (!options.fromGithub) {
    return options;
  }

  return {
    ...options,
    workflowRunId: options.workflowRunId || process.env.GITHUB_RUN_ID || "",
    workflowRunUrl:
      options.workflowRunUrl ||
      ((process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID)
        ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : ""),
    workflowRef: options.workflowRef || process.env.GITHUB_REF || "",
    workflowCommitSha: options.workflowCommitSha || process.env.GITHUB_SHA || "",
    releaseTag:
      options.releaseTag ||
      ((process.env.GITHUB_REF || "").startsWith("refs/tags/")
        ? process.env.GITHUB_REF.replace(/^refs\/tags\//, "")
        : options.releaseTag || ""),
    releaseCommitBinding: options.releaseCommitBinding || process.env.GITHUB_SHA || "",
    recordedBy: options.recordedBy || process.env.GITHUB_ACTOR || "",
    recordedAtUtc: options.recordedAtUtc || new Date().toISOString(),
    conclusion: options.conclusion || "success",
  };
}

function verifyWithGateway(evidencePath, releaseLine) {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/verify-release-candidate-evidence.mjs",
      "--evidence",
      evidencePath,
      "--release-line",
      releaseLine,
    ],
    { stdio: "pipe", encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "release-candidate evidence verification failed");
  }
  return result.stdout;
}

function stripBodyFromExisting(contents) {
  const match = contents.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    return "";
  }
  return match[1];
}

try {
  const options = resolveFromGithubDefaults(parseArgs(process.argv.slice(2)));
  const repoRoot = options.repoRoot;
  const evidencePath = resolve(repoRoot, options.evidencePath);

  requireEvidenceFile(evidencePath);

  const existingContents = readFileSync(evidencePath, "utf8");
  const body = stripBodyFromExisting(existingContents);
  const evidence = buildEvidenceFromOptions(options);

  if (options.fromGithub) {
    const failures = [];
    if (!options.workflowRunId) {
      failures.push("workflow.run_id must be available from --run-id or GITHUB_RUN_ID");
    }
    if (!options.workflowRunUrl) {
      failures.push("workflow.run_url must be available from --run-url, repository context, or GitHub env");
    }
    if (failures.length > 0) {
      throw new Error(failures.join("; "));
    }
  }

  const preflight = runValidation(evidence, options.releaseLine);
  if (preflight.length > 0) {
    throw new Error(`release-candidate evidence pre-validation failed: ${preflight.join("; ")}`);
  }

  const frontMatterText = YAML.stringify(evidence, {
    lineWidth: 1000,
  }).trim();

  writeFileSync(
    evidencePath,
    `---
${frontMatterText}
---

${body}`.trimStart(),
    "utf8",
  );

  const verifierOutput = verifyWithGateway(options.evidencePath, options.releaseLine);
  process.stdout.write(
    stableJson({
      kind: "release-candidate-evidence-recorded",
      evidence_path: options.evidencePath,
      release_line: options.releaseLine,
      release_tag: evidence.release_tag,
      workflow_run_id: evidence.workflow.run_id,
      verified: true,
      verifier_output: verifierOutput?.trim() || "verified",
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
