import test from "node:test";
import assert from "node:assert/strict";
import { delimiter, join } from "node:path";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";

import { loadPackManifest } from "@pairslash/spec-core";

import {
  detectRuntime,
  enforceWorkflow,
  listSupportedTriggerSurfaces,
  resolveConfigHome,
  resolveInstallRoot,
  resolvePackInstallDir,
  RUNTIME_COPILOT_ADAPTER_ERROR_CODES,
} from "../src/index.ts";
import { dropPathDirsWithExecutable, repoRoot } from "../../../../../tests/phase4-helpers.js";

const fixturesDir = join(repoRoot, "tests", "fixtures", "phase5", "runtime-enforcement");

function readJson(name) {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function loadManifest(packId) {
  return loadPackManifest(join(repoRoot, "packs", "core", packId, "pack.manifest.yaml"));
}

function writeShimExecutable(path, contents) {
  writeFileSync(path, contents, { mode: 0o755 });
  try {
    chmodSync(path, 0o755);
  } catch {
    // chmod is best-effort for cross-platform test shims.
  }
}

function installDetectionShims({ copilotBinaryVersion = null, ghVersion = null, ghCopilotVersion = null } = {}) {
  const binDir = mkdtempSync(join(tmpdir(), "pairslash-copilot-detect-"));
  const previousPath = process.env.PATH ?? "";
  const previousFake = process.env.PAIRSLASH_FAKE_COPILOT_VERSION;
  delete process.env.PAIRSLASH_FAKE_COPILOT_VERSION;

  if (ghVersion) {
    if (process.platform === "win32") {
      writeShimExecutable(
        join(binDir, "gh.cmd"),
        [
          "@echo off",
          `if "%1"=="--version" (\r\n  echo gh version ${ghVersion}\r\n  exit /b 0\r\n)`,
          ...(ghCopilotVersion
            ? [`if "%1"=="copilot" if "%2"=="--version" (\r\n  echo ${ghCopilotVersion}\r\n  exit /b 0\r\n)`]
            : []),
          `echo unsupported gh command 1>&2\r\nexit /b 1\r\n`,
        ].join("\r\n"),
      );
    } else {
      writeShimExecutable(
        join(binDir, "gh"),
        [
          "#!/bin/sh",
          `if [ "$1" = "--version" ]; then\n  printf '%s\\n' 'gh version ${ghVersion}'\n  exit 0\nfi`,
          ...(ghCopilotVersion
            ? [
                `if [ "$1" = "copilot" ] && [ "$2" = "--version" ]; then\n  printf '%s\\n' '${ghCopilotVersion}'\n  exit 0\nfi`,
              ]
            : []),
          `printf '%s\\n' 'unsupported gh command' >&2\nexit 1\n`,
        ].join("\n"),
      );
    }
  }

  if (copilotBinaryVersion) {
    if (process.platform === "win32") {
      writeShimExecutable(
        join(binDir, "copilot.cmd"),
        `@echo off\r\nif "%1"=="--version" (\r\n  echo ${copilotBinaryVersion}\r\n  exit /b 0\r\n)\r\necho unsupported copilot command 1>&2\r\nexit /b 1\r\n`,
      );
    } else {
      writeShimExecutable(
        join(binDir, "copilot"),
        `#!/bin/sh\nif [ "$1" = "--version" ]; then\n  printf '%s\\n' '${copilotBinaryVersion}'\n  exit 0\nfi\nprintf '%s\\n' 'unsupported copilot command' >&2\nexit 1\n`,
      );
    }
  }

  // Real binaries must not leak into the probe path; detection must see only
  // the shims installed by this helper.
  let nextPath = dropPathDirsWithExecutable(previousPath, "gh");
  nextPath = dropPathDirsWithExecutable(nextPath, "copilot");
  process.env.PATH = `${binDir}${delimiter}${nextPath}`;

  return {
    cleanup() {
      process.env.PATH = previousPath;
      if (previousFake === undefined) {
        delete process.env.PAIRSLASH_FAKE_COPILOT_VERSION;
      } else {
        process.env.PAIRSLASH_FAKE_COPILOT_VERSION = previousFake;
      }
      rmSync(binDir, { recursive: true, force: true });
    },
  };
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

test("copilot detectRuntime reports the standalone copilot binary product version", () => {
  const env = installDetectionShims({
    copilotBinaryVersion: "1.0.88",
    ghVersion: "2.96.0",
    ghCopilotVersion: "1.0.88",
  });
  try {
    const detection = detectRuntime();
    assert.equal(detection.available, true);
    assert.equal(detection.version, "1.0.88");
    assert.equal(detection.detection_path, "copilot");
    assert.equal(detection.gh_version, "2.96.0");
  } finally {
    env.cleanup();
  }
});

test("copilot detectRuntime falls back to `gh copilot --version` when the binary is absent", () => {
  const env = installDetectionShims({ ghVersion: "2.96.0", ghCopilotVersion: "1.0.87" });
  try {
    const detection = detectRuntime();
    assert.equal(detection.available, true);
    assert.equal(detection.version, "1.0.87");
    assert.equal(detection.detection_path, "gh-wrapper");
    assert.equal(detection.gh_version, "2.96.0");
  } finally {
    env.cleanup();
  }
});

test("copilot detectRuntime reports unavailable when neither probe finds the product", () => {
  const env = installDetectionShims({ ghVersion: "2.96.0" });
  try {
    const detection = detectRuntime();
    assert.equal(detection.available, false);
    assert.equal(detection.version, null);
    assert.equal(detection.detection_path, null);
    assert.equal(detection.gh_version, "2.96.0");
    assert.ok(typeof detection.error === "string" && detection.error.length > 0);
  } finally {
    env.cleanup();
  }
});

test("copilot detectRuntime reports the fake-env detection path for test harnesses", () => {
  const previousFake = process.env.PAIRSLASH_FAKE_COPILOT_VERSION;
  process.env.PAIRSLASH_FAKE_COPILOT_VERSION = "1.0.88";
  try {
    const detection = detectRuntime();
    assert.equal(detection.available, true);
    assert.equal(detection.version, "1.0.88");
    assert.equal(detection.detection_path, "fake-env");
  } finally {
    if (previousFake === undefined) {
      delete process.env.PAIRSLASH_FAKE_COPILOT_VERSION;
    } else {
      process.env.PAIRSLASH_FAKE_COPILOT_VERSION = previousFake;
    }
  }
});

test("copilot path resolution maps runtime-default and shared-agents roots", () => {
  const root = join("X:", "repo");
  assert.equal(
    resolveConfigHome({ repoRoot: root, target: "repo", skillRoot: "runtime-default" }),
    join(root, ".github"),
  );
  assert.equal(
    resolvePackInstallDir({ repoRoot: root, target: "repo", skillRoot: "runtime-default" }, "pairslash-plan"),
    join(root, ".github", "skills", "pairslash-plan"),
  );
  assert.equal(
    resolveConfigHome({ repoRoot: root, target: "user", skillRoot: "runtime-default" }),
    join(homedir(), ".copilot"),
  );
  assert.equal(
    resolveConfigHome({ repoRoot: root, target: "repo", skillRoot: "shared-agents" }),
    join(root, ".agents"),
  );
  assert.equal(
    resolvePackInstallDir({ repoRoot: root, target: "repo", skillRoot: "shared-agents" }, "pairslash-plan"),
    join(root, ".agents", "skills", "pairslash-plan"),
  );
  assert.equal(
    resolveConfigHome({ repoRoot: root, target: "user", skillRoot: "shared-agents" }),
    join(homedir(), ".agents"),
  );
  assert.equal(resolveConfigHome({ repoRoot: root, target: "repo" }), join(root, ".github"));
});

test("copilot path resolution rejects unsupported skill_root values", () => {
  assert.throws(
    () => resolveConfigHome({ repoRoot, target: "repo", skillRoot: "bogus" }),
    /unsupported skill_root/,
  );
});
