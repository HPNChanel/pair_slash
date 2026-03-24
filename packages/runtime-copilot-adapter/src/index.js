import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join, posix } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

export const runtime = "copilot_cli";
export const shortName = "copilot";
export const bundleKind = "copilot-package-bundle";
export const canonicalEntrypoint = "/skills";
export const executable = "gh";
export const supportedInstallSurfaces = [
  "canonical_skill",
  "support_doc",
  "metadata",
  "agent",
  "hook",
  "mcp",
];

export function renderDirectInvocation(packId) {
  return `/${packId}`;
}

export function resolveConfigHome({ repoRoot, target }) {
  return target === "repo" ? join(repoRoot, ".github") : join(homedir(), ".copilot");
}

export function resolveInstallRoot(options) {
  return join(resolveConfigHome(options), "skills");
}

export function resolvePackInstallDir(options, packId) {
  return join(resolveInstallRoot(options), packId);
}

export function resolveAssetPath(asset) {
  switch (asset.install_surface) {
    case "canonical_skill":
    case "support_doc":
      return asset.source_relpath ?? asset.file_name;
    case "metadata":
      return posix.join("package", asset.file_name);
    case "agent":
      return posix.join("agents", asset.file_name);
    case "hook":
      return posix.join("hooks", asset.file_name);
    case "mcp":
      return posix.join("mcp", asset.file_name);
    default:
      throw new Error(`copilot runtime does not support install surface ${asset.install_surface}`);
  }
}

export function supportsInstallSurface(surface) {
  return supportedInstallSurfaces.includes(surface);
}

function spawnRuntime(args) {
  const options = { encoding: "utf8" };
  const direct = spawnSync(executable, args, options);
  if (
    process.platform !== "win32" ||
    !["ENOENT", "EINVAL"].includes(direct.error?.code ?? "")
  ) {
    return direct;
  }
  return spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", executable, ...args], options);
}

export function detectRuntime() {
  const copilot = spawnRuntime(["copilot", "--help"]);
  const ghVersion = spawnRuntime(["--version"]);
  const versionLine = ghVersion.stdout?.trim().split(/\r?\n/, 1)[0] ?? "";
  const versionMatch = versionLine.match(/(\d+\.\d+\.\d+)/);
  const version = versionMatch?.[1] ?? "unknown";
  if (copilot.status === 0) {
    return {
      available: true,
      executable,
      version,
    };
  }
  return {
    available: false,
    executable,
    version: null,
    error: copilot.error?.message || copilot.stderr?.trim() || "gh copilot not found",
  };
}

export function checkWritablePath(path) {
  try {
    accessSync(path, constants.W_OK);
    return { writable: true };
  } catch (error) {
    return { writable: false, error: error.message };
  }
}
