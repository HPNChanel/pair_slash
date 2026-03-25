import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { normalizePackManifestV2, serializePackManifestV2 } from "@pairslash/spec-core";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function createTempRepo({ packs = ["pairslash-plan"] } = {}) {
  const tempRoot = mkdtempSync(join(tmpdir(), "pairslash-phase4-"));
  mkdirSync(join(tempRoot, "packs", "core"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash"), { recursive: true });
  for (const packId of packs) {
    cpSync(join(repoRoot, "packs", "core", packId), join(tempRoot, "packs", "core", packId), {
      recursive: true,
    });
  }
  return {
    tempRoot,
    cleanup() {
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

export function writeManualInstallFile({ repoRoot: tempRoot, runtime, packId, relativePath, content }) {
  const installRoot =
    runtime === "codex_cli"
      ? join(tempRoot, ".agents", "skills", packId)
      : join(tempRoot, ".github", "skills", packId);
  mkdirSync(installRoot, { recursive: true });
  writeFileSync(join(installRoot, relativePath), content);
}

export function updatePackManifest({ repoRoot: tempRoot, packId, mutate }) {
  const manifestPath = join(tempRoot, "packs", "core", packId, "pack.manifest.yaml");
  const rawManifest = YAML.parse(readFileSync(manifestPath, "utf8"));
  const normalizedManifest = normalizePackManifestV2(rawManifest, { attachAliases: true }) ?? rawManifest;
  const updated = mutate(structuredClone(normalizedManifest)) ?? normalizedManifest;
  writeFileSync(manifestPath, YAML.stringify(serializePackManifestV2(updated), {
    lineWidth: 0,
    simpleKeys: true,
  }));
  return manifestPath;
}

export function installFakeRuntime({ codexVersion = null, copilotVersion = null } = {}) {
  const binDir = mkdtempSync(join(tmpdir(), "pairslash-runtime-"));
  const previousPath = process.env.PATH ?? "";
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;

  if (codexVersion) {
    writeFileSync(
      join(binDir, "codex.cmd"),
      [
        "@echo off",
        "if \"%1\"==\"--version\" (",
        `  echo ${codexVersion}`,
        "  exit /b 0",
        ")",
        "echo unsupported codex command 1>&2",
        "exit /b 1",
        "",
      ].join("\r\n"),
    );
  }

  if (copilotVersion) {
    writeFileSync(
      join(binDir, "gh.cmd"),
      [
        "@echo off",
        "if \"%1\"==\"--version\" (",
        `  echo gh version ${copilotVersion}`,
        "  exit /b 0",
        ")",
        "if \"%1\"==\"copilot\" if \"%2\"==\"--help\" (",
        "  echo gh copilot help",
        "  exit /b 0",
        ")",
        "echo unsupported gh command 1>&2",
        "exit /b 1",
        "",
      ].join("\r\n"),
    );
  }

  process.env.PATH = `${binDir};${previousPath}`;

  return {
    binDir,
    setHome(homePath) {
      process.env.HOME = homePath;
      process.env.USERPROFILE = homePath;
    },
    restoreHome() {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
    },
    cleanup() {
      process.env.PATH = previousPath;
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      rmSync(binDir, { recursive: true, force: true });
    },
  };
}
