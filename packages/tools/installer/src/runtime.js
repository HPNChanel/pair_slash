import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";
import { normalizeRuntime, satisfiesRuntimeRange as satisfiesRuntimeRangeFromSpec } from "@pairslash/spec-core";

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

export function satisfiesRuntimeRange(detectedVersion, range) {
  return satisfiesRuntimeRangeFromSpec(detectedVersion, range);
}
