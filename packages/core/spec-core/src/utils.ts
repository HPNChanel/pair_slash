import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import YAML from "yaml";

const TEXT_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".spec",
  ".txt",
  ".yaml",
  ".yml",
]);

export function toPosix(value) {
  return value.split("\\").join("/");
}

export function normalizeRuntime(value) {
  if (value === "codex" || value === "codex_cli") {
    return "codex_cli";
  }
  if (value === "copilot" || value === "copilot_cli") {
    return "copilot_cli";
  }
  return value;
}

export function normalizeTarget(value) {
  if (value === "repo" || value === "user") {
    return value;
  }
  return value;
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase()) || !extname(filePath);
}

export function readFileNormalized(path) {
  const raw = readFileSync(path);
  if (!isTextFile(path)) {
    return raw;
  }
  return raw.toString("utf8").replace(/\r\n/g, "\n");
}

export function sha256(value) {
  const hash = createHash("sha256");
  hash.update(value);
  return hash.digest("hex");
}

export function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(sortObject(value), null, 2)}\n`;
}

export function stableYaml(value) {
  return YAML.stringify(sortObject(value), {
    lineWidth: 0,
    simpleKeys: true,
  });
}

export function writeTextFile(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, typeof content === "string" ? content : content.toString("utf8"));
}

export function walkFiles(rootDir) {
  const out = [];
  const entries = readdirSync(rootDir, { withFileTypes: true })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absPath = resolve(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(absPath));
      continue;
    }
    out.push(absPath);
  }
  return out;
}

export function relativeFrom(rootDir, filePath) {
  return toPosix(relative(rootDir, filePath));
}

export function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

export function resolveFrom(rootDir, maybeRelative) {
  return resolve(rootDir, maybeRelative);
}

export function summarizeCounts(items, key) {
  return items.reduce((acc, item) => {
    const bucket = item[key];
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});
}
