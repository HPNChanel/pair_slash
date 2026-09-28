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

export function toPosix(value: string): string {
  return value.split("\\").join("/");
}

export function normalizeRuntime(value: unknown): string {
  if (value === "codex" || value === "codex_cli") {
    return "codex_cli";
  }
  if (value === "copilot" || value === "copilot_cli") {
    return "copilot_cli";
  }
  return value as string;
}

export function normalizeTarget(value: unknown): string {
  if (value === "repo" || value === "user") {
    return value;
  }
  return value as string;
}

export function normalizeSkillRoot(value: unknown): "runtime-default" | "shared-agents" {
  if (value === undefined || value === null || value === "" || value === "runtime-default") {
    return "runtime-default";
  }
  if (value === "shared-agents") {
    return value;
  }
  throw new Error(`unsupported skill_root: ${value}; expected one of runtime-default, shared-agents`);
}

export function normalizeEmitMode(value: unknown): "skill" | "plugin" {
  if (value === undefined || value === null || value === "" || value === "skill") {
    return "skill";
  }
  if (value === "plugin") {
    return value;
  }
  throw new Error(`unsupported emit mode: ${value}; expected one of skill, plugin`);
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function isTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase()) || !extname(filePath);
}

export function readFileNormalized(path: string): string | NonSharedBuffer {
  const raw = readFileSync(path);
  if (!isTextFile(path)) {
    return raw;
  }
  return raw.toString("utf8").replace(/\r\n/g, "\n");
}

export function sha256(value: string | NonSharedBuffer | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(value);
  return hash.digest("hex");
}

export type SortableValue =
  | string
  | number
  | boolean
  | null
  | SortableValue[]
  | { [key: string]: SortableValue };

export function sortObject(value: unknown): SortableValue {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, SortableValue>>((acc, key) => {
        acc[key] = sortObject((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value as SortableValue;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortObject(value), null, 2)}\n`;
}

export function stableYaml(value: unknown): string {
  return YAML.stringify(sortObject(value), {
    lineWidth: 0,
    simpleKeys: true,
  });
}

export function writeTextFile(path: string, content: string | NonSharedBuffer | Uint8Array): void {
  ensureDir(dirname(path));
  writeFileSync(path, typeof content === "string" ? content : content.toString("utf8"));
}

export function walkFiles(rootDir: string): string[] {
  const out: string[] = [];
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

export function relativeFrom(rootDir: string, filePath: string): string {
  return toPosix(relative(rootDir, filePath));
}

export function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

export function resolveFrom(rootDir: string, maybeRelative: string): string {
  return resolve(rootDir, maybeRelative);
}

export function summarizeCounts(items: Array<Record<string, string>>, key: string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const bucket = item[key];
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});
}
