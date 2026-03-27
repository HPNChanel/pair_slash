import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { loadPackManifest } from "@pairslash/spec-core";
import {
  buildContractEnvelope,
  parseContractEnvelope,
  ContractEngineError,
  CONTRACT_ENGINE_ERROR_CODES,
} from "@pairslash/contract-engine";
import { repoRoot } from "../phase4-helpers.js";

function loadJsonFixture(fileName) {
  return JSON.parse(readFileSync(join(repoRoot, "tests", "fixtures", "phase5", "contracts", fileName), "utf8"));
}

function loadManifest(packId) {
  return loadPackManifest(join(repoRoot, "packs", "core", packId, "pack.manifest.yaml"));
}

test("tests/fixtures/phase5/contracts valid read-only request compiles into contract v2", () => {
  const request = loadJsonFixture("valid-read-only-request.json");
  const contract = buildContractEnvelope({
    manifest: loadManifest("pairslash-plan"),
    runtime: request.runtime,
    target: request.target,
    action: request.action,
    sourceType: request.source_type,
  });
  assert.equal(contract.schema_version, "2.0.0");
  assert.equal(contract.memory_contract.authoritative_write_allowed, false);
});

test("tests/fixtures/phase5/contracts invalid missing contract fixture fails parsing", () => {
  const payload = loadJsonFixture("invalid-missing-contract.json");
  assert.throws(
    () => parseContractEnvelope(payload),
    (error) =>
      error instanceof ContractEngineError &&
      error.code === CONTRACT_ENGINE_ERROR_CODES.MISSING_CONTRACT_SECTION,
  );
});
