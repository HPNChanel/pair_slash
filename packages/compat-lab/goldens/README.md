# Golden Outputs

One normalized JSON snapshot per fixture lives here.

Each golden captures:

- compiled bundle summaries for Codex and Copilot
- install preview output
- post-install normalized state when apply succeeds
- doctor report before and after install where applicable

These goldens are Phase 4 regression guards. They are not live runtime evidence.

Host-specific path, OS, and shell values are normalized before snapshotting so
the goldens stay portable across Windows, macOS, and Linux test hosts.
