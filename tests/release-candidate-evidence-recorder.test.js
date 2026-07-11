import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";

import { repoRoot } from "./phase4-helpers.js";

function parseFrontMatter(markdownText) {
  const match = markdownText.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, "missing front matter");
  const parsed = YAML.parse(match[1]);
  assert.equal(typeof parsed, "object");
  return parsed;
}

test("release-candidate evidence recorder writes validated production-ready metadata", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pairslash-release-evidence-recorder-"));
  const evidencePath = join(tempRoot, "release-candidate-evidence-0.4.0.md");

  try {
    writeFileSync(
      evidencePath,
      `---
schema_version: "1.0.0"
release_line: "0.4.0"
release_tag: "pending"
release_commit_binding: "pending"
workflow:
  name: "release-trust-candidate"
  run_id: "pending"
  run_url: "pending"
  conclusion: "pending"
  ref: "pending"
  commit_sha: "pending"
artifact:
  name: "release-trust-bundle-candidate"
  path: "artifacts/release-trust"
  verify_mode: "signed"
  verify_command: "node scripts/verify-release-trust.mjs --trust-dir artifacts/release-trust"
  verify_result: "pending"
  key_id: "pending"
checklist_path: "docs-private/releases/release-checklist-0.4.0.md"
scoped_verdict_path: "docs/releases/scoped-release-verdict.md"
recorded_by: "pending"
recorded_at_utc: "pending"
---

# placeholder
`,
      "utf8",
    );

    const runId = "123456789";
    const runUrl = "https://github.com/HPNChanel/pair_slash/actions/runs/123456789";
    const releaseTag = "v0.4.0-rc1";
    const commitSha = "9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f";
    const result = spawnSync(
      process.execPath,
      [
        "scripts/record-release-candidate-evidence.mjs",
        "--evidence",
        evidencePath,
        "--release-line",
        "0.4.0",
        "--run-id",
        runId,
        "--run-url",
        runUrl,
        "--conclusion",
        "success",
        "--ref",
        "refs/tags/v0.4.0-rc1",
        "--commit-sha",
        commitSha,
        "--release-tag",
        releaseTag,
        "--release-commit-binding",
        commitSha,
        "--key-id",
        "pairslash-release-key-2026",
        "--recorded-by",
        "maintainer@example.com",
        "--recorded-at-utc",
        "2026-04-23T12:34:56Z",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const recorded = parseFrontMatter(readFileSync(evidencePath, "utf8"));
    assert.equal(recorded.workflow.run_id, runId);
    assert.equal(recorded.workflow.run_url, runUrl);
    assert.equal(recorded.release_tag, releaseTag);
    assert.equal(recorded.artifact.key_id, "pairslash-release-key-2026");
    assert.equal(recorded.artifact.verify_result, "pass");
    assert.equal(recorded.recorded_by, "maintainer@example.com");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("release-candidate evidence recorder rejects missing required metadata", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pairslash-release-evidence-recorder-"));
  const evidencePath = join(tempRoot, "release-candidate-evidence-0.4.0.md");

  try {
    writeFileSync(
      evidencePath,
      `---
schema_version: "1.0.0"
release_line: "0.4.0"
release_tag: "pending"
release_commit_binding: "pending"
workflow:
  name: "release-trust-candidate"
  run_id: "pending"
  run_url: "pending"
  conclusion: "pending"
  ref: "pending"
  commit_sha: "pending"
artifact:
  name: "release-trust-bundle-candidate"
  path: "artifacts/release-trust"
  verify_mode: "signed"
  verify_command: "node scripts/verify-release-trust.mjs --trust-dir artifacts/release-trust"
  verify_result: "pending"
  key_id: "pending"
checklist_path: "docs-private/releases/release-checklist-0.4.0.md"
scoped_verdict_path: "docs/releases/scoped-release-verdict.md"
recorded_by: "pending"
recorded_at_utc: "pending"
---

# placeholder
`,
      "utf8",
    );

    const result = spawnSync(
      process.execPath,
      [
        "scripts/record-release-candidate-evidence.mjs",
        "--evidence",
        evidencePath,
        "--release-line",
        "0.4.0",
        "--run-id",
        "123456789",
        "--run-url",
        "https://github.com/HPNChanel/pair_slash/actions/runs/123456789",
        "--conclusion",
        "success",
        "--ref",
        "refs/tags/v0.4.0-rc1",
        "--commit-sha",
        "9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f",
        "--release-tag",
        "v0.4.0-rc1",
        "--release-commit-binding",
        "9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f",
        "--recorded-by",
        "maintainer@example.com",
        "--recorded-at-utc",
        "2026-04-23T12:34:56Z",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /artifact.key_id must be recorded and cannot be placeholder text/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
