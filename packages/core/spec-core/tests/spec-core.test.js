import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

import {
  buildNormalizedIr,
  buildPackCatalogIndex,
  buildManifestTemplate,
  discoverPackManifestPaths,
  loadPublicSupportSnapshot,
  loadPackCatalogRecords,
  loadPackManifest,
  loadPackManifestRecords,
  resolveManifestInstallSpec,
  serializePackManifestV2,
  selectPackManifestRecords,
  selectDefaultCatalogPack,
  validateDoctorReport,
  validateInstallState,
  validatePreviewPlan,
  validateLintReport,
  validatePackManifestV2,
  validatePackTrustDescriptor,
} from "@pairslash/spec-core";

import { createTempRepo, repoRoot, updatePackManifest } from "../../../../tests/phase4-helpers.js";

function loadManifestFixture(fileName) {
  const fixturePath = join(repoRoot, "packages", "core", "spec-core", "tests", "fixtures", fileName);
  return YAML.parse(readFileSync(fixturePath, "utf8"));
}

function hasCode(errors, code) {
  return errors.some((error) => error.startsWith(`${code} `));
}

test("discoverPackManifestPaths finds phase 4 manifests", () => {
  const manifestPaths = discoverPackManifestPaths(repoRoot);
  assert.ok(manifestPaths.length >= 11);
  assert.ok(manifestPaths.every((path) => path.endsWith("pack.manifest.yaml")));
});

test("derived pack registry stays aligned with canonical core manifests", () => {
  const registry = YAML.parse(readFileSync(join(repoRoot, "packages", "core", "spec-core", "registry", "packs.yaml"), "utf8"));
  const derivedIndex = buildPackCatalogIndex(repoRoot, {
    version: registry.version,
    lastUpdated: registry.last_updated,
  });

  assert.deepEqual(registry, derivedIndex);
  assert.ok(
    registry.packs.every((entry) => entry.release_channel && entry.workflow_maturity && entry.support_scope),
  );
});

test("pack catalog records include core metadata and excluded advanced inventory", () => {
  const records = loadPackCatalogRecords(repoRoot, { includeAdvanced: true });
  const planRecord = records.find((record) => record.id === "pairslash-plan" && record.catalog_scope === "core");
  const advancedRecord = records.find((record) => record.id === "pairslash-retrieval-addon");

  assert.ok(planRecord);
  assert.equal(planRecord.maturity, "preview");
  assert.equal(planRecord.workflow_maturity, "canary");
  assert.equal(planRecord.effective_workflow_maturity, "canary");
  assert.equal(planRecord.support_scope, "core-supported");
  assert.equal(planRecord.runtime_support.codex_cli.evidence_scope, "shared-matrix");
  assert.equal(planRecord.promotion_ready, false);
  assert.equal(planRecord.workflow_promotion_ready, false);
  assert.equal(planRecord.scoped_release_gate_status, "NO-GO");
  assert.ok(advancedRecord);
  assert.equal(advancedRecord.catalog_scope, "advanced");
  assert.equal(advancedRecord.catalog_status, "excluded");
});

test("default catalog selection prefers stronger effective workflow maturity over deprecated", () => {
  const selected = selectDefaultCatalogPack([
    {
      id: "pairslash-stable",
      catalog_scope: "core",
      catalog_status: "operational",
      default_discovery: true,
      default_recommendation: true,
      effective_workflow_maturity: "stable",
      maturity: "stable",
    },
    {
      id: "pairslash-deprecated",
      catalog_scope: "core",
      catalog_status: "operational",
      default_discovery: true,
      default_recommendation: true,
      effective_workflow_maturity: "deprecated",
      maturity: "stable",
    },
  ]);
  assert.equal(selected?.id, "pairslash-stable");
});

test("default pack catalog load stays core-only unless advanced inclusion is explicit", () => {
  const records = loadPackCatalogRecords(repoRoot);
  assert.equal(
    records.some((record) => record.catalog_scope === "advanced"),
    false,
  );
});

test("pack-runtime-live claims fail closed when they do not reference authoritative lane records", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.runtime_support.codex_cli.evidence_kind = "pack-runtime-live";
        manifest.support.runtime_support.codex_cli.evidence_ref = "README.md";
        return manifest;
      },
    });
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");
    assert.ok(planRecord);
    assert.equal(planRecord.catalog_status, "invalid");
    assert.ok(
      planRecord.descriptor_errors.some((error) =>
        error.includes("support.runtime_support.codex_cli.evidence_ref must point to docs/evidence/live-runtime/*.yaml for pack-runtime-live")),
    );
  } finally {
    fixture.cleanup();
  }
});

test("lane-matrix claims fail closed when runtime evidence ref is not the shared matrix", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.runtime_support.codex_cli.evidence_kind = "lane-matrix";
        manifest.support.runtime_support.codex_cli.evidence_ref = "docs/evidence/live-runtime/codex-cli-repo-macos.yaml";
        return manifest;
      },
    });
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");
    assert.ok(planRecord);
    assert.equal(planRecord.catalog_status, "invalid");
    assert.ok(
      planRecord.descriptor_errors.some((error) =>
        error.includes(
          "support.runtime_support.codex_cli.evidence_ref must point to docs/compatibility/runtime-surface-matrix.yaml for lane-matrix",
        )),
    );
  } finally {
    fixture.cleanup();
  }
});

test("workflow preview claims must bind live workflow evidence to the exact claimed lane", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.workflow_maturity = "preview";
        manifest.support.workflow_transition.from = "canary";
        manifest.support.workflow_transition.reason = "lane-binding-check";
        manifest.support.runtime_support.codex_cli.evidence_kind = "pack-runtime-live";
        manifest.support.runtime_support.codex_cli.evidence_ref = "docs/evidence/live-runtime/codex-cli-repo-macos.yaml";
        manifest.support.runtime_support.copilot_cli.evidence_kind = "pack-runtime-live";
        manifest.support.runtime_support.copilot_cli.evidence_ref = "docs/evidence/live-runtime/copilot-cli-user-linux.yaml";
        manifest.support.workflow_evidence.live_workflow_refs.codex_cli = [
          "docs/evidence/live-runtime/codex-cli-repo-macos.yaml",
        ];
        manifest.support.workflow_evidence.live_workflow_refs.copilot_cli = [
          "docs/evidence/live-runtime/copilot-cli-user-linux.yaml",
        ];
        manifest.support.promotion_checklist.required_for_label = "preview";
        manifest.support.promotion_checklist.canonical_entrypoint_verified = true;
        manifest.support.promotion_checklist.claimed_lanes.codex_cli = ["codex-cli-repo-windows"];
        return manifest;
      },
    });
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");
    assert.ok(planRecord);
    assert.equal(planRecord.effective_workflow_maturity, "canary");
    assert.ok(
      planRecord.workflow_maturity_blockers.includes(
        "workflow-maturity-preview-live-workflow-lane-unbound:codex_cli:codex-cli-repo-windows",
      ),
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when runtime support data is missing", () => {
  const fixture = createTempRepo();
  try {
    unlinkSync(join(fixture.tempRoot, "docs", "compatibility", "runtime-surface-matrix.yaml"));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-missing/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when a lane evidence record is missing", () => {
  const fixture = createTempRepo();
  try {
    unlinkSync(join(fixture.tempRoot, "docs", "evidence", "live-runtime", "codex-cli-repo-macos.md"));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:runtime_lanes\[0\]\.evidence_source/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when a lane evidence data file is missing", () => {
  const fixture = createTempRepo();
  try {
    unlinkSync(join(fixture.tempRoot, "docs", "evidence", "live-runtime", "codex-cli-repo-macos.yaml"));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:runtime_lanes\[0\]\.evidence_data_ref/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot rejects remote evidence refs", () => {
  const fixture = createTempRepo();
  try {
    const matrixPath = join(fixture.tempRoot, "docs", "compatibility", "runtime-surface-matrix.yaml");
    const matrix = YAML.parse(readFileSync(matrixPath, "utf8"));
    matrix.runtime_lanes[0].evidence_data_ref = "https://example.com/lane.yaml";
    writeFileSync(matrixPath, YAML.stringify(matrix, { lineWidth: 0, simpleKeys: true }));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:runtime_lanes\[0\]\.evidence_data_ref/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when lane evidence record drifts from the matrix support level", () => {
  const fixture = createTempRepo();
  try {
    const evidencePath = join(fixture.tempRoot, "docs", "evidence", "live-runtime", "codex-cli-repo-macos.yaml");
    const record = YAML.parse(readFileSync(evidencePath, "utf8"));
    record.current_public_support_level = "stable-tested";
    writeFileSync(evidencePath, YAML.stringify(record, { lineWidth: 0, simpleKeys: true }));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:runtime_lanes\[0\]\.evidence_record\.current_public_support_level/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when evidence policy schema ref is missing", () => {
  const fixture = createTempRepo();
  try {
    const matrixPath = join(fixture.tempRoot, "docs", "compatibility", "runtime-surface-matrix.yaml");
    const matrix = YAML.parse(readFileSync(matrixPath, "utf8"));
    delete matrix.evidence_policy.registry_schema_ref;
    writeFileSync(matrixPath, YAML.stringify(matrix, { lineWidth: 0, simpleKeys: true }));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:evidence_policy\.registry_schema_ref/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when runbook policy is missing", () => {
  const fixture = createTempRepo();
  try {
    const matrixPath = join(fixture.tempRoot, "docs", "compatibility", "runtime-surface-matrix.yaml");
    const matrix = YAML.parse(readFileSync(matrixPath, "utf8"));
    delete matrix.evidence_policy.runbook_policy;
    writeFileSync(matrixPath, YAML.stringify(matrix, { lineWidth: 0, simpleKeys: true }));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:evidence_policy\.runbook_policy/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when windows promotion gate weakens doctor and preview rule", () => {
  const fixture = createTempRepo();
  try {
    const matrixPath = join(fixture.tempRoot, "docs", "compatibility", "runtime-surface-matrix.yaml");
    const matrix = YAML.parse(readFileSync(matrixPath, "utf8"));
    matrix.evidence_policy.runbook_policy.windows_promotion_gate.doctor_and_preview_never_enough = false;
    writeFileSync(matrixPath, YAML.stringify(matrix, { lineWidth: 0, simpleKeys: true }));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:evidence_policy\.runbook_policy\.windows_promotion_gate\.doctor_and_preview_never_enough/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when lane fake evidence refs are missing", () => {
  const fixture = createTempRepo();
  try {
    const matrixPath = join(fixture.tempRoot, "docs", "compatibility", "runtime-surface-matrix.yaml");
    const matrix = YAML.parse(readFileSync(matrixPath, "utf8"));
    delete matrix.runtime_lanes[0].fake_evidence_refs;
    writeFileSync(matrixPath, YAML.stringify(matrix, { lineWidth: 0, simpleKeys: true }));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:runtime_lanes\[0\]\.fake_evidence_refs/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("public support snapshot fails closed when a live run omits command metadata", () => {
  const fixture = createTempRepo();
  try {
    const evidencePath = join(fixture.tempRoot, "docs", "evidence", "live-runtime", "codex-cli-repo-macos.yaml");
    const record = YAML.parse(readFileSync(evidencePath, "utf8"));
    delete record.live_records[0].command;
    writeFileSync(evidencePath, YAML.stringify(record, { lineWidth: 0, simpleKeys: true }));
    assert.throws(
      () => loadPublicSupportSnapshot(fixture.tempRoot),
      /public-support-snapshot-invalid:runtime_lanes\[0\]\.evidence_record\.live_records\[0\]\.command/,
    );
  } finally {
    fixture.cleanup();
  }
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

test("pairslash-plan trust descriptor validates against manifest", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const descriptorPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.trust.yaml");
  const manifest = loadPackManifest(manifestPath);
  const descriptor = YAML.parse(readFileSync(descriptorPath, "utf8"));
  assert.deepEqual(validatePackTrustDescriptor(descriptor, { manifest }), []);
  assert.equal(descriptor.tier_claim, "core-maintained");
  assert.equal(descriptor.support_level_claim, "core-supported");
});

test("pack catalog resolves support metadata from manifest when trust shim is absent", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        delete manifest.trust_descriptor;
        return manifest;
      },
    });
    const trustPath = join(fixture.tempRoot, "packs", "core", "pairslash-plan", "pack.trust.yaml");
    unlinkSync(trustPath);
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");
    assert.ok(planRecord);
    assert.equal(planRecord.trust_tier, "core-maintained");
    assert.equal(planRecord.support_scope, "core-supported");
    assert.equal(planRecord.trust_descriptor, null);
    assert.deepEqual(planRecord.descriptor_errors, []);
  } finally {
    fixture.cleanup();
  }
});

test("buildNormalizedIr produces deterministic canonical asset graph", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const ir = buildNormalizedIr({ repoRoot, manifestPath });
  assert.equal(ir.kind, "normalized-pack-ir");
  assert.equal(ir.pack.id, "pairslash-plan");
  assert.equal(ir.pack.canonical_entrypoint, "/skills");
  assert.ok(ir.logical_assets.some((asset) => asset.asset_id === "skill"));
  assert.ok(ir.logical_assets.some((asset) => asset.asset_id === "codex-config"));
  assert.ok(ir.logical_assets.some((asset) => asset.asset_id === "copilot-package"));
  assert.ok(ir.logical_assets.some((asset) => asset.asset_id === "ownership-receipt"));
  assert.ok(ir.logical_assets.some((asset) => asset.runtime_selector === "codex_cli"));
  assert.ok(ir.logical_assets.some((asset) => asset.runtime_selector === "copilot_cli"));
  assert.ok(ir.logical_assets.find((asset) => asset.asset_id === "skill").source_relpath === "SKILL.md");
  assert.ok(
    ir.logical_assets.find((asset) => asset.asset_id === "codex-config").generated_relpath ===
      "fragments/config/pack-config.yaml",
  );
});

test("canonical manifest fields remain authoritative when compatibility aliases are present", () => {
  const fixture = createTempRepo();
  try {
    const manifestPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "pack.manifest.yaml",
    );
    const rawManifest = YAML.parse(readFileSync(manifestPath, "utf8"));
    rawManifest.assets = {
      pack_dir: "packs/core/wrong-pack",
      primary_skill_file: "WRONG.md",
      include: ["SKILL.md"],
    };
    rawManifest.runtime_targets = {
      codex_cli: {
        direct_invocation: "$wrong-pack",
        metadata_mode: "openai_yaml_optional",
        skill_directory_name: "wrong-pack",
        compatibility: {
          canonical_picker: "supported",
          direct_invocation: "supported",
        },
      },
      copilot_cli: {
        direct_invocation: "/wrong-pack",
        metadata_mode: "none",
        skill_directory_name: "wrong-pack",
        compatibility: {
          canonical_picker: "supported",
          direct_invocation: "unverified",
        },
      },
    };
    rawManifest.local_override_policy.eligible_paths = ["SKILL.md"];
    writeFileSync(
      manifestPath,
      YAML.stringify(rawManifest, {
        lineWidth: 0,
        simpleKeys: true,
      }),
    );

    const manifest = loadPackManifest(manifestPath);
    assert.equal(manifest.runtime_assets.source_root, "packs/core/pairslash-plan");
    assert.equal(manifest.runtime_bindings.codex_cli.direct_invocation, "$pairslash-plan");

    const ir = buildNormalizedIr({ repoRoot: fixture.tempRoot, manifestPath });
    assert.ok(ir.logical_assets.some((asset) => asset.asset_id === "contract-doc"));
    assert.ok(
      ir.logical_assets.find((asset) => asset.asset_id === "codex-config").generated_relpath ===
        "fragments/config/pack-config.yaml",
    );
  } finally {
    fixture.cleanup();
  }
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

test("buildManifestTemplate emits validator-compatible runtime target shape", () => {
  const manifest = buildManifestTemplate({
    id: "pairslash-template-check",
    phase: 4,
    include: ["SKILL.md", "contract.md", "validation-checklist.md"],
    overridePaths: ["SKILL.md", "contract.md"],
  });
  assert.deepEqual(validatePackManifestV2(manifest), []);
  assert.equal(manifest.runtime_targets.codex_cli.metadata_mode, "openai_yaml_optional");
  assert.equal(manifest.runtime_targets.codex_cli.skill_directory_name, "pairslash-template-check");
  assert.equal("adapter" in manifest.runtime_targets.codex_cli, false);
});

test("raw canonical pack.manifest.yaml v2.1.0 validates for core pack", () => {
  const manifestPath = join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml");
  const rawManifest = YAML.parse(readFileSync(manifestPath, "utf8"));
  assert.deepEqual(validatePackManifestV2(rawManifest), []);
  assert.equal(rawManifest.schema_version, "2.1.0");
  assert.equal(rawManifest.pack_name, "pairslash-plan");
});

test("sample manifests validate in canonical pack.manifest.yaml v2.1.0 shape", () => {
  const coreSample = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  const runtimeTargetedSample = loadManifestFixture("pack.manifest.v2.runtime-targeted.sample.yaml");
  assert.deepEqual(validatePackManifestV2(coreSample), []);
  assert.deepEqual(validatePackManifestV2(runtimeTargetedSample), []);
});

test("validator rejects invalid runtime range formats", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.supported_runtime_ranges.codex_cli = "latest";
  const errors = validatePackManifestV2(manifest);
  assert.ok(hasCode(errors, "PSM010"));
  assert.ok(
    errors.some((error) =>
      error.includes("supported_runtime_ranges.codex_cli must use exact x.y.z or >=x.y.z semver format"),
    ),
  );
});

test("validator rejects unsupported workflow maturity labels", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.support.workflow_maturity = "live-evidence-backed";
  const errors = validatePackManifestV2(manifest);
  assert.ok(
    errors.some((error) =>
      error.includes("support.workflow_maturity") &&
      error.includes("canary") &&
      error.includes("preview") &&
      error.includes("beta") &&
      error.includes("stable") &&
      error.includes("deprecated"),
    ),
  );
  assert.ok(hasCode(errors, "PSM000"));
});

test("workflow maturity promotion claims demote when live evidence and release truth are missing", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.workflow_maturity = "stable";
        manifest.support.workflow_transition.from = "beta";
        manifest.support.workflow_transition.reason = "phase-18-regression-check";
        manifest.support.workflow_evidence.live_workflow_refs.codex_cli = [
          "docs/evidence/live-runtime/codex-cli-repo-macos.yaml",
          "docs/evidence/live-runtime/codex-cli-repo-windows.yaml",
        ];
        manifest.support.workflow_evidence.live_workflow_refs.copilot_cli = [
          "docs/evidence/live-runtime/copilot-cli-user-linux.yaml",
          "docs/evidence/live-runtime/copilot-cli-user-windows.yaml",
        ];
        manifest.support.promotion_checklist.required_for_label = "stable";
        manifest.support.promotion_checklist.docs_synced = true;
        manifest.support.promotion_checklist.wording_verified = true;
        return manifest;
      },
    });
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");
    assert.ok(planRecord);
    assert.equal(planRecord.workflow_maturity, "stable");
    assert.equal(planRecord.effective_workflow_maturity, "canary");
    assert.equal(planRecord.workflow_promotion_ready, false);
    assert.ok(
      planRecord.workflow_maturity_blockers.includes(
        "workflow-maturity-pack-runtime-live-required:codex_cli:lane-matrix",
      ),
    );
    assert.ok(
      planRecord.workflow_maturity_blockers.includes("workflow-maturity-release-gate:no-go"),
    );
  } finally {
    fixture.cleanup();
  }
});

test("workflow demotion triggers stay visible when checklist blockers are active", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.promotion_checklist.canonical_entrypoint_verified = false;
        return manifest;
      },
    });
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");
    assert.ok(planRecord);
    assert.ok(
      planRecord.workflow_maturity_blockers.includes("workflow-maturity-promotion-checklist-incomplete"),
    );
    assert.ok(planRecord.workflow_demotion_triggers_active.includes("docs-drift"));
  } finally {
    fixture.cleanup();
  }
});

test("validator rejects illegal workflow maturity transitions", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.support.workflow_maturity = "canary";
  manifest.support.workflow_transition.from = "stable";
  manifest.support.workflow_transition.reason = "illegal-test";
  const errors = validatePackManifestV2(manifest);
  assert.ok(
    errors.some((error) =>
      error.includes("support.workflow_transition.from stable -> canary is not allowed"),
    ),
  );
  assert.ok(hasCode(errors, "PSM065"));
});

test("validator requires migration guidance for deprecated workflows", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.status = "deprecated";
  manifest.catalog.deprecation_status = "deprecated";
  manifest.support.workflow_maturity = "deprecated";
  manifest.support.workflow_transition.from = "beta";
  manifest.support.workflow_transition.reason = "sunset";
  manifest.catalog.replacement_pack = null;
  manifest.support.workflow_evidence.migration_refs = [];
  const errors = validatePackManifestV2(manifest);
  assert.ok(
    errors.some((error) =>
      error.includes("deprecated workflows require catalog.replacement_pack or support.workflow_evidence.migration_refs"),
    ),
  );
  assert.ok(hasCode(errors, "PSM065"));
});

test("validator rejects remote and non-authoritative workflow promotion evidence refs", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.support.workflow_maturity = "preview";
  manifest.support.workflow_transition.from = "canary";
  manifest.support.workflow_transition.reason = "evidence-policy-check";
  manifest.support.promotion_checklist.required_for_label = "preview";
  manifest.support.promotion_checklist.canonical_entrypoint_verified = true;
  manifest.support.workflow_evidence.live_workflow_refs.codex_cli = [
    "https://example.com/codex-live-proof.yaml",
  ];
  manifest.support.workflow_evidence.live_workflow_refs.copilot_cli = [
    "docs/evidence/live-runtime/copilot-cli-user-linux.md",
  ];
  const errors = validatePackManifestV2(manifest);
  assert.ok(
    errors.some((error) =>
      error.includes("support.workflow_evidence.live_workflow_refs.codex_cli must use repo-local evidence references")),
  );
  assert.ok(
    errors.some((error) =>
      error.includes("support.workflow_evidence.live_workflow_refs.copilot_cli must point to docs/evidence/live-runtime/*.yaml authoritative lane records")),
  );
});

test("validator rejects lane-matrix runtime evidence refs outside the shared matrix", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.support.runtime_support.codex_cli.evidence_kind = "lane-matrix";
  manifest.support.runtime_support.codex_cli.evidence_ref = "docs/evidence/live-runtime/codex-cli-repo-macos.yaml";
  const errors = validatePackManifestV2(manifest);
  assert.ok(
    errors.some((error) =>
      error.includes(
        "support.runtime_support.codex_cli.evidence_ref must point to docs/compatibility/runtime-surface-matrix.yaml for lane-matrix",
      )),
  );
});

test("validator rejects deprecated workflows marked as default recommendation", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.status = "deprecated";
  manifest.catalog.deprecation_status = "deprecated";
  manifest.catalog.default_recommendation = true;
  manifest.support.workflow_maturity = "deprecated";
  manifest.support.workflow_transition.from = "beta";
  manifest.support.workflow_transition.reason = "deprecation-check";
  manifest.catalog.replacement_pack = "pairslash-review";
  const errors = validatePackManifestV2(manifest);
  assert.ok(
    errors.some((error) => error.includes("deprecated workflows must not set catalog.default_recommendation")),
  );
});

test("validator rejects low-risk manifests with write capabilities", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.capabilities = [...manifest.capabilities, "repo_write"];
  const errors = validatePackManifestV2(manifest);
  assert.ok(hasCode(errors, "PSM031"));
});

test("validator enforces memory write authority contract", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.runtime-targeted.sample.yaml");
  manifest.memory_permissions.authority_mode = "read-only";
  manifest.capabilities = manifest.capabilities.filter((capability) => capability !== "memory_write_global");
  manifest.risk_level = "high";
  const errors = validatePackManifestV2(manifest);
  assert.ok(hasCode(errors, "PSM041"));
  assert.ok(hasCode(errors, "PSM042"));
});

test("validator rejects incomplete asset ownership records", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.asset_ownership.records = manifest.asset_ownership.records.filter(
    (record) => record.asset_id !== "skill",
  );
  const errors = validatePackManifestV2(manifest);
  assert.ok(hasCode(errors, "PSM050"));
  assert.ok(errors.some((error) => error.includes("asset_ownership.records is missing asset_id skill")));
});

test("validator enforces uninstall safety policy", () => {
  const manifest = loadManifestFixture("pack.manifest.v2.core.sample.yaml");
  manifest.asset_ownership.safe_delete_policy = "unsafe-delete-all";
  const errors = validatePackManifestV2(manifest);
  assert.ok(hasCode(errors, "PSM050"));
  assert.ok(
    errors.some((error) => error.includes("asset_ownership.safe_delete_policy must be pairslash-owned-only")),
  );
});

test("manifest resolver returns runtime and target install contract", () => {
  const manifest = loadPackManifest(join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml"));
  const resolved = resolveManifestInstallSpec(manifest, {
    runtime: "codex_cli",
    target: "repo",
  });
  assert.equal(resolved.runtime_binding.direct_invocation, "$pairslash-plan");
  assert.equal(resolved.runtime_range, ">=0.116.0");
  assert.ok(resolved.assets.some((asset) => asset.generated_path === "agents/openai.yaml"));
  assert.ok(resolved.assets.some((asset) => asset.source_path === "SKILL.md"));
});

test("serializePackManifestV2 preserves alias edits when rewriting canonical manifests", () => {
  const manifest = loadPackManifest(join(repoRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml"));
  manifest.pack.id = "pairslash-plan-rewrite";
  manifest.assets.pack_dir = "packs/core/pairslash-plan-rewrite";
  manifest.runtime_targets.codex_cli.direct_invocation = "$pairslash-plan-rewrite";
  manifest.runtime_targets.codex_cli.skill_directory_name = "pairslash-plan-rewrite";
  const serialized = serializePackManifestV2(manifest);
  assert.equal(serialized.pack_name, "pairslash-plan-rewrite");
  assert.equal(serialized.runtime_bindings.codex_cli.direct_invocation, "$pairslash-plan-rewrite");
  assert.equal(serialized.runtime_bindings.codex_cli.install_dir_name, "pairslash-plan-rewrite");
});

test("manifest selection isolates unrelated invalid manifests for targeted pack operations", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-review",
      mutate(manifest) {
        manifest.supported_runtime_ranges.cursor = ">=1.0.0";
        return manifest;
      },
    });
    const records = loadPackManifestRecords(fixture.tempRoot);
    const selection = selectPackManifestRecords(records, ["pairslash-plan"]);
    assert.deepEqual(selection.missing, []);
    assert.deepEqual(selection.invalid, []);
    assert.deepEqual(selection.valid.map((record) => record.packId), ["pairslash-plan"]);
  } finally {
    fixture.cleanup();
  }
});

test("doctor report validator accepts phase 4 execution report shape", () => {
  const errors = validateDoctorReport({
    kind: "doctor-report",
    schema_version: "2.2.0",
    generated_at: "2026-03-24T10:00:00.000Z",
    runtime: "codex_cli",
    target: "repo",
    support_verdict: "warn",
    install_blocked: false,
    environment_summary: {
      os: "win32",
      shell: "powershell",
      shell_profile_candidates: [join(repoRoot, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1")],
      cwd: repoRoot,
      repo_root: repoRoot,
      config_home: join(repoRoot, ".agents"),
      install_root: join(repoRoot, ".agents", "skills"),
      state_path: join(repoRoot, ".pairslash", "install-state", "repo-codex_cli.json"),
      runtime_executable: "codex",
      runtime_version: "0.116.0",
      runtime_available: true,
    },
    scope_probes: {
      repo: {
        target: "repo",
        selected: true,
        config_home: join(repoRoot, ".agents"),
        install_root: join(repoRoot, ".agents", "skills"),
        state_path: join(repoRoot, ".pairslash", "install-state", "repo-codex_cli.json"),
        config_home_exists: false,
        install_root_exists: false,
        writable: true,
        verdict: "pass",
        blocking_for_install: false,
        issue_codes: [],
      },
      user: {
        target: "user",
        selected: false,
        config_home: join(repoRoot, "home", ".agents"),
        install_root: join(repoRoot, "home", ".agents", "skills"),
        state_path: join(repoRoot, ".pairslash", "install-state", "user-codex_cli.json"),
        config_home_exists: false,
        install_root_exists: false,
        writable: true,
        verdict: "pass",
        blocking_for_install: false,
        issue_codes: [],
      },
    },
    support_lane: {
      os: "win32",
      runtime: "codex_cli",
      target: "repo",
      lane_status: "prep",
      tested_range_status: "prep_lane",
      tested_version_range: null,
      evidence_source: "docs/evidence/live-runtime/codex-cli-repo-windows.md",
      blocking_for_install: false,
      summary: "Windows is a prep lane for Phase 4 doctor and preview coverage.",
    },
    runtime_compatibility: {
      requested_runtime_range_max_status: "supported",
      selected_pack_count: 1,
      compatible_pack_count: 1,
      incompatible_pack_ids: [],
    },
    reason_codes: ["reconcile-unmanaged-identical"],
    remediation_actions: [
      {
        action_id: "preview-install:codex_cli:repo:pairslash-plan",
        action_kind: "run_command",
        summary: "Review the install preview before applying changes.",
        command: "node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo",
        safe_without_write: true,
        requires_preview: false,
        applies_to_actions: ["doctor", "install"],
        reason_codes: ["reconcile-unmanaged-identical"],
        preferred: true,
      },
    ],
    remediation: {
      status: "advisory",
      commands: [
        {
          action_id: "preview-install:codex_cli:repo:pairslash-plan",
          summary: "Review the install preview before applying changes.",
          command: "node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo",
          safe_without_write: true,
          requires_preview: false,
          applies_to_actions: ["doctor", "install"],
          reason_codes: ["reconcile-unmanaged-identical"],
          preferred: true,
          decision: "reconcile",
        },
      ],
      actions: [
        {
          action_id: "preview-install:codex_cli:repo:pairslash-plan",
          action_kind: "run_command",
          summary: "Review the install preview before applying changes.",
          command: "node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo",
          path: null,
          safe_without_write: true,
          requires_preview: false,
          applies_to_actions: ["doctor", "install"],
          reason_codes: ["reconcile-unmanaged-identical"],
          preferred: true,
          decision: "reconcile",
        },
      ],
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
        blocking_for_install: false,
        reason_codes: [],
        remediation_actions: [],
      },
    ],
    issues: [
      {
        code: "DOC-PLATFORM-SUPPORT-LANE",
        verdict: "warn",
        severity: "warn",
        check_id: "platform.support_lane",
        summary: "Windows is a prep lane for Phase 4 doctor and preview coverage.",
        evidence: {
          os: "win32",
        },
        suggested_fix: "Use macOS Codex repo lane or Linux Copilot user lane for pilot-grade install evidence.",
        blocking_for_install: false,
        message: "Windows is a prep lane for Phase 4 doctor and preview coverage.",
        remediation: "Use macOS Codex repo lane or Linux Copilot user lane for pilot-grade install evidence.",
        reason_codes: ["reconcile-unmanaged-identical"],
        remediation_actions: [
          {
            action_id: "preview-install:codex_cli:repo:pairslash-plan",
            action_kind: "run_command",
            summary: "Review the install preview before applying changes.",
            command: "node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo",
            safe_without_write: true,
            requires_preview: false,
            applies_to_actions: ["doctor", "install"],
            reason_codes: ["reconcile-unmanaged-identical"],
            preferred: true,
          },
        ],
      },
    ],
    next_actions: ["No action required."],
    workflow_maturity: {
      selected_pack_count: 1,
      recommended_pack_id: "pairslash-plan",
      highest_effective_workflow_maturity: "canary",
      contradictory_claim_count: 0,
      blocked_pack_count: 0,
      advanced_lane_fence: "core-only-catalog",
      selected_packs: [
        {
          pack_id: "pairslash-plan",
          workflow_maturity: "canary",
          effective_workflow_maturity: "canary",
          workflow_transition_legal: true,
          workflow_maturity_blocked: false,
          workflow_maturity_blockers: [],
          workflow_demotion_triggers_active: [],
          workflow_promotion_checklist_ready: true,
          runtime_support_status: "unverified",
          runtime_support_evidence_kind: "lane-matrix",
          support_scope: "official-preview",
          default_recommendation: true,
          pack_manifest: "packs/core/pairslash-plan/pack.manifest.yaml",
          demoted: false,
        },
      ],
    },
    installed_packs: [],
    first_workflow_guidance: {
      ready: false,
      recommended_pack_id: "pairslash-plan",
      rationale: "Install the baseline planning pack first to validate /skills workflow activation.",
      commands: [
        "node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo",
        "node packages/tools/cli/src/bin/pairslash.js install pairslash-plan --runtime codex --target repo --apply --yes",
      ],
    },
  });
  assert.deepEqual(errors, []);
});

test("preview plan validator accepts lifecycle reason codes and remediation actions", () => {
  const errors = validatePreviewPlan({
    kind: "preview-plan",
    schema_version: "1.0.0",
    action: "install",
    runtime: "codex_cli",
    target: "repo",
    install_root: join(repoRoot, ".agents", "skills"),
    state_path: join(repoRoot, ".pairslash", "install-state", "repo-codex_cli.json"),
    can_apply: true,
    requires_confirmation: true,
    selected_packs: ["pairslash-plan"],
    summary: {
      mkdir: 1,
      create: 0,
      replace: 0,
      reconcile_unmanaged: 1,
      skip_identical: 0,
      preserve_override: 0,
      remove: 0,
      skip_unmanaged: 0,
      blocked_conflict: 0,
      write_state: 1,
      write_journal: 1,
    },
    warnings: [],
    errors: [],
    reason_codes: ["reconcile-unmanaged-identical"],
    remediation_actions: [
      {
        action_id: "preview-install:codex_cli:repo:pairslash-plan",
        action_kind: "run_command",
        summary: "Review the install preview before applying changes.",
        command: "node packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo",
        safe_without_write: true,
        requires_preview: false,
        applies_to_actions: ["doctor", "install"],
        reason_codes: ["reconcile-unmanaged-identical"],
        preferred: true,
      },
    ],
    operations: [
      {
        kind: "reconcile_unmanaged",
        pack_id: "pairslash-plan",
        relative_path: "SKILL.md",
        absolute_path: join(repoRoot, ".agents", "skills", "pairslash-plan", "SKILL.md"),
        asset_kind: "skill_markdown",
        install_surface: "canonical_skill",
        ownership: "user",
        override_eligible: true,
        reason: "existing file already matches compiled artifact",
        reason_code: "reconcile-unmanaged-identical",
        management_mode: "reconciled_unmanaged",
        reconcile_mode: "identical",
        remediation_actions: [],
      },
    ],
    commitability: {
      status: "proceedable",
      can_proceed: true,
      blocked: false,
      needs_explicit_approval: true,
      can_proceed_operations: [],
      blocked_operations_count: 0,
      blocked_reasons: [],
      blocked_reason_codes: [],
      explicit_approval_hint: "Run the same action with --apply and explicit confirmation.",
    },
    preview_boundary: {
      preview_only: true,
      no_commit_on_preview: true,
      commit_path: "pairslash install ... --apply",
      note: "Preview is deterministic and does not write assets/config/memory.",
    },
  });
  assert.deepEqual(errors, []);
});

test("install state validator accepts explicit management metadata", () => {
  const errors = validateInstallState({
    kind: "install-state",
    schema_version: "1.0.0",
    runtime: "codex_cli",
    target: "repo",
    config_home: join(repoRoot, ".agents"),
    install_root: join(repoRoot, ".agents", "skills"),
    updated_at: null,
    last_transaction_id: null,
    packs: [
      {
        id: "pairslash-plan",
        version: "0.1.0",
        install_dir: join(repoRoot, ".agents", "skills", "pairslash-plan"),
        manifest_digest: "abc123",
        compiler_version: "2.0.0",
        files: [
          {
            relative_path: "SKILL.md",
            absolute_path: join(repoRoot, ".agents", "skills", "pairslash-plan", "SKILL.md"),
            source_digest: "abc123",
            current_digest: "def456",
            asset_kind: "skill_markdown",
            install_surface: "canonical_skill",
            runtime_selector: "shared",
            generated: false,
            write_authority_guarded: false,
            owned_by_pairslash: false,
            management_mode: "reconciled_unmanaged",
            override_eligible: true,
            local_override: true,
            reconciled_reason_code: "reconcile-unmanaged-override-preserved",
            last_operation: "reconcile_unmanaged",
          },
        ],
      },
    ],
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
