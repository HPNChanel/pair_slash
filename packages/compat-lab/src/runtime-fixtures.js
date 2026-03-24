import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function installFakeRuntimes({
  codexVersion = "0.116.0",
  copilotVersion = "1.0.0",
} = {}) {
  const binDir = join(tmpdir(), `pairslash-compat-runtime-${process.pid}-${Date.now()}`);
  mkdirSync(binDir, { recursive: true });

  const previousPath = process.env.PATH ?? "";
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;

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

  process.env.PATH = `${binDir};${previousPath}`;

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
      rmSync(binDir, { recursive: true, force: true });
    },
  };
}
