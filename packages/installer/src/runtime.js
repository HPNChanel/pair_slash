import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";
import { normalizeRuntime } from "@pairslash/spec-core";

export function getRuntimeAdapter(runtime) {
  const normalized = normalizeRuntime(runtime);
  if (normalized === "codex_cli") {
    return codexAdapter;
  }
  if (normalized === "copilot_cli") {
    return copilotAdapter;
  }
  throw new Error(`unsupported runtime: ${runtime}`);
}

function parseSemver(value) {
  const match = typeof value === "string" ? value.match(/(\d+)\.(\d+)\.(\d+)/) : null;
  if (!match) {
    return null;
  }
  return match.slice(1).map((item) => Number.parseInt(item, 10));
}

function compareSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const delta = left[index] - right[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

export function satisfiesRuntimeRange(detectedVersion, range) {
  const parsedDetected = parseSemver(detectedVersion);
  if (!parsedDetected) {
    return range === ">=0.0.0";
  }
  if (typeof range !== "string" || range.trim() === "") {
    return false;
  }
  const trimmed = range.trim();
  if (trimmed.startsWith(">=")) {
    const minVersion = parseSemver(trimmed.slice(2).trim());
    return Boolean(minVersion) && compareSemver(parsedDetected, minVersion) >= 0;
  }
  const exact = parseSemver(trimmed);
  return Boolean(exact) && compareSemver(parsedDetected, exact) === 0;
}

export function detectRuntimeSelection(requestedRuntime) {
  const normalized = normalizeRuntime(requestedRuntime);
  if (normalized && normalized !== "auto") {
    const adapter = getRuntimeAdapter(normalized);
    return {
      runtime: normalized,
      adapter,
      detection: adapter.detectRuntime(),
      ambiguous: false,
    };
  }

  const detections = [
    ["codex_cli", codexAdapter, codexAdapter.detectRuntime()],
    ["copilot_cli", copilotAdapter, copilotAdapter.detectRuntime()],
  ].filter((entry) => entry[2].available);

  if (detections.length !== 1) {
    return {
      runtime: null,
      adapter: null,
      detection: null,
      ambiguous: true,
      candidates: detections.map(([runtime]) => runtime),
    };
  }

  const [runtime, adapter, detection] = detections[0];
  return {
    runtime,
    adapter,
    detection,
    ambiguous: false,
  };
}
