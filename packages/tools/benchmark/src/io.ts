import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import YAML from "yaml";

export function parseStructuredFile(pathLike: any) {
  const absolutePath = resolve(pathLike);
  const raw = readFileSync(absolutePath, "utf8");
  const extension = extname(absolutePath).toLowerCase();

  if (extension === ".json") {
    return JSON.parse(raw);
  }
  if (extension === ".yaml" || extension === ".yml") {
    return YAML.parse(raw);
  }

  try {
    return JSON.parse(raw);
  } catch {
    return YAML.parse(raw);
  }
}

export function hasValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

export function hasOwnValue(record: any, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key) && hasValue(record[key]);
}

export function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function toBoolean(value: unknown) {
  return value === true;
}

export function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function median(values: unknown[]) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = values
    .filter((value: unknown): value is number => Number.isFinite(value))
    .slice()
    .sort((left: any, right: any) => left - right);
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(4));
  }
  return Number(sorted[middle].toFixed(4));
}

export function safeRate(numerator: any, denominator: any) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(4));
}

export function percent(rate: any) {
  if (!Number.isFinite(rate)) {
    return null;
  }
  return Number((rate * 100).toFixed(2));
}

export function matchesCondition(record: any, condition: any = {}) {
  for (const [key, expected] of Object.entries(condition)) {
    const actual = record?.[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) {
        return false;
      }
      continue;
    }
    if (expected !== actual) {
      return false;
    }
  }
  return true;
}
