import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import YAML from "yaml";

import { runCli } from "../../packages/tools/cli/src/bin/pairslash.js";
import { previewMemoryWrite } from "../../packages/core/memory-engine/src/index.js";
import { evaluatePolicy } from "../../packages/core/policy-engine/src/index.js";
import {
  buildContractEnvelope,
  buildMemoryWriteContract,
  ContractEngineError,
  CONTRACT_ENGINE_ERROR_CODES,
} from "../../packages/core/contract-engine/src/index.js";
import { loadPackManifest } from "../../packages/core/spec-core/src/index.js";
import {
  createTempRepo,
  installFakeRuntime,
  repoRoot,
} from "../phase4-helpers.js";

const serial = { concurrency: false };
const memoryFixtureDir = join(repoRoot, "packages", "core", "memory-engine", "tests", "fixtures");
const policyFixtureDir = join(repoRoot, "tests", "fixtures", "phase5", "policy");
const contractFixtureDir = join(repoRoot, "tests", "fixtures", "phase5", "contracts");

function loadYaml(path) {
  return YAML.parse(readFileSync(path, "utf8"));
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadManifest(packId) {
  return loadPackManifest(join(repoRoot, "packs", "core", packId, "pack.manifest.yaml"));
}

function seedMemoryRoot(tempRoot) {
  mkdirSync(join(tempRoot, ".pairslash", "project-memory"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash", "task-memory"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash", "sessions"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash", "staging"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash", "audit-log"), { recursive: true });
  writeFileSync(
    join(tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"),
    YAML.stringify(
      {
        version: "0.1.0",
        last_updated: "2026-03-27T00:00:00.000Z",
        updated_by: "phase5-sweep",
        records: [],
      },
      { lineWidth: 0, simpleKeys: true },
    ),
  );
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

test("phase5 smoke: pairslash lint emits policy verdicts for shippable packs", serial, async () => {
  const fixture = createTempRepo({
    packs: ["pairslash-plan", "pairslash-memory-write-global"],
  });
  try {
    let output = "";
    const exitCode = await runCli({
      argv: ["lint", "--runtime", "all", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "lint-report");
    assert.equal(payload.ok, true);
    assert.ok(payload.policy_verdicts.length >= 2);
  } finally {
    fixture.cleanup();
  }
});

test("phase5 smoke: pairslash preview install stays preview-only", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    let output = "";
    const exitCode = await runCli({
      argv: ["preview", "install", "pairslash-plan", "--runtime", "codex", "--target", "repo", "--format", "json"],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          output += chunk;
        },
      },
    });
    assert.equal(exitCode, 0);
    const payload = JSON.parse(output);
    assert.equal(payload.kind, "preview-plan");
    assert.equal(payload.preview_boundary.no_commit_on_preview, true);
    assert.equal(existsSync(join(fixture.tempRoot, ".agents", "skills", "pairslash-plan")), false);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("phase5 smoke: pairslash-memory-write-global preview then apply commits with audit and index update", serial, async () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  try {
    seedMemoryRoot(fixture.tempRoot);
    const requestPath = join(repoRoot, "tests", "fixtures", "phase5", "preview", "memory-valid-request.yaml");
    let previewOutput = "";
    const previewExit = await runCli({
      argv: [
        "preview",
        "memory-write-global",
        "--runtime",
        "codex",
        "--target",
        "repo",
        "--request",
        requestPath,
        "--format",
        "json",
      ],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          previewOutput += chunk;
        },
      },
    });
    assert.equal(previewExit, 0);
    const previewPayload = JSON.parse(previewOutput);
    assert.equal(previewPayload.kind, "memory-write-preview");
    assert.equal(previewPayload.ready_for_apply, true);

    let applyOutput = "";
    const applyExit = await runCli({
      argv: [
        "memory",
        "write-global",
        "--runtime",
        "codex",
        "--target",
        "repo",
        "--request",
        requestPath,
        "--apply",
        "--yes",
        "--format",
        "json",
      ],
      cwd: fixture.tempRoot,
      stdout: {
        write(chunk) {
          applyOutput += chunk;
        },
        isTTY: true,
      },
      stdin: {
        isTTY: true,
      },
    });
    assert.equal(applyExit, 0);
    const applyPayload = JSON.parse(applyOutput);
    assert.equal(applyPayload.status, "committed");
    assert.equal(existsSync(join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml")), true);
    const auditEntries = readdirSync(join(fixture.tempRoot, ".pairslash", "audit-log")).filter((name) =>
      name.endsWith(".yaml"),
    );
    assert.ok(auditEntries.length > 0);
    const index = loadYaml(join(fixture.tempRoot, ".pairslash", "project-memory", "90-memory-index.yaml"));
    assert.ok(index.records.some((entry) => entry.title === "Preview trust boundary must be explicit"));
  } finally {
    fixture.cleanup();
  }
});

test("phase5 regression fixture: conflict detection blocks authoritative write", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  try {
    seedMemoryRoot(fixture.tempRoot);
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml"),
      YAML.stringify(loadYaml(join(memoryFixtureDir, "existing-constraint-conflict.yaml")), {
        lineWidth: 0,
        simpleKeys: true,
      }),
    );
    const preview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: loadYaml(join(memoryFixtureDir, "request-constraint.yaml")),
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(preview.ready_for_apply, false);
    assert.ok(preview.errors.some((entry) => entry.startsWith("conflict:")));
  } finally {
    fixture.cleanup();
  }
});

test("phase5 regression fixture: duplicate detection blocks authoritative write", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-memory-write-global"] });
  try {
    seedMemoryRoot(fixture.tempRoot);
    writeFileSync(
      join(fixture.tempRoot, ".pairslash", "project-memory", "50-constraints.yaml"),
      YAML.stringify(loadYaml(join(memoryFixtureDir, "existing-constraint-duplicate.yaml")), {
        lineWidth: 0,
        simpleKeys: true,
      }),
    );
    const preview = previewMemoryWrite({
      repoRoot: fixture.tempRoot,
      request: loadYaml(join(memoryFixtureDir, "request-constraint.yaml")),
      runtime: "codex_cli",
      target: "repo",
    });
    assert.equal(preview.ready_for_apply, false);
    assert.ok(preview.errors.some((entry) => entry.startsWith("duplicate:")));
  } finally {
    fixture.cleanup();
  }
});

test("phase5 regression fixture: no-silent-fallback stays explicit", serial, () => {
  const contract = buildContractEnvelope({
    manifest: loadManifest("pairslash-plan"),
    runtime: "codex_cli",
    target: "repo",
    action: "lint",
  });
  const verdict = evaluatePolicy({
    contract,
    request: loadJson(join(policyFixtureDir, "unsupported-surface-request.json")),
  });
  assert.equal(verdict.overall_verdict, "deny");
  assert.equal(verdict.enforcement_context.no_silent_fallback, true);
  assert.ok(verdict.reasons.some((entry) => entry.code === "POLICY-UNSUPPORTED-SURFACE"));
});

test("phase5 regression fixture: preview mandatory for write-authority apply", serial, () => {
  const contract = buildMemoryWriteContract({
    manifest: loadManifest("pairslash-memory-write-global"),
    runtime: "codex_cli",
    target: "repo",
  });
  const verdict = evaluatePolicy({
    contract,
    request: loadJson(join(policyFixtureDir, "write-authority-without-preview-request.json")),
  });
  assert.equal(verdict.overall_verdict, "require-preview");
  assert.equal(verdict.preview_required, true);
  assert.ok(verdict.reasons.some((entry) => entry.code === "POLICY-PREVIEW-REQUIRED"));
});

test("phase5 regression fixture: runtime capability mismatch is blocked at contract build", serial, () => {
  const manifest = mergeDeep(
    loadManifest("pairslash-memory-write-global"),
    loadJson(join(contractFixtureDir, "invalid-runtime-capability-mismatch-overrides.json")),
  );
  assert.throws(
    () =>
      buildContractEnvelope({
        manifest,
        runtime: "copilot_cli",
        target: "repo",
        action: "memory.write-global",
      }),
    (error) =>
      error instanceof ContractEngineError &&
      error.code === CONTRACT_ENGINE_ERROR_CODES.CAPABILITY_RUNTIME_MISMATCH,
  );
});
