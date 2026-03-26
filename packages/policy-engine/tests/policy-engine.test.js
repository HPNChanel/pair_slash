import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { loadPackManifest, validatePolicyVerdict } from "@pairslash/spec-core";
import {
  buildContractEnvelope,
  buildMemoryWriteContract,
} from "@pairslash/contract-engine";

import {
  deriveRiskProfile,
  evaluatePolicy,
  explainPolicyVerdict,
} from "../src/index.js";
import { repoRoot } from "../../../tests/phase4-helpers.js";

const fixturesDir = join(repoRoot, "fixtures", "policy");

function readJson(name) {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function loadManifest(packId) {
  return loadPackManifest(
    join(repoRoot, "packs", "core", packId, "pack.manifest.yaml"),
  );
}

function buildWorkflowContract(packId, runtime = "codex_cli", target = "repo") {
  return buildContractEnvelope({
    manifest: loadManifest(packId),
    runtime,
    target,
    action: "lint",
  });
}

test("read-only workflow evaluates to allow with read-only taxonomy", () => {
  const contract = buildWorkflowContract("pairslash-plan");
  const verdict = evaluatePolicy({
    contract,
    request: readJson("read-only-request.json"),
  });
  assert.equal(verdict.overall_verdict, "allow");
  assert.ok(verdict.evaluated_risks.some((risk) => risk.category === "read-only"));
  assert.equal(verdict.enforcement_context.primary_enforcement, "pairslash-wrapper");
  assert.deepEqual(validatePolicyVerdict(verdict), []);
});

test("repo-write workflow requires preview before apply", () => {
  const contract = buildWorkflowContract("pairslash-backend");
  const verdict = evaluatePolicy({
    contract,
    request: readJson("repo-write-request.json"),
  });
  assert.equal(verdict.overall_verdict, "require-preview");
  assert.equal(verdict.preview_required, true);
  assert.ok(verdict.reasons.some((reason) => reason.code === "POLICY-PREVIEW-REQUIRED"));
  assert.ok(verdict.evaluated_risks.some((risk) => risk.category === "repo-write"));
  assert.deepEqual(validatePolicyVerdict(verdict), []);
});

test("destructive plus secret-touching denies without explicit approval", () => {
  const contract = buildWorkflowContract("pairslash-backend", "copilot_cli");
  contract.tool_contract.secret_touching_allowance = true;
  contract.output_contract.allowed_side_effects_summary.secret_touching_allowed = true;
  contract.tool_contract.tools_required.push({
    id: "PAIRSLASH_TOKEN",
    kind: "env_var",
    check_command: "echo %PAIRSLASH_TOKEN%",
    required_for: ["run"],
  });
  const verdict = evaluatePolicy({
    contract,
    request: readJson("destructive-secret-request.json"),
  });
  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "POLICY-DESTRUCTIVE-SECRET-BLOCK"));
  assert.equal(verdict.enforcement_context.hook_support, "advisory");
  assert.deepEqual(validatePolicyVerdict(verdict), []);
});

test("unsupported runtime surface fails explicitly with no silent fallback", () => {
  const contract = buildWorkflowContract("pairslash-plan");
  const verdict = evaluatePolicy({
    contract,
    request: readJson("unsupported-surface-request.json"),
  });
  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "POLICY-UNSUPPORTED-SURFACE"));
  assert.equal(verdict.enforcement_context.no_silent_fallback, true);
  assert.deepEqual(validatePolicyVerdict(verdict), []);
});

test("write-authority workflow without preview is blocked", () => {
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
  assert.ok(verdict.reasons.some((reason) => reason.code === "POLICY-PREVIEW-REQUIRED"));
  assert.deepEqual(validatePolicyVerdict(verdict), []);
});

test("missing contract section fails closed with machine-readable deny verdict", () => {
  const invalidContract = readJson("invalid-missing-section-contract.json");
  const verdict = evaluatePolicy({
    contract: invalidContract,
    request: {
      ...readJson("read-only-request.json"),
      requested_runtime: "codex_cli",
      requested_target: "repo",
    },
  });
  assert.equal(verdict.overall_verdict, "deny");
  assert.ok(verdict.reasons.some((reason) => reason.code === "POLICY-CONTRACT-INCOMPLETE"));
  assert.deepEqual(validatePolicyVerdict(verdict), []);
});

test("explainPolicyVerdict reports contract fields and runtime factors", () => {
  const contract = buildWorkflowContract("pairslash-backend");
  const verdict = evaluatePolicy({
    contract,
    request: readJson("repo-write-request.json"),
  });
  const explanation = explainPolicyVerdict(verdict);
  assert.match(explanation, /POLICY-PREVIEW-REQUIRED/);
  assert.match(explanation, /contract:/);
  assert.match(explanation, /runtime:/);
});

test("deriveRiskProfile exposes machine-readable taxonomy", () => {
  const contract = buildWorkflowContract("pairslash-backend", "copilot_cli");
  const risks = deriveRiskProfile(contract, readJson("destructive-secret-request.json"));
  assert.ok(risks.some((risk) => risk.category === "repo-write"));
  assert.ok(risks.some((risk) => risk.category === "destructive"));
});
