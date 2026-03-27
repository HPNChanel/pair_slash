# Node API Example

This example mirrors the `repo-basic-readonly` compat fixture.

Use it when you want the smallest repo-shaped surface for:

- managed install preview
- repo-target Codex installs
- baseline doctor checks

## Suggested commands

```bash
node ../../packages/tools/cli/src/bin/pairslash.js preview install pairslash-plan --runtime codex --target repo
node ../../packages/tools/cli/src/bin/pairslash.js doctor --runtime codex --target repo
```

The files here are documentation-oriented. Regression truth stays in
`packages/tools/compat-lab/`.
