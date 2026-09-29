# delegation-engine

Report-only slice for the Phase 11 Delegation Lane (experimental, opt-in).

Current responsibility:

- explicit, opt-in delegation contract only
- authority-subset validation between caller and worker, checked against the
  canonical capability taxonomy and `trust/pack-authority.yaml` high-risk
  allowlists — any overclaim fails closed (deny, never warn)
- safe-MVP workflow allowlist and denylist enforcement
- no-silent-delegation and no-chain-spawn policy gating
- bounded fan-out enforcement (`max_fan_out = 1`)
- delegated result envelope generation labeled non-authoritative
  (`authoritative: false`, `truth_tier: supplemental`,
  `requires_caller_approval: true`)
- every envelope carries `write_authority_route:
  "pairslash-memory-write-global"` — durable writes route back through the
  write-authority pipeline, never through this lane

Authority model:

- `delegated_capabilities ⊆ caller_capabilities`; delegated atoms must come
  from the canonical `CAPABILITY_FLAGS` vocabulary — unknown atoms deny.
- High-risk atoms (`repo_write`, `shell_exec`, `test_exec`, `mcp_client`)
  additionally require the caller pack to appear in the
  `pack-authority.yaml` `allowed_packs` list for that capability.
- `memory_write_global` may never be delegated, regardless of allowlists.
- `trust/pack-authority.yaml` is consumed read-only; the package performs no
  filesystem writes at all.

Out of scope in this slice:

- runtime-native worker spawning
- direct repo writes or runtime-root writes
- direct task-memory or Global Project Memory writes
- dual-mode or write-authority workflow support
- CLI, installer, doctor, lint, or runtime-adapter integration
