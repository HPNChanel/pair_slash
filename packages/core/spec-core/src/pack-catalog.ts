// Barrel: pack catalog public API. Implementation lives under ./catalog/;
// the export surface is identical to the pre-decomposition pack-catalog.ts.

export {
  buildPackCatalogIndex,
  findPublicCompatibilityLane,
  hasRecordedLiveTestedRange,
  loadAuthoritativeCatalog,
  loadPackCatalogRecords,
  loadPublicSupportSnapshot,
  normalizePublicOsLane,
  publicSupportLevelToDoctorLaneStatus,
  renderPackCatalogIndexYaml,
  selectDefaultCatalogPack,
} from "./catalog/builders.ts";
export {
  DEFAULT_PUBLIC_COMPATIBILITY_LANES,
  DEFAULT_PUBLIC_KNOWN_ISSUES,
  DEFAULT_PUBLIC_RELEASE_GATES,
  DEFAULT_PUBLIC_SUPPORT_POLICY,
} from "./catalog/constants.ts";
