# Rails Service Example

This example mirrors the `repo-backend-mcp` compat fixture.

Use it when you need a backend-shaped repo that explains:

- MCP-dependent pack output
- doctor behavior when runtime config exists but dependency evidence is partial
- repo-target lifecycle previews for service repos

## Suggested commands

```bash
node ../../packages/tools/cli/src/bin/pairslash.js preview install pairslash-backend --runtime codex --target repo
node ../../packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo --packs pairslash-backend
```
