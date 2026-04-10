# Compat-Lab Bug Reproduction

Use this note when a compat-lab lane fails and you need a deterministic local
reproduction before touching public support docs.

## Minimum repro loop

1. Run the narrow compat-lab test or acceptance lane first.
2. Capture the exact lane id, runtime, target, and failing scenario id.
3. Re-run the same command from the repo root without changing fixture inputs.
4. Save the JSON report before attempting any fix.

## Commands

```text
npm run test:compat
npm run test:compat:acceptance -- --lane macos --format json
npm run pairslash -- doctor --runtime codex --target repo --format json
```

## What to capture

- failing command
- lane id
- scenario id
- runtime version
- target (`repo` or `user`)
- exact JSON artifact path or stdout payload

## Guardrails

- Compat-lab evidence is deterministic, fake, or shim-based unless a live lane
  record says otherwise.
- Do not use compat-lab output alone to widen public support claims.
- If the failure touches memory workflows, confirm the read path stayed
  read-only before proposing any fix.
