import { readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  INSTALL_STATE_SCHEMA_VERSION,
  ensureDir,
  exists,
  stableJson,
  validateInstallState,
  writeTextFile,
} from "@pairslash/spec-core";

export function resolveStatePath({ repoRoot, runtime, target }) {
  return resolve(repoRoot, ".pairslash", "install-state", `${target}-${runtime}.json`);
}

export function buildEmptyState({ repoRoot, runtime, target, adapter }) {
  return {
    kind: "install-state",
    schema_version: INSTALL_STATE_SCHEMA_VERSION,
    runtime,
    target,
    config_home: adapter.resolveConfigHome({ repoRoot, target }),
    install_root: adapter.resolveInstallRoot({ repoRoot, target }),
    updated_at: null,
    last_transaction_id: null,
    packs: [],
  };
}

export function loadInstallState({ repoRoot, runtime, target, adapter }) {
  const statePath = resolveStatePath({ repoRoot, runtime, target });
  if (!exists(statePath)) {
    return {
      statePath,
      state: buildEmptyState({ repoRoot, runtime, target, adapter }),
    };
  }
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const errors = validateInstallState(state);
  if (errors.length > 0) {
    throw new Error(`invalid install state ${statePath} :: ${errors.join("; ")}`);
  }
  return { statePath, state };
}

export function writeInstallState(statePath, state) {
  ensureDir(dirname(statePath));
  writeTextFile(statePath, stableJson(state));
}

export function removeInstallState(statePath) {
  if (exists(statePath)) {
    rmSync(statePath, { force: true });
  }
}

export function findStatePack(state, packId) {
  return state.packs.find((pack) => pack.id === packId) ?? null;
}
