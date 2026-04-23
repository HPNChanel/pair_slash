# Pack Lifecycle Checklist

Use this checklist when triaging pack-level support or release-channel changes.

## Intake

- Confirm issue template surface and mandatory labels (`surface:*`, `status:*`, optional `pack:<id>`).
- Confirm pack id and manifest path under `packs/core/<pack-id>/pack.manifest.yaml`.
- Confirm runtime and target lane from issue evidence.

## Verify

- Run `npm run pairslash -- doctor --runtime <codex|copilot> --target <repo|user> --format json`.
- Run `npm run pairslash -- preview install <pack-id> --runtime <codex|copilot> --target <repo|user> --format json`.
- If needed, capture `npm run pairslash -- trace export --latest --runtime <codex|copilot> --support-bundle --include-doctor --format json`.

## Decide

- Use `type:bug` only when behavior conflicts with shipped scope or trust rules.
- Use `type:docs-drift` for wording/claim mismatch.
- Use `type:evidence-gap` when support widening lacks runtime evidence.
- Keep workflow maturity wording aligned with `docs/architecture/phase-18-workflow-maturity-wording-system.md`.

## Guardrails

- Do not widen runtime claims beyond `docs/compatibility/compatibility-matrix.md`.
- Do not claim package-manager publication; see `docs/releases/legal-packaging-status.md`.
- Keep `/skills` as canonical front door and preserve two-runtime scope.
