// Barrel: installer public API. Implementation lives under ./installer/;
// the export surface is identical to the pre-decomposition index.ts.

export {
  applyInstall,
  planInstall,
} from "./installer/install.ts";
export {
  loadStateForDoctor,
} from "./installer/state.ts";
export {
  applyUninstall,
  planUninstall,
} from "./installer/uninstall.ts";
export {
  applyUpdate,
  planUpdate,
} from "./installer/update.ts";

export {
  resolveStatePath,
} from "./state.ts";
export {
  detectRuntimeSelection,
  satisfiesRuntimeRange,
} from "./runtime.ts";
export {
  buildInstallStateMetadataMismatches,
  buildLifecycleCommand,
  buildReviewRemediationAction,
  buildRunCommandRemediationAction,
  collectLifecycleReasonCodes,
  dedupeRemediationActions,
} from "./semantics.ts";
