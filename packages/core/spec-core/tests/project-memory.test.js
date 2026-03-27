import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import {
  loadProjectMemoryRecords,
  validateMutableProjectMemoryRecord,
  validateProjectMemoryIndex,
  validateProjectMemoryStructure,
  validateSystemRecord,
} from "@pairslash/spec-core";

import { repoRoot } from "../../../../tests/phase4-helpers.js";

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
    phase: 2,
    identity: {},
    runtimes: {},
    canonical_entrypoint: "/skills",
    provenance: {},
  };

  assert.ok(validateSystemRecord(broken).includes("missing field: core_principles"));
});
