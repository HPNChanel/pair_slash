# Track T1 — Runtime surface realignment

**Status:** Approved | **Priority:** P1 | **Depends on:** T0
**Goal:** Bring every runtime-facing truth file, doc, and check up to the Sep-2026 reality: Codex CLI ~0.157, GitHub Copilot CLI ~1.0.88, and the actual current surfaces (plugins dashboard, hooks, daemon, model catalog).

## Context

`docs/compatibility/runtime-surface-matrix.yaml` pins recommended versions Codex 0.116/0.118 and Copilot "2.50.x". The Copilot entry is suspect — the real Copilot CLI release series is `v1.0.x` (v1.0.88 on 2026-09-21). Pinning a non-existent series is a data-integrity defect, not just staleness. `10-stack-profile.yaml` describes pre-plugin-era surfaces. Known issue K1 (`-p` drops plugin skills) was fixed upstream in the v1.0.8x window and must be re-verified rather than assumed. The `/skills` surface itself changed on Copilot (picker → unified dashboard), which affects how "canonical picker" evidence is interpreted.

## Entry gate

- T0 exit green (clean tree, all gates pass).

## Tasks (ordered)

| Task | Title | Depends on |
| --- | --- | --- |
| T1-01 | Verify current runtime versions & surfaces (evidence capture) | — |
| T1-02 | Update runtime-surface-matrix.yaml + stack profile to verified reality | T1-01 |
| T1-03 | Refresh runtime-mapping docs (codex-cli.md, copilot-cli.md) | T1-01 |
| T1-04 | Update `supported_runtime_ranges` across pack manifests | T1-02 |
| T1-05 | Update doctor version-detection surfaces | T1-02 |
| T1-06 | Re-verify Copilot K1 (`-p` plugin-skill drop) and Codex K3 (PowerShell sandbox) | T1-01 |
| T1-07 | Regenerate compatibility-matrix.md, sync derived artifacts, record drift evidence | T1-02…T1-06 |

## Exit gate

- `runtime-surface-matrix.yaml` recommended/baseline versions reflect verified current releases; every changed lane carries a dated evidence note.
- `compatibility-matrix.md` regenerated; `npm run sync:compat-lab -- --check` green.
- K1/K3 statuses reflect re-verified truth (either still blocked with fresh evidence, or updated with superseding evidence — never silently flipped).
- No support-level promotion occurs in this track; realignment ≠ lane promotion (C.6).

## Risks

- Overclaiming by accident: bumping `recommended_version` does not change `support_level` — the lane evidence rules are unchanged.
- The Copilot version discrepancy may indicate the original matrix measured the wrong binary; T1-01 must identify the exact installation source (`copilot` CLI vs `gh copilot` extension vs npm package) before writing.
