import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  applyInstall,
  applyUninstall,
  applyUpdate,
  planInstall,
  planUninstall,
  planUpdate,
} from "@pairslash/installer";

import {
  createTempRepo,
  installFakeRuntime,
  updatePackManifest,
  writeManualInstallFile,
} from "../../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

function repoStatePath(tempRoot, runtime = "codex_cli", target = "repo") {
  return join(tempRoot, ".pairslash", "install-state", `${target}-${runtime}.json`);
}

function createDirectoryLink(targetPath, linkPath) {
  symlinkSync(targetPath, linkPath, process.platform === "win32" ? "junction" : "dir");
}

test("install creates managed repo-target runtime footprint", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.ok(envelope.plan.operations.some((operation) => operation.kind === "create"));
    const result = applyInstall(envelope);
    const skillPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "SKILL.md",
    );
    const metadataPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "agents",
      "openai.yaml",
    );
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(metadataPath));
    assert.equal(result.state.packs[0].id, "pairslash-plan");
    assert.ok(existsSync(result.journal_path));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install accepts Codex version output with executable prefix", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "codex-cli 0.116.0" });
  try {
    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, true);
    assert.deepEqual(envelope.plan.errors, []);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install plan is blocked when lint bridge finds blocking errors", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.supported_runtime_ranges.copilot_cli = "latest";
        return manifest;
      },
    });
    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.errors.some(
        (error) =>
          error.startsWith("manifest-invalid:pairslash-plan") ||
          error.startsWith("lint-error:LINT-RUNTIME-001:pairslash-plan") ||
          error.startsWith("lint-error:LINT-MANIFEST-001:pairslash-plan"),
      ),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install targeted pack ignores unrelated invalid manifest in repo", serial, () => {
  const fixture = createTempRepo({ packs: ["pairslash-plan", "pairslash-review"] });
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-review",
      mutate(manifest) {
        manifest.supported_runtime_ranges.cursor = ">=1.0.0";
        return manifest;
      },
    });

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, true);
    assert.deepEqual(envelope.plan.errors, []);
    assert.deepEqual(envelope.compiledPacks.map((pack) => pack.pack_id), ["pairslash-plan"]);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install preview emits local-source trust delta for repo manifests", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.trust_delta.overall_status, "changed");
    assert.equal(envelope.plan.trust_delta.pack_changes[0].candidate.source_class, "local-source");
    assert.equal(envelope.plan.trust_delta.pack_changes[0].candidate.trust_tier, "local-dev");
    assert.equal(
      envelope.plan.trust_delta.pack_changes[0].candidate.verification_status,
      "local",
    );
    assert.equal(envelope.plan.trust_delta.pack_changes[0].candidate.signature_status, "local-dev");
    assert.equal(envelope.plan.trust_delta.pack_changes[0].candidate.support_level, "local-dev");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install blocks stale install-state metadata mismatch", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    mkdirSync(join(fixture.tempRoot, ".pairslash", "install-state"), { recursive: true });
    writeFileSync(
      repoStatePath(fixture.tempRoot),
      JSON.stringify(
        {
          kind: "install-state",
          schema_version: "1.0.0",
          runtime: "codex_cli",
          target: "repo",
          config_home: join(fixture.tempRoot, ".agents-stale"),
          install_root: join(fixture.tempRoot, ".agents-stale", "skills"),
          updated_at: "2026-04-04T00:00:00.000Z",
          last_transaction_id: null,
          packs: [],
        },
        null,
        2,
      ),
    );

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.reason_codes.includes("install-state-metadata-mismatch"),
    );
    assert.ok(
      envelope.plan.commitability.blocked_reason_codes.includes("install-state-metadata-mismatch"),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install tolerates case-only install-state path drift on Windows", serial, () => {
  if (process.platform !== "win32") {
    return;
  }
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    const configHome = join(fixture.tempRoot, ".agents");
    const installRoot = join(fixture.tempRoot, ".agents", "skills");
    const swapDriveCase = (value) => (
      /^[A-Za-z]:/.test(value)
        ? `${value[0] === value[0].toLowerCase() ? value[0].toUpperCase() : value[0].toLowerCase()}${value.slice(1)}`
        : value
    );
    mkdirSync(join(fixture.tempRoot, ".pairslash", "install-state"), { recursive: true });
    writeFileSync(
      repoStatePath(fixture.tempRoot),
      JSON.stringify(
        {
          kind: "install-state",
          schema_version: "1.0.0",
          runtime: "codex_cli",
          target: "repo",
          config_home: swapDriveCase(configHome),
          install_root: swapDriveCase(installRoot),
          updated_at: "2026-04-04T00:00:00.000Z",
          last_transaction_id: null,
          packs: [],
        },
        null,
        2,
      ),
    );

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.reason_codes.includes("install-state-metadata-mismatch"), false);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install preview blocks when pack install root exists as a file", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    mkdirSync(join(fixture.tempRoot, ".agents", "skills"), { recursive: true });
    writeFileSync(join(fixture.tempRoot, ".agents", "skills", "pairslash-plan"), "blocked-root\n");

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const blocked = envelope.plan.operations.find(
      (operation) =>
        operation.kind === "blocked_conflict" &&
        operation.pack_id === "pairslash-plan" &&
        operation.relative_path === ".",
    );
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(blocked);
    assert.equal(blocked.reason_code, "unmanaged-conflict-blocking");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install preview blocks symlinked install roots", serial, (t) => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    mkdirSync(join(fixture.tempRoot, ".agents", "skills"), { recursive: true });
    const externalRoot = join(fixture.tempRoot, "external-skill-root");
    mkdirSync(externalRoot, { recursive: true });
    const packRoot = join(fixture.tempRoot, ".agents", "skills", "pairslash-plan");
    try {
      createDirectoryLink(externalRoot, packRoot);
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") {
        t.skip("symlink/junction creation is not permitted in this environment");
        return;
      }
      throw error;
    }

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const blocked = envelope.plan.operations.find(
      (operation) =>
        operation.kind === "blocked_conflict" &&
        operation.pack_id === "pairslash-plan" &&
        operation.relative_path === ".",
    );
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(blocked);
    assert.equal(blocked.reason_code, "unmanaged-conflict-blocking");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install blocks unmanaged ownership receipt even when content is identical", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    const seed = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const ownershipCompiledFile = seed.compiledPacks[0]?.files.find(
      (file) => file.relative_path === "pairslash.install.json",
    );
    assert.ok(ownershipCompiledFile, "compiled ownership receipt should exist");
    writeManualInstallFile({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      packId: "pairslash-plan",
      relativePath: "pairslash.install.json",
      content: ownershipCompiledFile.content,
    });

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const blocked = envelope.plan.operations.find(
      (operation) =>
        operation.kind === "blocked_conflict" &&
        operation.pack_id === "pairslash-plan" &&
        operation.relative_path === "pairslash.install.json",
    );
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(blocked);
    assert.equal(blocked.reason_code, "ownership-metadata-conflict");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install preview emits reconcile_unmanaged for override-eligible unmanaged files", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    writeManualInstallFile({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      packId: "pairslash-plan",
      relativePath: "SKILL.md",
      content: "manual override\n",
    });

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const operation = envelope.plan.operations.find(
      (entry) => entry.relative_path === "SKILL.md",
    );
    assert.ok(operation);
    assert.equal(operation.kind, "reconcile_unmanaged");
    assert.equal(operation.reason_code, "reconcile-unmanaged-override-preserved");
    assert.equal(operation.management_mode, "reconciled_unmanaged");
    assert.equal(operation.reconcile_mode, "override_preserved");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install redirects already-managed packs to update semantics", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );

    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const redirect = envelope.plan.operations.find(
      (entry) => entry.reason_code === "managed-pack-requires-update",
    );
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(redirect);
    assert.ok(
      redirect.remediation_actions.some((action) =>
        action.command?.includes("update pairslash-plan"),
      ),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("install state records reconciled unmanaged ownership explicitly", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    writeManualInstallFile({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      packId: "pairslash-plan",
      relativePath: "SKILL.md",
      content: "manual override\n",
    });

    const result = applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const skillFile = result.state.packs[0].files.find((file) => file.relative_path === "SKILL.md");
    assert.equal(skillFile.owned_by_pairslash, false);
    assert.equal(skillFile.management_mode, "reconciled_unmanaged");
    assert.equal(skillFile.reconciled_reason_code, "reconcile-unmanaged-override-preserved");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update blocks capability expansion until pack trust is re-reviewed", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.capabilities = [...new Set([...(manifest.capabilities ?? []), "repo_write"])];
        manifest.risk_level = "high";
        return manifest;
      },
    });

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.equal(envelope.plan.trust_delta.overall_status, "blocked");
    assert.deepEqual(
      envelope.plan.trust_delta.pack_changes[0].capability_expansions,
      ["repo_write"],
    );
    assert.ok(
      envelope.plan.errors.some((error) => error === "trust-delta-blocked:pairslash-plan:capability-expanded:repo_write"),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update preserves valid local overrides", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const skillPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "SKILL.md",
    );
    const custom = readFileSync(skillPath, "utf8").replace("pairslash-plan", "pairslash-plan-custom");
    writeManualInstallFile({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      packId: "pairslash-plan",
      relativePath: "SKILL.md",
      content: custom,
    });

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.ok(
      envelope.plan.operations.some(
        (operation) =>
          operation.kind === "preserve_override" && operation.relative_path === "SKILL.md",
      ),
    );
    const result = applyUpdate(envelope);
    assert.equal(
      result.state.packs[0].files.find((file) => file.relative_path === "SKILL.md").local_override,
      true,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update blocks external unverified manifest source by default", serial, () => {
  const fixture = createTempRepo();
  const externalFixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const externalManifestPath = join(
      externalFixture.tempRoot,
      "pairslash-plan.external.manifest.yaml",
    );
    writeFileSync(
      externalManifestPath,
      readFileSync(
        join(fixture.tempRoot, "packs", "core", "pairslash-plan", "pack.manifest.yaml"),
        "utf8",
      ),
    );

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
      to: externalManifestPath,
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.errors.some((error) => error.startsWith("trust-denied:pairslash-plan")),
    );
  } finally {
    runtime.cleanup();
    externalFixture.cleanup();
    fixture.cleanup();
  }
});

test("update plan is blocked when lint bridge finds blocking errors", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.supported_runtime_ranges.copilot_cli = "latest";
        return manifest;
      },
    });
    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.errors.some(
        (error) =>
          error.startsWith("manifest-invalid:pairslash-plan") ||
          error.startsWith("lint-error:LINT-RUNTIME-001:pairslash-plan") ||
          error.startsWith("lint-error:LINT-MANIFEST-001:pairslash-plan"),
      ),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update unchanged emits skip-only plan without replace/create/remove", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, true);
    assert.equal(
      envelope.plan.operations.some((operation) => ["create", "replace", "remove"].includes(operation.kind)),
      false,
    );
    assert.ok(
      envelope.plan.operations.some((operation) => operation.kind === "skip_identical"),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update blocks local modification on non-override file", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const metadataPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "agents",
      "openai.yaml",
    );
    writeFileSync(metadataPath, `${readFileSync(metadataPath, "utf8")}\nmanual: true\n`);

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.operations.some(
        (operation) =>
          operation.kind === "blocked_conflict" &&
          operation.relative_path === "agents/openai.yaml",
      ),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update blocks when ownership metadata was modified locally", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const ownershipPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "pairslash.install.json",
    );
    writeFileSync(ownershipPath, `${readFileSync(ownershipPath, "utf8")}\n`);

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.errors.some((error) => error.startsWith("ownership-mismatch:pairslash-plan")),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update rollback restores filesystem when state write fails", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const sourceSkillPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "SKILL.md",
    );
    writeFileSync(sourceSkillPath, `${readFileSync(sourceSkillPath, "utf8")}\nUpdated upstream line.\n`);

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const installedSkillPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "SKILL.md",
    );
    const previousContent = readFileSync(installedSkillPath, "utf8");
    const statePath = join(fixture.tempRoot, ".pairslash", "install-state", "repo-codex_cli.json");
    rmSync(statePath, { force: true });
    mkdirSync(statePath, { recursive: true });

    assert.throws(() => applyUpdate(envelope), /update failed and rolled back/);
    assert.equal(readFileSync(installedSkillPath, "utf8"), previousContent);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update removes orphaned managed asset when upstream manifest no longer emits it", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const orphanPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "example-output.md",
    );
    assert.ok(existsSync(orphanPath));

    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.assets.include = manifest.assets.include.filter((path) => path !== "example-output.md");
        manifest.runtime_assets.entries = manifest.runtime_assets.entries.filter(
          (entry) => entry.source_path !== "example-output.md" && entry.asset_id !== "example-output-doc",
        );
        manifest.asset_ownership.records = manifest.asset_ownership.records.filter(
          (entry) => entry.asset_id !== "example-output-doc",
        );
        manifest.local_override_policy.eligible_asset_ids = manifest.local_override_policy.eligible_asset_ids.filter(
          (assetId) => assetId !== "example-output-doc",
        );
        manifest.local_override_policy.eligible_paths = manifest.local_override_policy.eligible_paths.filter(
          (path) => path !== "example-output.md",
        );
        manifest.docs_refs.example_output = manifest.docs_refs.example_invocation;
        return manifest;
      },
    });

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.ok(
      envelope.plan.operations.some(
        (operation) => operation.kind === "remove" && operation.relative_path === "example-output.md",
      ),
    );

    applyUpdate(envelope);
    assert.equal(existsSync(orphanPath), false);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("uninstall removes only PairSlash-owned files", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    writeManualInstallFile({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      packId: "pairslash-plan",
      relativePath: "SKILL.md",
      content: "manual override\n",
    });
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    applyUninstall(
      planUninstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const skillPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "SKILL.md",
    );
    assert.ok(existsSync(skillPath), "manual override should survive uninstall");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("uninstall preserves edited managed file and detaches pack state", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const metadataPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "agents",
      "openai.yaml",
    );
    writeFileSync(metadataPath, `${readFileSync(metadataPath, "utf8")}\nmanual: true\n`);

    const result = applyUninstall(
      planUninstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    assert.ok(existsSync(metadataPath));
    assert.equal(result.state.packs.length, 0);
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "install-state", "repo-codex_cli.json")),
      false,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("uninstall warns and detaches when tracked file is already missing", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const missingPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "example-output.md",
    );
    rmSync(missingPath, { force: true });

    const envelope = planUninstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, true);
    assert.ok(
      envelope.plan.warnings.some((warning) =>
        warning.startsWith("orphan-missing:pairslash-plan/example-output.md"),
      ),
    );
    assert.ok(
      envelope.plan.operations.some(
        (operation) =>
          operation.kind === "skip_unmanaged" &&
          operation.relative_path === "example-output.md",
      ),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("uninstall preview blocks when managed install root is no longer a directory", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const installDir = join(fixture.tempRoot, ".agents", "skills", "pairslash-plan");
    rmSync(installDir, { recursive: true, force: true });
    writeFileSync(installDir, "not-a-directory\n");

    const envelope = planUninstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    const blocked = envelope.plan.operations.find(
      (operation) =>
        operation.kind === "blocked_conflict" &&
        operation.pack_id === "pairslash-plan" &&
        operation.relative_path === ".",
    );
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(blocked);
    assert.equal(blocked.reason_code, "unmanaged-conflict-blocking");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("uninstall preserves unknown file and keeps shared container directory", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const unknownPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "notes.txt",
    );
    writeFileSync(unknownPath, "keep me\n");

    const result = applyUninstall(
      planUninstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    assert.ok(existsSync(unknownPath));
    assert.ok(existsSync(join(fixture.tempRoot, ".agents", "skills", "pairslash-plan")));
    assert.equal(result.state.packs.length, 0);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("uninstall rollback restores removed files when state removal fails", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    const skillPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "SKILL.md",
    );
    const statePath = join(fixture.tempRoot, ".pairslash", "install-state", "repo-codex_cli.json");
    const envelope = planUninstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });

    rmSync(statePath, { force: true });
    mkdirSync(statePath, { recursive: true });
    assert.throws(() => applyUninstall(envelope), /uninstall failed and rolled back/);
    assert.ok(existsSync(skillPath));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("uninstall blocks requested pack that is not installed", serial, () => {
  const fixture = createTempRepo();
  try {
    const envelope = planUninstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.errors.some((error) => error.startsWith("pack-not-installed:pairslash-plan")),
    );
  } finally {
    fixture.cleanup();
  }
});

test("install rollback restores filesystem when state write fails", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    const envelope = planInstall({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    mkdirSync(join(fixture.tempRoot, ".pairslash", "install-state", "repo-codex_cli.json"), {
      recursive: true,
    });
    assert.throws(
      () => applyInstall(envelope),
      /install failed and rolled back/,
    );
    const skillPath = join(
      fixture.tempRoot,
      ".agents",
      "skills",
      "pairslash-plan",
      "SKILL.md",
    );
    assert.equal(existsSync(skillPath), false);
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("user-scope copilot install resolves to user home", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ copilotVersion: "2.50.0" });
  try {
    const fakeHome = join(fixture.tempRoot, "fake-home");
    mkdirSync(fakeHome, { recursive: true });
    runtime.setHome(fakeHome);
    const result = applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "copilot_cli",
        target: "user",
        packs: ["pairslash-plan"],
      }),
    );
    assert.ok(
      existsSync(join(fakeHome, ".copilot", "skills", "pairslash-plan", "SKILL.md")),
    );
    assert.equal(result.state.target, "user");
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("user-scope copilot update writes journal and refreshes managed files", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ copilotVersion: "2.50.0" });
  try {
    const fakeHome = join(fixture.tempRoot, "fake-home");
    mkdirSync(fakeHome, { recursive: true });
    runtime.setHome(fakeHome);
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "copilot_cli",
        target: "user",
        packs: ["pairslash-plan"],
      }),
    );
    const sourceSkillPath = join(
      fixture.tempRoot,
      "packs",
      "core",
      "pairslash-plan",
      "SKILL.md",
    );
    writeFileSync(sourceSkillPath, `${readFileSync(sourceSkillPath, "utf8")}\nCopilot update lane.\n`);

    const result = applyUpdate(
      planUpdate({
        repoRoot: fixture.tempRoot,
        runtime: "copilot_cli",
        target: "user",
        packs: ["pairslash-plan"],
      }),
    );
    const installedSkillPath = join(fakeHome, ".copilot", "skills", "pairslash-plan", "SKILL.md");
    assert.match(readFileSync(installedSkillPath, "utf8"), /Copilot update lane/);
    assert.ok(result.journal_path);
    assert.ok(existsSync(result.journal_path));
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("user-scope copilot uninstall removes managed footprint and state", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ copilotVersion: "2.50.0" });
  try {
    const fakeHome = join(fixture.tempRoot, "fake-home");
    mkdirSync(fakeHome, { recursive: true });
    runtime.setHome(fakeHome);
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "copilot_cli",
        target: "user",
        packs: ["pairslash-plan"],
      }),
    );
    const installedSkillPath = join(fakeHome, ".copilot", "skills", "pairslash-plan", "SKILL.md");
    assert.ok(existsSync(installedSkillPath));

    const result = applyUninstall(
      planUninstall({
        repoRoot: fixture.tempRoot,
        runtime: "copilot_cli",
        target: "user",
        packs: ["pairslash-plan"],
      }),
    );
    assert.equal(existsSync(installedSkillPath), false);
    assert.equal(result.state.target, "user");
    assert.equal(
      existsSync(join(fixture.tempRoot, ".pairslash", "install-state", "user-copilot_cli.json")),
      false,
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});

test("update rejects unsupported runtime version from target manifest", serial, () => {
  const fixture = createTempRepo();
  const runtime = installFakeRuntime({ codexVersion: "0.116.0" });
  try {
    applyInstall(
      planInstall({
        repoRoot: fixture.tempRoot,
        runtime: "codex_cli",
        target: "repo",
        packs: ["pairslash-plan"],
      }),
    );
    updatePackManifest({
      repoRoot: fixture.tempRoot,
      packId: "pairslash-plan",
      mutate(manifest) {
        manifest.supported_runtime_ranges.codex_cli = ">=9.9.9";
        return manifest;
      },
    });

    const envelope = planUpdate({
      repoRoot: fixture.tempRoot,
      runtime: "codex_cli",
      target: "repo",
      packs: ["pairslash-plan"],
    });
    assert.equal(envelope.plan.can_apply, false);
    assert.ok(
      envelope.plan.errors.some((error) => error.startsWith("runtime-version-unsupported:pairslash-plan")),
    );
  } finally {
    runtime.cleanup();
    fixture.cleanup();
  }
});
