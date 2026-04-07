import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { listReadWorkflowPaths, loadPackManifest } from "@pairslash/spec-core";
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

test("Phase 8 read workflows expose workflow-specific input, output, and memory contracts", () => {
  const expectations = {
    "pairslash-onboard-repo": {
      requiredFields: ["repo_root"],
      optionalFields: ["focus", "include_memory_candidates"],
      sections: [
        "repository_snapshot",
        "runtime_compatibility",
        "memory_model_status",
        "risks_and_gaps",
        "recommended_next_workflows",
      ],
      readPaths: [
        ".pairslash/project-memory/90-memory-index.yaml",
        ".pairslash/project-memory/",
        ".pairslash/task-memory/",
      ],
    },
    "pairslash-plan": {
      requiredFields: ["goal"],
      optionalFields: ["scope_hint", "constraints"],
      sections: [
        "goal",
        "constraints",
        "relevant_project_memory",
        "proposed_steps",
        "files_likely_affected",
        "tests_and_checks",
        "risks",
        "rollback",
        "open_questions",
      ],
      readPaths: [
        ".pairslash/project-memory/00-project-charter.yaml",
        ".pairslash/project-memory/10-stack-profile.yaml",
        ".pairslash/project-memory/50-constraints.yaml",
        ".pairslash/project-memory/90-memory-index.yaml",
        ".pairslash/task-memory/",
      ],
    },
    "pairslash-review": {
      requiredFields: ["review_subject", "diff_source"],
      optionalFields: ["scope_hint", "strictness"],
      sections: ["summary", "findings", "missing_tests", "open_questions", "recommendation"],
      readPaths: [
        ".pairslash/project-memory/90-memory-index.yaml",
        ".pairslash/project-memory/",
        ".pairslash/task-memory/",
      ],
    },
    "pairslash-command-suggest": {
      requiredFields: ["intent"],
      optionalFields: ["scope_hint", "platform"],
      sections: ["intent_summary", "suggested_commands", "safety_notes", "follow_up_workflow"],
      readPaths: [
        ".pairslash/project-memory/10-stack-profile.yaml",
        ".pairslash/project-memory/20-commands.yaml",
        ".pairslash/project-memory/50-constraints.yaml",
        ".pairslash/project-memory/90-memory-index.yaml",
      ],
    },
    "pairslash-memory-candidate": {
      requiredFields: ["task_scope"],
      optionalFields: ["evidence_sources", "strictness", "max_candidates"],
      sections: ["plan", "candidates", "reconciliation", "next_action"],
      readPaths: [
        ".pairslash/project-memory/90-memory-index.yaml",
        ".pairslash/project-memory/",
        ".pairslash/task-memory/",
        ".pairslash/sessions/",
        ".pairslash/staging/",
        ".pairslash/audit-log/",
      ],
    },
    "pairslash-memory-audit": {
      requiredFields: ["audit_scope"],
      optionalFields: ["mode", "focus"],
      sections: ["plan", "findings", "summary", "remediation_order", "next_action"],
      readPaths: [
        ".pairslash/project-memory/90-memory-index.yaml",
        ".pairslash/project-memory/",
        ".pairslash/task-memory/",
        ".pairslash/audit-log/",
      ],
    },
  };

  for (const [packId, expectation] of Object.entries(expectations)) {
    const contract = buildContractEnvelope({
      manifest: loadManifest(packId),
      runtime: "codex_cli",
      target: "repo",
      action: "read",
      sourceType: "workflow",
    });
    assert.deepEqual(contract.input_contract.required_fields, expectation.requiredFields);
    assert.deepEqual(contract.input_contract.optional_fields, expectation.optionalFields);
    assert.deepEqual(
      contract.output_contract.structured_sections.map((section) => section.id).filter((id) => id !== "policy_verdict"),
      expectation.sections,
    );
    assert.deepEqual(contract.memory_contract.read_paths, expectation.readPaths);
    assert.deepEqual(
      contract.memory_contract.read_paths,
      listReadWorkflowPaths(packId, { includeFallback: true }),
    );
    assert.equal(contract.memory_contract.authoritative_write_allowed, false);
    assert.equal(contract.memory_contract.no_hidden_write, true);
  }
});
