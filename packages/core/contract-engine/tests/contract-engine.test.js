import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { loadPackManifest, validateContractEnvelope } from "@pairslash/spec-core";

import {
  buildContractEnvelope,
  buildMemoryWriteContract,
  parseContractEnvelope,
  ContractEngineError,
  CONTRACT_ENGINE_ERROR_CODES,
} from "../src/index.js";
import { repoRoot } from "../../../../tests/phase4-helpers.js";

function loadJsonFixture(fileName) {
  return JSON.parse(readFileSync(join(repoRoot, "tests", "fixtures", "phase5", "contracts", fileName), "utf8"));
}

function loadManifest(packId) {
  return loadPackManifest(join(repoRoot, "packs", "core", packId, "pack.manifest.yaml"));
}

function mergeDeep(base, patch) {
  if (Array.isArray(patch) || typeof patch !== "object" || patch === null) {
    return structuredClone(patch);
  }
  const output = structuredClone(base ?? {});
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = structuredClone(value);
    }
  }
  return output;
}

test("valid read-only workflow contract is machine-readable and write-authority=false", () => {
  const request = loadJsonFixture("valid-read-only-request.json");
  const manifest = loadManifest("pairslash-plan");
  const contract = buildContractEnvelope({
    manifest,
    runtime: request.runtime,
    target: request.target,
    action: request.action,
    sourceType: request.source_type,
  });
  assert.equal(contract.kind, "contract-envelope");
  assert.equal(contract.workflow_class, "read-oriented");
  assert.equal(contract.memory_contract.mode, "read");
  assert.equal(contract.memory_contract.authoritative_write_allowed, false);
  assert.equal(contract.memory_contract.preview_required, false);
  assert.deepEqual(validateContractEnvelope(contract), []);
});

test("valid write-authority workflow contract encodes explicit preview+approval boundary", () => {
  const request = loadJsonFixture("valid-write-authority-request.json");
  const manifest = loadManifest("pairslash-memory-write-global");
  const contract = buildMemoryWriteContract({
    manifest,
    runtime: request.runtime,
    target: request.target,
  });
  assert.equal(contract.workflow_class, "write-authority");
  assert.equal(contract.memory_contract.mode, "write");
  assert.equal(contract.memory_contract.authoritative_write_allowed, true);
  assert.equal(contract.memory_contract.preview_required, true);
  assert.ok(contract.input_contract.required_fields.includes("kind"));
  assert.equal(contract.output_contract.allowed_side_effects_summary.preview_required, true);
  assert.deepEqual(validateContractEnvelope(contract), []);
});

test("invalid missing contract section is rejected with explicit error code", () => {
  const payload = loadJsonFixture("invalid-missing-contract.json");
  assert.throws(
    () => parseContractEnvelope(payload),
    (error) =>
      error instanceof ContractEngineError &&
      error.code === CONTRACT_ENGINE_ERROR_CODES.MISSING_CONTRACT_SECTION,
  );
});

test("invalid read workflow trying to declare write authority is blocked", () => {
  const baseManifest = loadManifest("pairslash-plan");
  const overrides = loadJsonFixture("invalid-read-write-authority-overrides.json");
  const mutatedManifest = mergeDeep(baseManifest, overrides);
  assert.throws(
    () =>
      buildContractEnvelope({
        manifest: mutatedManifest,
        runtime: "codex_cli",
        target: "repo",
        action: "lint",
      }),
    (error) =>
      error instanceof ContractEngineError &&
      error.code === CONTRACT_ENGINE_ERROR_CODES.WORKFLOW_AUTHORITY_VIOLATION,
  );
});

test("invalid runtime capability mismatch is rejected for blocked runtime lane", () => {
  const baseManifest = loadManifest("pairslash-memory-write-global");
  const overrides = loadJsonFixture("invalid-runtime-capability-mismatch-overrides.json");
  const mutatedManifest = mergeDeep(baseManifest, overrides);
  assert.throws(
    () =>
      buildContractEnvelope({
        manifest: mutatedManifest,
        runtime: "copilot_cli",
        target: "repo",
        action: "memory.write-global",
      }),
    (error) =>
      error instanceof ContractEngineError &&
      error.code === CONTRACT_ENGINE_ERROR_CODES.CAPABILITY_RUNTIME_MISMATCH,
  );
});
