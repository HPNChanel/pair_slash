import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

function writeExecutable(path, contents) {
  writeFileSync(path, contents, { mode: 0o755 });
  try {
    chmodSync(path, 0o755);
  } catch {
    // chmod is best-effort for cross-platform test harnesses.
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

export function installFakeRuntimes({
  codexVersion = "0.116.0",
  copilotVersion = "2.50.0",
} = {}) {
  const binDir = join(tmpdir(), `pairslash-compat-runtime-${process.pid}-${Date.now()}`);
  mkdirSync(binDir, { recursive: true });

  const previousPath = process.env.PATH ?? "";
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  const previousCodexVersion = process.env.PAIRSLASH_FAKE_CODEX_VERSION;
  const previousCopilotVersion = process.env.PAIRSLASH_FAKE_COPILOT_VERSION;

  writeCodexShim(binDir, codexVersion);
  writeCopilotShim(binDir, copilotVersion);

  process.env.PATH = `${binDir}${delimiter}${previousPath}`;
  process.env.PAIRSLASH_FAKE_CODEX_VERSION = codexVersion;
  process.env.PAIRSLASH_FAKE_COPILOT_VERSION = copilotVersion;

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
