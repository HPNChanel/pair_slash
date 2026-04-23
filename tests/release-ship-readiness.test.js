import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { repoRoot } from "./phase4-helpers.js";

test("package scripts expose ship gate and compat diagnostic aliases", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts["test:release"], "node scripts/run-release-readiness.mjs");
  assert.equal(pkg.scripts["test:release:ship"], "node scripts/run-release-ship-readiness.mjs");
  assert.equal(pkg.scripts["test:support"], "node scripts/verify-supportability-surfaces.mjs");
  assert.equal(pkg.scripts["test:compat:release"], "node scripts/run-compat-lab-release-readiness.mjs");
  assert.equal(
    pkg.scripts["test:compat:release:diagnostic"],
    "node scripts/run-compat-lab-release-readiness.mjs",
  );
});

test("release-readiness gate runs strict compat checks and not diagnostic shim logic", () => {
  const script = readFileSync(join(repoRoot, "scripts", "run-release-readiness.mjs"), "utf8");
  assert.ok(script.includes('runNodeScript(["scripts/verify-supportability-surfaces.mjs"])'));
  assert.ok(script.includes('runNodeScript(["scripts/sync-compat-lab-artifacts.mjs", "--check"])'));
  assert.ok(script.includes('runNodeScript(["scripts/run-compat-lab-tests.mjs"])'));
  assert.equal(script.includes('runNodeScript(["scripts/run-compat-lab-release-readiness.mjs"])'), false);
});

test("compat artifact check remains deterministic on unchanged repository state", () => {
  const result = spawnSync(process.execPath, ["scripts/sync-compat-lab-artifacts.mjs", "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("supportability surface verification passes on repository truth set", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-supportability-surfaces.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("release candidate evidence verifier rejects placeholders and accepts complete records", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pairslash-release-evidence-"));
  try {
    const validEvidencePath = join(tempRoot, "valid.md");
    writeFileSync(
      validEvidencePath,
      `---
schema_version: "1.0.0"
release_line: "0.4.0"
release_tag: "v0.4.0-rc1"
release_commit_binding: "9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f"
workflow:
  name: "release-trust-candidate"
  run_id: "123456789"
  run_url: "https://github.com/example/pairslash/actions/runs/123456789"
  conclusion: "success"
  ref: "refs/tags/v0.4.0-rc1"
  commit_sha: "9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f"
artifact:
  name: "release-trust-bundle-candidate"
  path: "artifacts/release-trust"
  verify_mode: "signed"
  verify_command: "node scripts/verify-release-trust.mjs --trust-dir artifacts/release-trust"
  verify_result: "pass"
  key_id: "pairslash-release-key-2026"
checklist_path: "docs-private/releases/release-checklist-0.4.0.md"
scoped_verdict_path: "docs/releases/scoped-release-verdict.md"
recorded_by: "maintainer@example.com"
recorded_at_utc: "2026-04-23T12:34:56Z"
---

# valid evidence
`,
      "utf8",
    );

    const validResult = spawnSync(
      process.execPath,
      [
        "scripts/verify-release-candidate-evidence.mjs",
        "--repo-root",
        repoRoot,
        "--evidence",
        validEvidencePath,
        "--release-line",
        "0.4.0",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    assert.equal(validResult.status, 0, validResult.stderr || validResult.stdout);

    const invalidEvidencePath = join(tempRoot, "invalid.md");
    writeFileSync(
      invalidEvidencePath,
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

# invalid evidence
`,
      "utf8",
    );

    const invalidResult = spawnSync(
      process.execPath,
      [
        "scripts/verify-release-candidate-evidence.mjs",
        "--repo-root",
        repoRoot,
        "--evidence",
        invalidEvidencePath,
        "--release-line",
        "0.4.0",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    assert.notEqual(invalidResult.status, 0, invalidResult.stdout);
    assert.match(invalidResult.stderr, /release-candidate evidence validation failed/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
