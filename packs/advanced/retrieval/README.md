# Retrieval Packs

Phase 11 retrieval add-on lives here as an advanced opt-in slice.

Current posture:

- prototype lane outside core discovery
- `pack.manifest.yaml` is lane-local and non-core
- not discoverable by `packs/core` install defaults
- retrieval output is non-authoritative by contract

This lane must never replace Global Project Memory or bypass explicit
write-authority workflows.
