import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  buildNormalizedIr,
  discoverPackManifestPaths,
  loadPackManifest,
  validateDoctorReport,
  validateLintReport,
  validatePackManifestV2,
} from "@pairslash/spec-core";

import { repoRoot } from "../../../tests/phase4-helpers.js";

test("discoverPackManifestPaths finds phase 4 manifests", () => {
  const manifestPaths = discoverPackManifestPaths(repoRoot);
  assert.ok(manifestPaths.length >= 11);
  assert.ok(manifestPaths.every((path) => path.endsWith("pack.manifest.yaml")));
});

test("pairslash-plan manifest v2 validates", () => {
  const manifest = loadPackManifest(join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml"));
  assert.deepEqual(validatePackManifestV2(manifest), []);
  assert.equal(manifest.pack.canonical_entrypoint, "/skills");
  assert.deepEqual(Object.keys(manifest.runtime_targets).sort(), ["codex_cli", "copilot_cli"]);
  assert.equal(manifest.ownership.ownership_file, "pairslash.install.json");
});

test("pairslash-memory-write-global manifest enforces write-authority contract", () => {
  const manifest = loadPackManifest(
    join(repoRoot, "packs", "core", "pairslash-memory-write-global", "pack.manifest.yaml"),
  );
  assert.equal(manifest.memory_permissions.authority_mode, "write-authority");
  assert.equal(manifest.memory_permissions.global_project_memory, "write");
  assert.equal(manifest.risk_level, "critical");
  assert.ok(manifest.capabilities.includes("memory_write_global"));
});

test("buildNormalizedIr produces deterministic shared asset graph", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const ir = buildNormalizedIr({ repoRoot, manifestPath });
  assert.equal(ir.kind, "normalized-pack-ir");
  assert.equal(ir.pack.id, "pairslash-plan");
  assert.equal(ir.pack.canonical_entrypoint, "/skills");
  assert.ok(ir.logical_assets.some((asset) => asset.asset_kind === "skill_markdown"));
  assert.ok(ir.logical_assets.every((asset) => asset.runtime_selector === "shared"));
});

test("validator rejects unsupported runtime and invalid memory write policy", () => {
  const manifest = loadPackManifest(join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml"));
  const invalid = structuredClone(manifest);
  invalid.supported_runtime_ranges.cursor = ">=1.0.0";
  invalid.memory_permissions.global_project_memory = "write";
  invalid.memory_permissions.authority_mode = "read-only";
  invalid.capabilities = invalid.capabilities.filter((item) => item !== "memory_write_global");
  const errors = validatePackManifestV2(invalid);
  assert.ok(errors.some((error) => error.includes("PSM010")));
  assert.ok(errors.some((error) => error.includes("PSM041")));
});

test("doctor report validator accepts phase 4 execution report shape", () => {
  const errors = validateDoctorReport({
    kind: "doctor-report",
    schema_version: "2.0.0",
    generated_at: "2026-03-24T10:00:00.000Z",
    runtime: "codex_cli",
    target: "repo",
    support_verdict: "warn",
    environment_summary: {
      os: "win32",
      shell: "powershell",
      cwd: repoRoot,
      repo_root: repoRoot,
      config_home: join(repoRoot, ".agents"),
      install_root: join(repoRoot, ".agents", "skills"),
      state_path: join(repoRoot, ".pairslash", "install-state", "repo-codex_cli.json"),
      runtime_executable: "codex",
      runtime_version: "0.116.0",
      runtime_available: true,
    },
    runtime_compatibility: {
      requested_runtime_range_max_status: "supported",
      selected_pack_count: 1,
      compatible_pack_count: 1,
      incompatible_pack_ids: [],
    },
    checks: [
      {
        id: "runtime.detect",
        group: "runtime",
        severity: "info",
        status: "pass",
        runtime: "codex_cli",
        target: "repo",
        inputs: {},
        summary: "runtime available",
        remediation: null,
        evidence: {},
      },
    ],
    issues: [],
    next_actions: ["No action required."],
    installed_packs: [],
  });
  assert.deepEqual(errors, []);
});

test("lint report validator accepts phase 4 bridge report shape", () => {
  const errors = validateLintReport({
    kind: "lint-report",
    schema_version: "1.0.0",
    phase: "phase4-bridge",
    generated_at: "2026-03-24T10:00:00.000Z",
    ok: true,
    target: "repo",
    runtime_scope: "all",
    summary: {
      pack_count: 1,
      runtime_count: 2,
      check_count: 2,
      error_count: 0,
      warning_count: 0,
      note_count: 0,
    },
    checks: [
      {
        code: "LINT-MANIFEST-001",
        result: "pass",
        pack_id: "pairslash-plan",
        runtime: "shared",
        target: "repo",
        path: "packs/core/pairslash-plan/pack.manifest.yaml",
        message: "manifest v2 validation passed",
        remediation: null,
      },
    ],
    issues: [],
    blocking_errors: [],
    next_actions: ["No blocking lint issues detected for Phase 4 bridge."],
  });
  assert.deepEqual(errors, []);
});
