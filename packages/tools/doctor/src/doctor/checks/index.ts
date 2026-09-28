import {
  runAssetPlacement,
} from "./asset-placement.ts";
import {
  runInstallRootCheck,
  runSharedSkillRootSupport,
  runUnmanagedInstallRoot,
  runWritePermissionCheck,
} from "./install-root.ts";
import {
  runManifestNamingConflicts,
  runManifestRuntimeTargets,
  runManifestValidation,
} from "./manifest.ts";
import {
  runInstallStateLoad,
  runOwnedFilesIntegrity,
} from "./owned-files.ts";
import {
  runPlatformSupport,
  runShellProfileCandidates,
  runSupportLane,
} from "./platform.ts";
import {
  runInstallPreviewParity,
  runUpdatePreviewRisk,
} from "./preview-risk.ts";
import {
  runRequiredMcpServers,
  runRequiredTools,
} from "./required-tools.ts";
import {
  runCodexDaemonState,
  runHooksState,
  runRuntimeDetect,
  runRuntimePresenceMatrix,
  runRuntimeSurfaceProbe,
  runRuntimeTestedRange,
  runRuntimeVersionRange,
} from "./runtime-detect.ts";
import {
  runConfigHomeCheck,
  runScopeRepoRoot,
} from "./scope.ts";
import {
  runInstalledTrustPosture,
} from "./trust-posture.ts";
import {
  runWorkflowMaturityAlignment,
} from "./workflow-maturity.ts";

export const CHECKS = [
  runRuntimePresenceMatrix,
  runRuntimeDetect,
  runRuntimeSurfaceProbe,
  runCodexDaemonState,
  runHooksState,
  runRuntimeVersionRange,
  runRuntimeTestedRange,
  runSupportLane,
  runPlatformSupport,
  runShellProfileCandidates,
  runScopeRepoRoot,
  runConfigHomeCheck,
  runInstallRootCheck,
  runWritePermissionCheck,
  runInstallStateLoad,
  runManifestValidation,
  runManifestRuntimeTargets,
  runManifestNamingConflicts,
  runWorkflowMaturityAlignment,
  runRequiredTools,
  runSharedSkillRootSupport,
  runRequiredMcpServers,
  runInstalledTrustPosture,
  runOwnedFilesIntegrity,
  runUpdatePreviewRisk,
  runInstallPreviewParity,
  runUnmanagedInstallRoot,
  runAssetPlacement,
];
