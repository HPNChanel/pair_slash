import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import {
  getReadWorkflowProfile,
  loadProjectMemoryRecords,
  listReadWorkflowPaths,
  resolveReadAuthority,
  validateMutableProjectMemoryRecord,
  validateProjectMemoryIndex,
  validateProjectMemoryStructure,
  validateSystemRecord,
} from "@pairslash/spec-core";

import { repoRoot } from "../../../../tests/phase4-helpers.js";
import { createTempRepo } from "../../../../tests/phase4-helpers.js";

test("project memory structure and index stay valid in the normalized repo", () => {
  const structureErrors = validateProjectMemoryStructure(repoRoot);
  const loaded = loadProjectMemoryRecords(repoRoot);
  const index = YAML.parse(
    readFileSync(join(repoRoot, ".pairslash", "project-memory", "90-memory-index.yaml"), "utf8"),
  );

  const systemErrors = loaded.systemEntries.flatMap(({ relativePath, record }) =>
    validateSystemRecord(record).map((error) => `${relativePath} :: ${error}`),
  );
  const mutableErrors = loaded.mutableEntries.flatMap(({ relativePath, record }) =>
    validateMutableProjectMemoryRecord(record).map((error) => `${relativePath} :: ${error}`),
  );
  const indexErrors = validateProjectMemoryIndex(index, loaded);

  assert.deepEqual(structureErrors, []);
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(systemErrors, []);
  assert.deepEqual(mutableErrors, []);
  assert.deepEqual(indexErrors, []);
});

test("validateSystemRecord rejects missing charter fields", () => {
  const broken = {
    kind: "charter",
    title: "Broken Charter",
    version: "0.1.0",
    phase: "phase-12-truth-sync",
    identity: {},
    runtimes: {},
    canonical_entrypoint: "/skills",
    stage_statement: "PairSlash is currently at Phase 3.5 business validation.",
    truth_sources: {},
    provenance: {},
  };

  assert.ok(validateSystemRecord(broken).includes("missing field: core_principles"));
});

test("validateSystemRecord accepts charter pointer records with string phase identifiers", () => {
  const record = {
    kind: "charter",
    title: "PairSlash Project Charter",
    version: "0.2.0",
    phase: "phase-12-truth-sync",
    identity: {},
    runtimes: {},
    canonical_entrypoint: "/skills",
    core_principles: ["two-runtime discipline"],
    stage_statement: "PairSlash is currently at Phase 3.5 business validation.",
    truth_sources: {
      program_charter: "docs/phase-12/authoritative-program-charter.md",
    },
    provenance: {},
  };

  assert.deepEqual(validateSystemRecord(record), []);
});

test("shared read authority profile exposes index-backed memory-audit paths", () => {
  const profile = getReadWorkflowProfile("pairslash-memory-audit");

  assert.equal(profile.profile_id, "pairslash-memory-audit");
  assert.deepEqual(listReadWorkflowPaths(profile), [
    ".pairslash/project-memory/90-memory-index.yaml",
    ".pairslash/project-memory/",
    ".pairslash/task-memory/",
    ".pairslash/audit-log/",
  ]);
});

test("resolveReadAuthority uses the shared loader to resolve active authoritative sources", () => {
  const resolution = resolveReadAuthority({
    repoRoot,
    packId: "pairslash-memory-audit",
  });
  const globalLayer = resolution.layers.find((layer) => layer.layer === "global-project-memory");

  assert.equal(resolution.profile_id, "pairslash-memory-audit");
  assert.equal(resolution.uses_shared_loader, true);
  assert.ok(resolution.authoritative_sources.includes(".pairslash/project-memory/90-memory-index.yaml"));
  assert.ok(
    resolution.authoritative_sources.includes(".pairslash/project-memory/50-constraints.yaml"),
  );
  assert.equal(globalLayer?.resolution_mode, "project-memory-index");
  assert.equal(globalLayer?.resolution_status, "resolved");
  assert.ok((globalLayer?.resolved_records ?? []).length > 0);
  assert.deepEqual(resolution.warnings, []);
});

test("shared read authority enforces global > task > session > staging precedence", () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "sessions"), { recursive: true });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "staging"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "override.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: task layer override must not win",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "sessions", "override.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: session layer override must not win",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "staging", "override.yaml"),
      [
        "kind: constraint",
        "title: Codex CLI read-only sandbox blocks complex PowerShell patterns",
        "statement: staging layer override must not win",
        "scope: subsystem",
        "scope_detail: codex-cli",
      ].join("\n"),
    );

    const resolution = resolveReadAuthority({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-memory-candidate",
    });
    const globalLayer = resolution.layers.find((layer) => layer.layer === "global-project-memory");
    const taskLayer = resolution.layers.find((layer) => layer.layer === "task-memory");
    const sessionLayer = resolution.layers.find((layer) => layer.layer === "session");
    const stagingLayer = resolution.layers.find((layer) => layer.layer === "staging");
    const resolvedClaim = resolution.record_resolution.resolved_claims.find(
      (claim) =>
        claim.kind === "constraint" &&
        claim.title === "Codex CLI read-only sandbox blocks complex PowerShell patterns",
    );

    assert.deepEqual(resolution.record_resolution.precedence_rule.slice(0, 4), [
      "global-project-memory",
      "task-memory",
      "session",
      "staging",
    ]);
    assert.ok(globalLayer.precedence < taskLayer.precedence);
    assert.ok(taskLayer.precedence < sessionLayer.precedence);
    assert.ok(sessionLayer.precedence < stagingLayer.precedence);
    assert.equal(resolvedClaim.selected.layer, "global-project-memory");
    assert.equal(resolvedClaim.selected.authority, "authoritative");
    assert.ok(
      resolvedClaim.shadowed.some((entry) => entry.layer === "task-memory"),
    );
    assert.ok(
      resolvedClaim.shadowed.some((entry) => entry.layer === "session"),
    );
    assert.ok(
      resolvedClaim.shadowed.some((entry) => entry.layer === "staging"),
    );
    assert.ok(
      resolution.record_resolution.conflicts.some(
        (entry) =>
          entry.claim_key === resolvedClaim.claim_key &&
          entry.selected_layer === "global-project-memory" &&
          entry.shadowed_layer === "task-memory",
      ),
    );
    assert.ok(
      resolution.record_resolution.conflicts.some(
        (entry) =>
          entry.claim_key === resolvedClaim.claim_key &&
          entry.selected_layer === "global-project-memory" &&
          entry.shadowed_layer === "session",
      ),
    );
    assert.ok(
      resolution.record_resolution.conflicts.some(
        (entry) =>
          entry.claim_key === resolvedClaim.claim_key &&
          entry.selected_layer === "global-project-memory" &&
          entry.shadowed_layer === "staging",
      ),
    );
  } finally {
    fixture.cleanup();
  }
});

test("missing global claim is filled by lower layers without authority elevation", () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-candidate"] });
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "task-memory"), { recursive: true });
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "task-memory", "task-only.yaml"),
      [
        "kind: decision",
        "title: Task-only resolution candidate",
        "statement: task layer can fill when global has no claim",
        "scope: subsystem",
        "scope_detail: test-phase17",
      ].join("\n"),
    );

    const resolution = resolveReadAuthority({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-memory-candidate",
    });
    const taskOnlyClaim = resolution.record_resolution.resolved_claims.find(
      (claim) => claim.title === "Task-only resolution candidate",
    );

    assert.ok(taskOnlyClaim);
    assert.equal(taskOnlyClaim.selected.layer, "task-memory");
    assert.equal(taskOnlyClaim.selected.authority, "supporting");
    assert.equal(taskOnlyClaim.resolution_type, "supporting-gap-fill");
    assert.ok(
      resolution.record_resolution.gap_fills.some(
        (entry) =>
          entry.claim_key === taskOnlyClaim.claim_key &&
          entry.selected_layer === "task-memory",
      ),
    );
  } finally {
    fixture.cleanup();
  }
});
