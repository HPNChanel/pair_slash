# delegation-engine

Scaffold-only slice for the Phase 11 Delegation Lane.

Current responsibility:

- explicit, opt-in delegation contract only
- authority-subset validation between caller and worker
- safe-MVP workflow allowlist and denylist enforcement
- no-silent-delegation and no-chain-spawn policy gating
- bounded fan-out enforcement (`max_fan_out = 1`)
- delegated result envelope generation labeled non-authoritative

Out of scope in this slice:

- runtime-native worker spawning
- direct repo writes or runtime-root writes
- direct task-memory or Global Project Memory writes
- dual-mode or write-authority workflow support
- CLI, installer, doctor, lint, or runtime-adapter integration
