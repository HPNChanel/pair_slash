import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { normalizePackManifestV2, serializePackManifestV2 } from "@pairslash/spec-core";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function writeExecutable(path, contents) {
  writeFileSync(path, contents, { mode: 0o755 });
  try {
    chmodSync(path, 0o755);
  } catch {
    // chmod is best-effort for cross-platform fake runtimes.
  }
}

function writeCodexShim(binDir, version) {
  writeFileSync(
    join(binDir, "codex.cmd"),
    [
      "@echo off",
      "if \"%1\"==\"--version\" (",
      `  echo ${version}`,
      "  exit /b 0",
      ")",
      "echo unsupported codex command 1>&2",
      "exit /b 1",
      "",
    ].join("\r\n"),
  );
  if (process.platform === "win32") {
    return;
  }
  writeExecutable(
    join(binDir, "codex"),
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"--version\" ]; then",
      `  printf '%s\\n' '${version}'`,
      "  exit 0",
      "fi",
      "printf '%s\\n' 'unsupported codex command' >&2",
      "exit 1",
      "",
    ].join("\n"),
  );
}

function writeCopilotShim(binDir, version) {
  writeFileSync(
    join(binDir, "gh.cmd"),
    [
      "@echo off",
      "if \"%1\"==\"--version\" (",
      `  echo gh version ${version}`,
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
  if (process.platform === "win32") {
    return;
  }
  writeExecutable(
    join(binDir, "gh"),
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"--version\" ]; then",
      `  printf '%s\\n' 'gh version ${version}'`,
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"copilot\" ] && [ \"$2\" = \"--help\" ]; then",
      "  printf '%s\\n' 'gh copilot help'",
      "  exit 0",
      "fi",
      "printf '%s\\n' 'unsupported gh command' >&2",
      "exit 1",
      "",
    ].join("\n"),
  );
}

export function createTempRepo({ packs = ["pairslash-plan"] } = {}) {
  const tempRoot = mkdtempSync(join(tmpdir(), "pairslash-phase4-"));
  mkdirSync(join(tempRoot, "packs", "core"), { recursive: true });
  mkdirSync(join(tempRoot, ".pairslash"), { recursive: true });
  cpSync(join(repoRoot, "packages"), join(tempRoot, "packages"), {
    recursive: true,
  });
  for (const packId of packs) {
    cpSync(join(repoRoot, "packs", "core", packId), join(tempRoot, "packs", "core", packId), {
      recursive: true,
    });
  }
  if (existsSync(join(repoRoot, "docs", "compatibility"))) {
    cpSync(join(repoRoot, "docs", "compatibility"), join(tempRoot, "docs", "compatibility"), {
      recursive: true,
    });
  }
  if (existsSync(join(repoRoot, "docs", "runtime-mapping"))) {
    cpSync(join(repoRoot, "docs", "runtime-mapping"), join(tempRoot, "docs", "runtime-mapping"), {
      recursive: true,
    });
  }
  if (existsSync(join(repoRoot, "docs", "releases"))) {
    cpSync(join(repoRoot, "docs", "releases"), join(tempRoot, "docs", "releases"), {
      recursive: true,
    });
  }
  if (existsSync(join(repoRoot, "docs", "evidence", "live-runtime"))) {
    cpSync(join(repoRoot, "docs", "evidence", "live-runtime"), join(tempRoot, "docs", "evidence", "live-runtime"), {
      recursive: true,
    });
  }
  if (existsSync(join(repoRoot, ".pairslash", "project-memory"))) {
    cpSync(join(repoRoot, ".pairslash", "project-memory"), join(tempRoot, ".pairslash", "project-memory"), {
      recursive: true,
    });
  }
  if (existsSync(join(repoRoot, "trust"))) {
    cpSync(join(repoRoot, "trust"), join(tempRoot, "trust"), {
      recursive: true,
    });
  }
  if (existsSync(join(repoRoot, "SECURITY.md"))) {
    cpSync(join(repoRoot, "SECURITY.md"), join(tempRoot, "SECURITY.md"));
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

export function updatePackTrustAuthority({ repoRoot: tempRoot, mutate }) {
  const authorityPath = join(tempRoot, "trust", "pack-authority.yaml");
  const rawAuthority = YAML.parse(readFileSync(authorityPath, "utf8"));
  const updated = mutate(structuredClone(rawAuthority)) ?? rawAuthority;
  writeFileSync(authorityPath, YAML.stringify(updated, {
    lineWidth: 0,
    simpleKeys: true,
  }));
  return authorityPath;
}

export function installFakeRuntime({ codexVersion = null, copilotVersion = null } = {}) {
  const binDir = mkdtempSync(join(tmpdir(), "pairslash-runtime-"));
  const previousPath = process.env.PATH ?? "";
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  const previousCodexVersion = process.env.PAIRSLASH_FAKE_CODEX_VERSION;
  const previousCopilotVersion = process.env.PAIRSLASH_FAKE_COPILOT_VERSION;

  if (codexVersion) {
    writeCodexShim(binDir, codexVersion);
    process.env.PAIRSLASH_FAKE_CODEX_VERSION = codexVersion;
  }

  if (copilotVersion) {
    writeCopilotShim(binDir, copilotVersion);
    process.env.PAIRSLASH_FAKE_COPILOT_VERSION = copilotVersion;
  }

  process.env.PATH = `${binDir}${delimiter}${previousPath}`;

  return {
    binDir,
    setHome(homePath) {
      mkdirSync(homePath, { recursive: true });
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
      if (previousCodexVersion === undefined) {
        delete process.env.PAIRSLASH_FAKE_CODEX_VERSION;
      } else {
        process.env.PAIRSLASH_FAKE_CODEX_VERSION = previousCodexVersion;
      }
      if (previousCopilotVersion === undefined) {
        delete process.env.PAIRSLASH_FAKE_COPILOT_VERSION;
      } else {
        process.env.PAIRSLASH_FAKE_COPILOT_VERSION = previousCopilotVersion;
      }
      rmSync(binDir, { recursive: true, force: true });
    },
  };
}
