import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runRetrievalQuery,
  resolveRetrievedFactAgainstGlobalMemory,
} from "../src/index.ts";

function withTempDir(run) {
  const root = mkdtempSync(join(tmpdir(), "pairslash-retrieval-"));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function seededDir(root) {
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, "docs", "note.md"), "retrieval boundary stays read-only");
}

const enabledRepoSource = {
  capabilities: { retrieval_enabled: true, retrieval_repo_local: true },
  sources: [{ id: "docs", kind: "repo_local", path: "docs" }],
};

test("write-shaped apply request is denied fail-closed", () => {
  withTempDir((root) => {
    seededDir(root);
    const result = runRetrievalQuery({
      repoRoot: root,
      query: "retrieval boundary",
      ...enabledRepoSource,
      apply: true,
    });
    assert.equal(result.write_shaped, true);
    assert.equal(result.results.length, 0);
    const report = result.source_reports[0];
    assert.equal(report.policy.overall_verdict, "deny");
    assert.ok(report.policy.reasons.some((r) => r.code === "RETRIEVAL-HIDDEN-WRITE"));
  });
});

test("promote-shaped request is denied via retrieval.memory.promote decision", () => {
  withTempDir((root) => {
    seededDir(root);
    const result = runRetrievalQuery({
      repoRoot: root,
      query: "retrieval boundary",
      ...enabledRepoSource,
      operation: "promote-fact",
    });
    assert.equal(result.write_shaped, true);
    assert.equal(result.results.length, 0);
    const report = result.source_reports[0];
    assert.equal(report.policy.overall_verdict, "deny");
    assert.ok(report.policy.reasons.some((r) => r.code === "RETRIEVAL-PROMOTE-DENIED"));
  });
});

test("hidden_write_attempted flag denies the query", () => {
  withTempDir((root) => {
    seededDir(root);
    const result = runRetrievalQuery({
      repoRoot: root,
      query: "retrieval boundary",
      ...enabledRepoSource,
      hidden_write_attempted: true,
    });
    assert.equal(result.write_shaped, true);
    assert.equal(result.results.length, 0);
    assert.ok(
      result.source_reports[0].policy.reasons.some((r) => r.code === "RETRIEVAL-HIDDEN-WRITE"),
    );
  });
});

test("envelope labels stay supplemental and non-authoritative", () => {
  withTempDir((root) => {
    seededDir(root);
    const result = runRetrievalQuery({
      repoRoot: root,
      query: "read-only",
      ...enabledRepoSource,
    });
    assert.equal(result.authoritative, false);
    assert.equal(result.truth_tier, "supplemental");
    assert.equal(result.label, "retrieved");
    assert.equal(result.write_shaped, false);
    assert.ok(result.results.length > 0);
    for (const envelope of result.results) {
      assert.equal(envelope.authoritative, false);
      assert.equal(envelope.truth_tier, "supplemental");
      assert.equal(envelope.label, "retrieved");
    }
  });
});

test("query leaves the source tree byte-identical (read-only, no write syscalls)", () => {
  withTempDir((root) => {
    seededDir(root);
    const before = readdirSync(join(root, "docs")).sort();
    const result = runRetrievalQuery({
      repoRoot: root,
      query: "boundary",
      ...enabledRepoSource,
    });
    assert.ok(result.results.length > 0);
    const after = readdirSync(join(root, "docs")).sort();
    assert.deepEqual(after, before);
    assert.equal(readdirSync(root).sort().join(","), "docs");
  });
});

test("external source kind is always denied", () => {
  const result = runRetrievalQuery({
    repoRoot: ".",
    query: "anything",
    capabilities: { retrieval_enabled: true },
    sources: [{ id: "net", kind: "external", path: "remote" }],
  });
  assert.equal(result.source_reports[0].policy.overall_verdict, "deny");
  assert.ok(
    result.source_reports[0].policy.reasons.some((r) => r.code === "RETRIEVAL-EXTERNAL-DENIED"),
  );
});

test("runtime-bound request evaluates through the policy engine", () => {
  withTempDir((root) => {
    seededDir(root);
    const clean = runRetrievalQuery({
      repoRoot: root,
      query: "read-only",
      runtime: "codex_cli",
      target: "repo",
      ...enabledRepoSource,
    });
    assert.ok(clean.engine_verdict !== null);
    assert.equal(clean.engine_verdict.overall_verdict !== "deny", true);
    assert.ok(clean.results.length > 0);

    const hostile = runRetrievalQuery({
      repoRoot: root,
      query: "read-only",
      runtime: "codex_cli",
      target: "repo",
      hidden_write_attempted: true,
      ...enabledRepoSource,
    });
    assert.equal(hostile.engine_verdict.overall_verdict, "deny");
    assert.equal(hostile.results.length, 0);
  });
});

test("conflict resolution always yields to global memory", () => {
  const resolution = resolveRetrievedFactAgainstGlobalMemory({
    factKey: "runtime.entry",
    retrievedValue: "/prompts",
    globalMemoryRecords: [{ key: "runtime.entry", value: "/skills" }],
  });
  assert.equal(resolution.winner, "global_memory");
  assert.equal(resolution.conflict, true);
  assert.equal(resolution.authoritative_source, "global_project_memory");
});
