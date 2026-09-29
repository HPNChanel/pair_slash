import * as codexAdapter from "@pairslash/runtime-codex-adapter";
import * as copilotAdapter from "@pairslash/runtime-copilot-adapter";
import { normalizeRuntime, satisfiesRuntimeRange as satisfiesRuntimeRangeFromSpec } from "@pairslash/spec-core";

export function getRuntimeAdapter(runtime: string) {
  const normalized = normalizeRuntime(runtime);
  if (normalized === "codex_cli") {
    return codexAdapter;
  }
  if (normalized === "copilot_cli") {
    return copilotAdapter;
  }
  throw new Error(`unsupported runtime: ${runtime}`);
}

export function detectRuntimeSelection(requestedRuntime: any):
  | { runtime: string; adapter: any; detection: any; ambiguous: false }
  | { runtime: null; adapter: null; detection: null; ambiguous: true; candidates: string[] } {
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

  const detections: [string, any, any][] = ([
    ["codex_cli", codexAdapter, codexAdapter.detectRuntime()],
    ["copilot_cli", copilotAdapter, copilotAdapter.detectRuntime()],
  ] as [string, any, any][]).filter((entry: any) => entry[2]?.available);

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

export function satisfiesRuntimeRange(detectedVersion: string, range: string) {
  return satisfiesRuntimeRangeFromSpec(detectedVersion, range);
}
