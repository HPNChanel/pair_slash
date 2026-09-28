---
id: T4-06
track: T4
title: Trust/managed-hooks + runtime toggle gaps in doctor guidance
status: done
depends_on: [T4-01]
est_size: S
claimed_by: devin
claimed_at: 2026-09-28
completed_at: 2026-09-28
evidence:
  - "verified (developers.openai.com/codex/hooks + config-reference): [features] hooks=false kills hooks (codex_hooks deprecated alias); unmanaged hooks hash-pinned + skipped until /hooks trust; managed hooks (system/MDM/requirements.toml) trusted by policy + not user-disableable; requirements.toml allow_managed_hooks_only skips unmanaged incl. plugin hooks"
  - "verified (copilot-cli changelog): 'Enabling and disabling hooks and LSP servers is temporarily unavailable' after /plugins removal (CP-19); disableAllHooks in ~/.copilot/settings.json + .github/copilot/settings*.json is the all-or-nothing off switch; policy/user/project/plugin hook sources"
  - "verified: --add-dir loads .github/skills + .github/agents as trusted config (command reference + changelog) — skills may appear from non-installed sources"
  - "doctor: new informational runtime.hooks_state check — codex lane parses [features].hooks/codex_hooks across user+project config.toml layers (last wins) + reads requirements.toml for managed policy; copilot lane reads disableAllHooks from user settings.json + repo settings.json/settings.local.json; states enabled/disabled/managed-restricted/unknown; never writes config"
  - "PAIRSLASH_DOCTOR_CODEX_REQUIREMENTS env override added for deterministic managed-path testing/diagnostics"
  - "docs: codex-cli.md hook bullet extended (trust-hash, features flag, managed hooks, bypass); copilot-cli.md (disableAllHooks, toggle gap, --add-dir provenance); phase-4-doctor-troubleshooting.md new checks + hooks/provenance FAQ with review-then-trust guidance"
  - "tests: 5 new cases; doctor 44/44; goldens regenerated (hooks_state: enabled default lanes)"
  - "gates: typecheck pass, lint pass, npm test all pass, test:release pass"
---

## Objective

Document the trust/interoperability surface honestly: Codex trust-by-hash hook review, managed `requirements.toml` hooks, `[features] hooks=false`, Copilot's temporarily-unavailable hook toggles, `--add-dir` skill sources — and make doctor guidance reflect them.

## Context & sources

- Codex: unmanaged hooks skipped until trusted via `/hooks`; hash-pinned re-review; managed hooks from `requirements.toml` can't be disabled by users; `[features] hooks=false` global kill (CX-10/11/12).
- Copilot: after `/plugins` removal, per-hook enable/disable toggles are temporarily unavailable (CP-19) — guidance must not reference toggles that don't exist.
- `--add-dir` discovery (CP-08) means skills may come from outside the installed roots — doctor/doctor-guidance should mention this when diagnosing "unexpected skill" issues.

## Files to touch

- `packages/tools/doctor/src/` — guidance strings for hooks states (if the checks exist) or new informational check for hooks-disabled config
- `docs/workflows/phase-4-doctor-troubleshooting.md` or successor doc — hooks troubleshooting section
- `docs/runtime-mapping/*.md` — trust-flow notes
- Do NOT touch: hook emitters (T4-01), runtime config enforcement (none exists — by design)

## Work steps

1. Add doctor awareness for `hooks = false` (Codex config) and Copilot hook-toggle gap — informational findings: "write-authority preflight hooks will be skipped while hooks are disabled".
2. Update troubleshooting doc: hook trust-review flow (Codex), Copilot toggle gap, `--add-dir` skill provenance.
3. Cross-link T4-01's emitted hooks docs.
4. Gates.

## Constraints (STRICT)

- MUST NOT instruct users to trust hooks blindly — guidance says review-then-trust (security S-rules).
- MUST NOT reference runtime features that don't exist at the documented versions (verify each claim).
- MUST keep guidance version-aware where behavior differs (hooks-disabled note is Codex-specific; toggle-gap is Copilot-specific).
- MUST NOT auto-modify runtime config to enable hooks — report only.

## Acceptance gates

- [x] Doctor guidance covers the documented states
- [x] Troubleshooting doc updated
- [x] Gates green

## Evidence to record

- States documented per runtime; sources cited.

## Rollback

`git revert`.
