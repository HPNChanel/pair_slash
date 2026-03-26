import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { loadPackManifest, validatePolicyVerdict } from "@pairslash/spec-core";
import {
  buildContractEnvelope,
  buildMemoryWriteContract,
} from "@pairslash/contract-engine";
import { evaluatePolicy } from "@pairslash/policy-engine";

import { repoRoot } from "../phase4-helpers.js";

const fixturesDir = join(repoRoot, "fixtures", "policy");

function readJson(name) {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function loadManifest(packId) {
  return loadPackManifest(join(repoRoot, "packs", "core", packId, "pack.manifest.yaml"));
}

test("policy fixtures keep read-only and unsupported-surface behavior stable", () => {
  const contract = buildContractEnvelope({
    manifest: loadManifest("pairslash-plan"),
    runtime: "codex_cli",
    target: "repo",
    action: "lint",
  });
  const allowVerdict = evaluatePolicy({
    contract,
    request: readJson("read-only-request.json"),
  });
  const denyVerdict = evaluatePolicy({
    contract,
    request: readJson("unsupported-surface-request.json"),
  });
  assert.equal(allowVerdict.overall_verdict, "allow");
  assert.equal(denyVerdict.overall_verdict, "deny");
  assert.ok(denyVerdict.reasons.some((reason) => reason.code === "POLICY-UNSUPPORTED-SURFACE"));
  assert.deepEqual(validatePolicyVerdict(allowVerdict), []);
  assert.deepEqual(validatePolicyVerdict(denyVerdict), []);
});

test("policy fixtures keep authoritative write preview gate stable", () => {
  const contract = buildMemoryWriteContract({
    manifest: loadManifest("pairslash-memory-write-global"),
    runtime: "codex_cli",
    target: "repo",
  });
  const verdict = evaluatePolicy({
    contract,
    request: readJson("write-authority-without-preview-request.json"),
  });
  assert.equal(verdict.overall_verdict, "require-preview");
  assert.equal(verdict.preview_required, true);
  assert.deepEqual(validatePolicyVerdict(verdict), []);
});
