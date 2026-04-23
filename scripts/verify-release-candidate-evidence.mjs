import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import YAML from "yaml";

import { stableJson } from "@pairslash/spec-core";

const DEFAULT_EVIDENCE_PATH = "docs-private/releases/release-candidate-evidence-0.4.0.md";
const REQUIRED_WORKFLOW_NAME = "release-trust-candidate";
const REQUIRED_ARTIFACT_NAME = "release-trust-bundle-candidate";
const REQUIRED_ARTIFACT_PATH = "artifacts/release-trust";
const REQUIRED_CHECKLIST_PATH = "docs-private/releases/release-checklist-0.4.0.md";
const REQUIRED_VERDICT_PATH = "docs/releases/scoped-release-verdict.md";

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    evidencePath: DEFAULT_EVIDENCE_PATH,
    releaseLine: null,
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
    throw new Error(`unknown flag: ${token}`);
  }
  return options;
}

function loadReleaseLine(repoRoot) {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  return pkg.version;
}

function loadFrontMatter(markdownText, evidencePath) {
  const match = markdownText.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`missing YAML front matter in ${evidencePath}`);
  }
  const parsed = YAML.parse(match[1]);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`invalid YAML front matter in ${evidencePath}`);
  }
  return parsed;
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

function requireExactString(value, expected, label, failures) {
  if (normalizeValue(value) !== expected) {
    failures.push(`${label} must be '${expected}'`);
  }
}

function requireNonPlaceholderString(value, label, failures) {
  if (isPlaceholder(value)) {
    failures.push(`${label} must be recorded and cannot be placeholder text`);
  }
}

function validateEvidence(record, expectedReleaseLine) {
  const failures = [];
  const workflow = record.workflow ?? {};
  const artifact = record.artifact ?? {};

  requireExactString(record.schema_version, "1.0.0", "schema_version", failures);
  requireExactString(record.release_line, expectedReleaseLine, "release_line", failures);

  requireExactString(workflow.name, REQUIRED_WORKFLOW_NAME, "workflow.name", failures);
  requireNonPlaceholderString(workflow.run_id, "workflow.run_id", failures);
  if (!/^\d+$/.test(normalizeValue(workflow.run_id))) {
    failures.push("workflow.run_id must be a numeric GitHub run id");
  }
  requireNonPlaceholderString(workflow.run_url, "workflow.run_url", failures);
  if (!normalizeValue(workflow.run_url).startsWith("https://github.com/")) {
    failures.push("workflow.run_url must point to a GitHub run URL");
  }
  requireExactString(workflow.conclusion, "success", "workflow.conclusion", failures);
  requireNonPlaceholderString(workflow.ref, "workflow.ref", failures);
  requireNonPlaceholderString(workflow.commit_sha, "workflow.commit_sha", failures);
  if (!/^[0-9a-f]{40}$/i.test(normalizeValue(workflow.commit_sha))) {
    failures.push("workflow.commit_sha must be a 40-character git SHA");
  }

  requireExactString(artifact.name, REQUIRED_ARTIFACT_NAME, "artifact.name", failures);
  requireExactString(artifact.path, REQUIRED_ARTIFACT_PATH, "artifact.path", failures);
  requireExactString(artifact.verify_mode, "signed", "artifact.verify_mode", failures);
  requireNonPlaceholderString(artifact.verify_command, "artifact.verify_command", failures);
  if (!normalizeValue(artifact.verify_command).includes("scripts/verify-release-trust.mjs")) {
    failures.push("artifact.verify_command must invoke scripts/verify-release-trust.mjs");
  }
  requireExactString(artifact.verify_result, "pass", "artifact.verify_result", failures);
  requireNonPlaceholderString(artifact.key_id, "artifact.key_id", failures);

  requireExactString(record.checklist_path, REQUIRED_CHECKLIST_PATH, "checklist_path", failures);
  requireExactString(record.scoped_verdict_path, REQUIRED_VERDICT_PATH, "scoped_verdict_path", failures);
  requireNonPlaceholderString(record.recorded_by, "recorded_by", failures);
  requireNonPlaceholderString(record.recorded_at_utc, "recorded_at_utc", failures);
  const recordedAt = Date.parse(normalizeValue(record.recorded_at_utc));
  if (Number.isNaN(recordedAt)) {
    failures.push("recorded_at_utc must be a valid ISO-8601 timestamp");
  }
  requireNonPlaceholderString(record.release_tag, "release_tag", failures);
  requireNonPlaceholderString(record.release_commit_binding, "release_commit_binding", failures);

  return failures;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const releaseLine = options.releaseLine ?? loadReleaseLine(options.repoRoot);
  const evidencePath = resolve(options.repoRoot, options.evidencePath);

  if (!existsSync(evidencePath)) {
    console.error(`release-candidate evidence file not found: ${evidencePath}`);
    process.exit(1);
  }

  let record;
  try {
    const markdownText = readFileSync(evidencePath, "utf8");
    record = loadFrontMatter(markdownText, evidencePath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const failures = validateEvidence(record, releaseLine);
  if (failures.length > 0) {
    console.error("release-candidate evidence validation failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  process.stdout.write(
    stableJson({
      kind: "release-candidate-evidence-verification",
      evidence_path: options.evidencePath,
      release_line: releaseLine,
      workflow_run_id: normalizeValue(record.workflow.run_id),
      artifact_name: normalizeValue(record.artifact.name),
      verified: true,
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
