import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { loadPackManifest } from "@pairslash/spec-core";

import {
  enforceWorkflow,
  listSupportedTriggerSurfaces,
  RUNTIME_COPILOT_ADAPTER_ERROR_CODES,
} from "../src/index.js";
import { repoRoot } from "../../../../../tests/phase4-helpers.js";

const fixturesDir = join(repoRoot, "tests", "fixtures", "phase5", "runtime-enforcement");

function readJson(name) {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function loadManifest(packId) {
  return loadPackManifest(join(repoRoot, "packs", "core", packId, "pack.manifest.yaml"));
}

test("copilot adapter blocks invalid authoritative write from read workflow", async () => {
  const manifest = loadManifest("pairslash-plan");
  const result = await enforceWorkflow({
    manifest,
    request: readJson("invalid-write-request.json"),
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.no_silent_fallback, true);
  assert.equal(result.canonical_entrypoint, "/skills");
  assert.ok(
    result.blocking_errors.some(
      (entry) => entry.code === RUNTIME_COPILOT_ADAPTER_ERROR_CODES.POLICY_BLOCKED,
    ),
  );
  assert.ok(
    result.policy_verdict.reasons.some((reason) => reason.code === "POLICY-HIDDEN-WRITE-BLOCKED"),
  );
});

test("copilot adapter surfaces unsupported path explicitly without fallback", async () => {
  const manifest = structuredClone(loadManifest("pairslash-plan"));
  manifest.runtime_bindings.copilot_cli.compatibility.direct_invocation = "blocked";
  const result = await enforceWorkflow({
    manifest,
    request: {
      action: "run",
      apply: false,
      trigger_surface: "direct_invocation",
    },
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.no_silent_fallback, true);
  assert.equal(
    result.blocking_errors[0].code,
    RUNTIME_COPILOT_ADAPTER_ERROR_CODES.CONTRACT_BUILD_FAILED,
  );
  assert.equal(result.blocking_errors[0].details.source_error_code, "PCE-CAPABILITY-001");
});

test("copilot adapter keeps /skills canonical while exposing hook assist explicitly", async () => {
  const manifest = loadManifest("pairslash-memory-write-global");
  const result = await enforceWorkflow({
    manifest,
    request: readJson("hook-request.json"),
  });
  assert.equal(result.status, "allow");
  assert.equal(result.canonical_entrypoint, "/skills");
  assert.equal(result.selected_launch_path, "/skills");
  assert.equal(result.hook_assist.status, "available");
  assert.equal(result.hook_assist.mode, "advisory");
  assert.deepEqual(
    listSupportedTriggerSurfaces({ manifest }),
    ["canonical_skill", "direct_invocation", "hook"],
  );
});

test("copilot adapter blocks write-authority workflow when preview is missing", async () => {
  const manifest = loadManifest("pairslash-memory-write-global");
  const result = await enforceWorkflow({
    manifest,
    action: "memory.write-global",
    request: readJson("write-authority-without-preview-request.json"),
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.canonical_entrypoint, "/skills");
  assert.ok(
    result.blocking_errors.some(
      (entry) => entry.code === RUNTIME_COPILOT_ADAPTER_ERROR_CODES.PREVIEW_REQUIRED,
    ),
  );
  assert.equal(result.selected_launch_path, null);
});
