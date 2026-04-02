import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import { runCli } from "../../packages/tools/cli/src/bin/pairslash.js";
import {
  RETRIEVAL_CAPABILITY_DEFAULTS,
  RETRIEVAL_POLICY_CONTRACT,
  resolveRetrievedFactAgainstGlobalMemory,
  runRetrievalQuery,
} from "../../packages/advanced/retrieval-engine/src/index.js";
import { createTempRepo, repoRoot } from "../phase4-helpers.js";

const serial = { concurrency: false };

test("retrieval is disabled by default", serial, () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "docs"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, "docs", "retrieval-note.md"),
      "retrieval-boundary: explicit invocation only",
    );

    const result = runRetrievalQuery({
      repoRoot: fixture.tempRoot,
      invocation: "explicit",
      query: "retrieval-boundary",
      sources: [{ id: "repo", kind: "repo_local", path: "docs" }],
    });

    assert.equal(result.capability_flags.retrieval_enabled, false);
    assert.equal(result.results.length, 0);
    assert.equal(result.source_reports.length, 1);
    assert.equal(result.source_reports[0].policy.overall_verdict, "deny");
    assert.ok(result.source_reports[0].policy.reasons.some((reason) => reason.code === "RETRIEVAL-DISABLED"));
  } finally {
    fixture.cleanup();
  }
});

test("retrieval result stays labeled non-authoritative", serial, () => {
  const fixture = createTempRepo();
  try {
    mkdirSync(join(fixture.tempRoot, "artifacts"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, "artifacts", "phase11.txt"),
      "pairslash retrieval slice keeps global-memory authoritative",
    );

    const result = runRetrievalQuery({
      repoRoot: fixture.tempRoot,
      invocation: "explicit",
      query: "global-memory authoritative",
      capabilities: {
        retrieval_enabled: true,
        retrieval_repo_local: false,
        retrieval_artifact_index: true,
      },
      sources: [{ id: "artifacts", kind: "artifact_local", path: "artifacts" }],
    });

    assert.equal(result.authoritative, false);
    assert.equal(result.label, "retrieved");
    assert.equal(result.truth_tier, "supplemental");
    assert.ok(result.results.length > 0);
    assert.equal(result.results[0].authoritative, false);
    assert.equal(result.results[0].label, "retrieved");
    assert.equal(result.results[0].truth_tier, "supplemental");
  } finally {
    fixture.cleanup();
  }
});

test("retrieval conflict with Global Memory resolves to Global winner", serial, () => {
  const resolution = resolveRetrievedFactAgainstGlobalMemory({
    factKey: "build.test_command",
    retrievedValue: "npm run test:all",
    globalMemoryRecords: [
      {
        key: "build.test_command",
        value: "npm run test",
        source_path: ".pairslash/project-memory/20-commands.yaml",
      },
    ],
  });

  assert.equal(resolution.conflict, true);
  assert.equal(resolution.winner, "global_memory");
  assert.equal(resolution.effective_value, "npm run test");
  assert.equal(resolution.authoritative_source, "global_project_memory");
});

test("retrieval package absent does not break core lint command", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  const retrievalPackagePath = join(repoRoot, "packages", "advanced", "retrieval-engine");
  const temporaryMissingPath = join(repoRoot, "packages", "advanced", "retrieval-engine.__tmp_missing__");
  let output = "";

  if (existsSync(temporaryMissingPath)) {
    rmSync(temporaryMissingPath, { recursive: true, force: true });
  }

  try {
    assert.equal(existsSync(retrievalPackagePath), true);
    renameSync(retrievalPackagePath, temporaryMissingPath);

    const exitCode = await runCli({
      argv: ["lint", "pairslash-plan", "--runtime", "all", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });

    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "lint-report");
    assert.equal(payload.ok, true);
  } finally {
    if (existsSync(temporaryMissingPath)) {
      renameSync(temporaryMissingPath, retrievalPackagePath);
    }
    fixture.cleanup();
  }
});

test("advanced retrieval pack manifest stays aligned with lane capability defaults", serial, () => {
  const manifestPath = join(repoRoot, "packs", "advanced", "retrieval", "pack.manifest.yaml");
  const manifest = YAML.parse(readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.package.name, "@pairslash/retrieval-engine-advanced");
  assert.deepEqual(manifest.capability_flags, RETRIEVAL_CAPABILITY_DEFAULTS);
  assert.deepEqual(manifest.policy_contract.decisions, RETRIEVAL_POLICY_CONTRACT.decisions);
  assert.equal(manifest.policy_contract.no_hidden_write, true);
  assert.equal(manifest.policy_contract.no_implicit_promote, true);
});
