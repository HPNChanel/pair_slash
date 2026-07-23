// PairSlash memory-engine public entrypoint.
//
// Phase M1 (modernization foundation): this file was previously a 1390-line
// monolith. It has been decomposed into focused modules without changing the
// public API or any behavior:
//
//   - internal.js ............ constants, pure helpers, shared matchers
//   - records.js ............. file/directory readers, mutations, index update
//   - conflict.js ............ duplicate/conflict/shadow/candidate detection
//   - request.js ............. manifest loading, request normalization, audit
//   - pipeline.js ............ common analysis, staging artifact, result base
//   - preview.js ............. previewMemoryWrite, loadStagedMemoryWritePreview
//   - apply.js ............... applyMemoryWrite, rejectMemoryWrite
//   - audit.js ............... buildMemoryAuditReport (pre-existing, read-only)
//   - candidate.js ........... buildMemoryCandidateReport (pre-existing, read-only)
//
// The tests in `tests/memory-engine.test.js` import only the public surface
// below and are the contract for "zero behavioral change".

export { loadRequestFile } from "./records.ts";
export { previewMemoryWrite, loadStagedMemoryWritePreview } from "./preview.ts";
export { applyMemoryWrite, rejectMemoryWrite } from "./apply.ts";
export { buildMemoryCandidateReport } from "./candidate.ts";
export { buildMemoryAuditReport } from "./audit.ts";
