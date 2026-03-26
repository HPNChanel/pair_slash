import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import {
  applyMemoryWrite,
  loadStagedMemoryWritePreview,
  previewMemoryWrite,
} from "../src/index.js";
import { createTempRepo } from "../../../tests/phase4-helpers.js";

const serial = { concurrency: false };
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function seedMemoryIndex(repoRoot) {
  const indexPath = join(repoRoot, ".pairslash", "project-memory", "90-memory-index.yaml");
  mkdirSync(join(repoRoot, ".pairslash", "project-memory"), { recursive: true });
  writeFileSync(
    indexPath,
    YAML.stringify(
      {
        version: "0.1.0",
        last_updated: "2026-03-26T00:00:00.000Z",
        updated_by: "tests",
        records: [],
      },
      { lineWidth: 0, simpleKeys: true },
    ),
  );
}

function loadFixture(name) {
  return YAML.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function setupMemoryRepo() {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  mkdirSync(join(fixture.tempRoot, ".pairslash", "project-memory"), { recursive: true });
  mkdirSync(join(fixture.tempRoot, ".pairslash", "audit-log"), { recursive: true });
  mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });
  mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
  mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
  seedMemoryIndex(fixture.tempRoot);
  return {
    fixture,
    appendRequest: loadFixture("request-constraint.yaml"),
    supersedeRequest: loadFixture("request-pattern-supersede.yaml"),
  };
}

function writeAuthoritativeRecord(repoRoot, relativePath, record) {
  const absolutePath = join(repoRoot, ".pairslash", "project-memory", relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, YAML.stringify(record, { lineWidth: 0, simpleKeys: true }));
}

function writeTaskRecord(repoRoot, relativePath, record) {
  const absolutePath = join(repoRoot, ".pairslash", "task-memory", relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, YAML.stringify(record, { lineWidth: 0, simpleKeys: true }));
}

test("previewMemoryWrite blocks hidden write, persists staging artifact, and keeps project-memory unchanged", serial, () => {
  const { fixture, appendRequest } = setupMemoryRepo();
  try {
    const preview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
      policyContext: {
        hidden_write_attempted: true,
      },
    });
    assert.equal(preview.policy_verdict.overall_verdict, "deny");
    assert.equal(preview.staging_artifact.exists, true);
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml")),
      false,
    );
    assert.equal(existsSync(join(fixture.tempRoot, preview.staging_artifact.path)), true);
  } finally {
    fixture.cleanup();
  }
});

test("applyMemoryWrite blocks direct authoritative write when preview artifact is missing", serial, () => {
  const { fixture, appendRequest } = setupMemoryRepo();
  try {
    const result = applyMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(result.status, "denied");
    assert.ok(result.errors.some((entry) => entry.startsWith("preview-required:")));
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml")),
      false,
    );
  } finally {
    fixture.cleanup();
  }
});

test("previewMemoryWrite plus applyMemoryWrite commits append, creates audit log, and updates index deterministically", serial, () => {
  const { fixture, appendRequest } = setupMemoryRepo();
  try {
    const preview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(preview.ready_for_apply, true);
    const stagedPreview = loadStagedMemoryWritePreview({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.ok(stagedPreview);

    const result = applyMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(result.status, "committed");
    assert.equal(result.committed, true);
    assert.ok(result.audit_log_path.endsWith(".yaml"));
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml")),
      true,
    );
    const index = YAML.parse(
      readFileSync(join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"), "utf8"),
    );
    assert.ok(index.records.some((entry) => entry.title === appendRequest.title && entry.status === "active"));
  } finally {
    fixture.cleanup();
  }
});

test("valid supersede reuses authoritative target file and refreshes the indexed authoritative entry", serial, () => {
  const { fixture, supersedeRequest } = setupMemoryRepo();
  try {
    writeAuthoritativeRecord(
      fixture.tempRoot,
      "70-known-good-patterns/candidate-extraction-phai-reconcile-voi-authoritative-memo.yaml",
      {
        kind: "pattern",
        title: "Candidate extraction phải reconcile với authoritative memory trước khi giữ candidate",
        statement: "Old statement that should be superseded.",
        evidence: "legacy",
        scope: "whole-project",
        confidence: "high",
        action: "append",
        tags: ["candidate"],
        source_refs: ["legacy"],
        updated_by: "tests",
        timestamp: "2026-03-26T00:30:00.000Z",
      },
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"),
      YAML.stringify(
        {
          version: "0.1.0",
          last_updated: "2026-03-26T00:30:00.000Z",
          updated_by: "tests",
          records: [
            {
              file: "70-known-good-patterns/candidate-extraction-phai-reconcile-voi-authoritative-memo.yaml",
              kind: "pattern",
              title: "Candidate extraction phải reconcile với authoritative memory trước khi giữ candidate",
              scope: "whole-project",
              status: "active",
              record_family: "mutable",
            },
          ],
        },
        { lineWidth: 0, simpleKeys: true },
      ),
    );
    const preview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: supersedeRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(
      preview.preview_patch.target_file,
      ".pairslash/project-memory/70-known-good-patterns/candidate-extraction-phai-reconcile-voi-authoritative-memo.yaml",
    );
    const result = applyMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: supersedeRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(result.status, "committed");
    const index = YAML.parse(
      readFileSync(join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"), "utf8"),
    );
    assert.ok(index.records.some((entry) => entry.title === supersedeRequest.title && entry.status === "active"));
    assert.ok(index.records.some((entry) => entry.title === supersedeRequest.title && entry.scope === "subsystem"));
  } finally {
    fixture.cleanup();
  }
});

test("duplicate authoritative record is blocked after preview and returns machine-readable conflict result", serial, () => {
  const { fixture, appendRequest } = setupMemoryRepo();
  try {
    previewMemoryWrite({ repoRoot: fixture.tempRoot, request: appendRequest, runtime: "codex_cli", target: "repo" });
    applyMemoryWrite({ repoRoot: fixture.tempRoot, request: appendRequest, runtime: "codex_cli", target: "repo" });
    const secondPreview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(secondPreview.ready_for_apply, false);
    const second = applyMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(second.status, "conflict");
    assert.ok(second.errors.some((entry) => entry.startsWith("duplicate:")));
    assert.equal(second.policy_verdict.machine_readable, true);
  } finally {
    fixture.cleanup();
  }
});

test("conflict detection blocks mismatched authoritative statement in the same scope", serial, () => {
  const { fixture, appendRequest } = setupMemoryRepo();
  try {
    writeAuthoritativeRecord(fixture.tempRoot, "50-constraints.yaml", {
      kind: "constraint",
      title: "Preview required before memory commit",
      statement: "A conflicting authoritative statement already exists.",
      evidence: "existing",
      scope: "whole-project",
      confidence: "high",
      action: "append",
      tags: ["preview"],
      source_refs: ["existing"],
      updated_by: "tests",
      timestamp: "2026-03-26T00:10:00.000Z",
    });
    const preview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(preview.ready_for_apply, false);
    assert.ok(preview.errors.some((entry) => entry.startsWith("conflict:")));
  } finally {
    fixture.cleanup();
  }
});

test("authoritative memory write is blocked when invoked from a read-only workflow context", serial, () => {
  const { fixture, appendRequest } = setupMemoryRepo();
  try {
    const preview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: appendRequest,
      runtime: "codex_cli",
      target: "repo",
      policyContext: {
        workflow_class: "read-oriented",
        authority_mode: "read-only",
        read_only_workflow: true,
      },
    });
    assert.equal(preview.policy_verdict.overall_verdict, "deny");
    assert.ok(preview.errors.some((entry) => entry === "authority:read-only-workflow"));
  } finally {
    fixture.cleanup();
  }
});

test("reject-candidate-if-conflict requires an explicit conflicting task candidate instead of implicitly promoting it", serial, () => {
  const { fixture, appendRequest } = setupMemoryRepo();
  try {
    const request = {
      ...appendRequest,
      action: "reject-candidate-if-conflict",
    };
    const blocked = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(blocked.ready_for_apply, false);
    assert.ok(
      blocked.errors.includes("reject-candidate-if-conflict requires a conflicting task/session/staging candidate"),
    );

    writeTaskRecord(fixture.tempRoot, "candidate-preview.yaml", {
      ...appendRequest,
      statement: "Candidate says preview can be skipped.",
      updated_by: "candidate",
    });
    const resolved = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request,
      runtime: "codex_cli",
      target: "repo",
    });
    assert.ok(resolved.conflict_matches.some((entry) => entry.layer === "task-memory"));
  } finally {
    fixture.cleanup();
  }
});
