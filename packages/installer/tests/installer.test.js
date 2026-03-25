import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
} from "../../../tests/phase4-helpers.js";

const serial = { concurrency: false };

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
        manifest.local_override_policy.eligible_paths = manifest.local_override_policy.eligible_paths.filter(
          (path) => path !== "example-output.md",
        );
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
