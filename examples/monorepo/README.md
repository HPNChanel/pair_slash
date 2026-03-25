# Monorepo Example

This example mirrors the `repo-monorepo-workspaces` compat fixture.

Use it when you want to see stable repo-root resolution across:

- multiple apps
- shared packages
- Copilot package-native output

## Suggested commands

```bash
node ../../packages/cli/src/bin/pairslash.js preview install pairslash-plan --runtime copilot --target repo
node ../../packages/cli/src/bin/pairslash.js preview install pairslash-frontend --runtime copilot --target repo
```
