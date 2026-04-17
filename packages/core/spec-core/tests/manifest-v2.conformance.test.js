import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";

import {
  buildPackCatalogIndex,
  discoverPackManifestPaths,
  loadPackCatalogRecords,
  renderPackCatalogIndexYaml,
  selectDefaultCatalogPack,
} from "@pairslash/spec-core";

import { createTempRepo, repoRoot, updatePackManifest } from "../../../../tests/phase4-helpers.js";

const SUPPORTED_RUNTIMES = ["codex_cli", "copilot_cli"];

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function loadScopedReleaseGateStatus(rootPath) {
  const verdictPath = join(rootPath, "docs", "releases", "scoped-release-verdict.md");
  const match = readFileSync(verdictPath, "utf8").match(/Gate status:\s*([A-Z-]+)/i);
  return match ? match[1].toUpperCase() : "NO-GO";
}

test("authoritative pack catalog covers every discovered core manifest path", () => {
  const discoveredManifestPaths = discoverPackManifestPaths(repoRoot)
    .map((manifestPath) => toPosixPath(relative(repoRoot, manifestPath)))
    .sort((left, right) => left.localeCompare(right));
  const catalogRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: false })
    .filter((record) => record.catalog_scope === "core");
  const catalogManifestPaths = new Set(catalogRecords.map((record) => record.pack_manifest));

  assert.equal(catalogRecords.length, discoveredManifestPaths.length);
  for (const discoveredPath of discoveredManifestPaths) {
    assert.equal(
      catalogManifestPaths.has(discoveredPath),
      true,
      `catalog should include discovered core manifest path ${discoveredPath}`,
    );
  }
});

test("invalid core manifests stay visible in catalog with explicit invalid status", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.memory_permissions.explicit_write_only = false;
        return manifest;
      },
    });
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");

    assert.ok(planRecord);
    assert.equal(planRecord.catalog_scope, "core");
    assert.equal(planRecord.catalog_status, "invalid");
    assert.equal(planRecord.promotion_ready, false);
    assert.ok(planRecord.promotion_blockers.includes("invalid-core-manifest"));
    assert.ok(
      planRecord.descriptor_errors.some((error) => error.includes("manifest-validate:PSM043")),
    );
  } finally {
    fixture.cleanup();
  }
});

test("default catalog recommendation resolves from operational core records", () => {
  const records = loadPackCatalogRecords(repoRoot, { includeAdvanced: false });
  const defaultRecord = selectDefaultCatalogPack(records);

  assert.ok(defaultRecord);
  assert.equal(defaultRecord.catalog_scope, "core");
  assert.equal(defaultRecord.catalog_status, "operational");
  assert.equal(defaultRecord.default_recommendation, true);
});

test("public catalog entries always carry release, workflow maturity, and support scope metadata", () => {
  const publicCoreRecords = loadPackCatalogRecords(repoRoot, { includeAdvanced: false })
    .filter((record) => record.catalog_scope === "core" && record.public_catalog);

  assert.ok(publicCoreRecords.length > 0);
  for (const record of publicCoreRecords) {
    assert.equal(record.support_metadata_complete, true, `${record.id} should have complete support metadata`);
    assert.equal(typeof record.maturity, "string");
    assert.equal(record.maturity.length > 0, true);
    assert.equal(typeof record.workflow_maturity, "string");
    assert.equal(record.workflow_maturity.length > 0, true);
    assert.equal(typeof record.effective_workflow_maturity, "string");
    assert.equal(record.effective_workflow_maturity.length > 0, true);
    assert.equal(typeof record.workflow_transition_legal, "boolean");
    assert.equal(typeof record.workflow_promotion_checklist_ready, "boolean");
    assert.equal(Array.isArray(record.workflow_demotion_triggers_active), true);
    assert.equal(typeof record.support_scope, "string");
    assert.equal(record.support_scope.length > 0, true);
  }
});

test("promotion remains blocked when evidence is not pack-runtime-live", () => {
  const records = loadPackCatalogRecords(repoRoot, { includeAdvanced: false })
    .filter((record) => record.catalog_scope === "core" && record.catalog_status === "operational");

  for (const record of records) {
    for (const runtime of SUPPORTED_RUNTIMES) {
      const claim = record.runtime_support?.[runtime] ?? {};
      if (claim.declared_status === "unverified") {
        assert.equal(
          record.promotion_ready,
          false,
          `${record.id} should not be promotion-ready while ${runtime} is unverified`,
        );
        assert.ok(
          record.promotion_blockers.includes(`runtime-promotion-unverified-surface:${runtime}`),
        );
      }
      if (
        ["supported", "partial"].includes(claim.declared_status) &&
        claim.required_for_promotion !== false &&
        claim.evidence_kind !== "pack-runtime-live"
      ) {
        assert.equal(
          claim.promotion_evidence_ready,
          false,
          `${record.id}/${runtime} should not be promotion-ready without pack-runtime-live evidence`,
        );
        assert.equal(
          record.promotion_ready,
          false,
          `${record.id} should not be promotion-ready when runtime evidence is lane-matrix/docs-only`,
        );
      }
    }
  }
});

test("workflow promotion remains blocked when evidence is insufficient against current scoped release gate status", () => {
  const records = loadPackCatalogRecords(repoRoot, { includeAdvanced: false })
    .filter((record) => record.catalog_scope === "core" && record.catalog_status === "operational");
  const expectedGateStatus = loadScopedReleaseGateStatus(repoRoot);

  for (const record of records) {
    assert.equal(record.workflow_promotion_ready, false, `${record.id} should not be workflow-promotion-ready`);
    assert.equal(record.scoped_release_gate_status, expectedGateStatus);
  }
});

test("workflow maturity demotes on runtime regression blockers", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.workflow_maturity = "stable";
        manifest.support.workflow_transition.from = "beta";
        manifest.support.workflow_transition.reason = "stable-check";
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
        manifest.support.runtime_support.codex_cli.status = "blocked";
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
      planRecord.workflow_maturity_blockers.some((blocker) => blocker.includes("workflow-maturity-runtime-support-blocked:codex_cli")),
    );
    assert.ok(planRecord.workflow_demotion_triggers_active.includes("runtime-regression"));
  } finally {
    fixture.cleanup();
  }
});

test("workflow transition legality is surfaced in catalog records", () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan"] });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.support.workflow_maturity = "canary";
        manifest.support.workflow_transition.from = "stable";
        manifest.support.workflow_transition.reason = "illegal-step";
        return manifest;
      },
    });
    const records = loadPackCatalogRecords(fixture.tempRoot, { includeAdvanced: false });
    const planRecord = records.find((record) => record.id === "pairslash-plan");
    assert.ok(planRecord);
    assert.equal(planRecord.workflow_transition_legal, false);
    assert.ok(
      planRecord.descriptor_errors.some((error) =>
        error.includes("manifest-validate:PSM065")),
    );
  } finally {
    fixture.cleanup();
  }
});

test("derived registry stays in sync with authoritative pack catalog index rendering", () => {
  const registryPath = join(repoRoot, "packages", "core", "spec-core", "registry", "packs.yaml");
  const committedRegistryRaw = readFileSync(registryPath, "utf8");
  const committedRegistry = YAML.parse(committedRegistryRaw);
  const derivedRegistry = buildPackCatalogIndex(repoRoot, {
    version: committedRegistry.version,
    lastUpdated: committedRegistry.last_updated,
  });
  const renderedRegistry = renderPackCatalogIndexYaml(repoRoot, {
    version: committedRegistry.version,
    lastUpdated: committedRegistry.last_updated,
  });

  assert.deepEqual(committedRegistry, derivedRegistry);
  assert.equal(committedRegistryRaw, renderedRegistry);
});
