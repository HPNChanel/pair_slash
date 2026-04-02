---
title: Phase 10 Framing Brief
phase: 10
status: active-draft
owner_file: docs/phase-10/README.md
baseline_source: docs/phase-9/phase-9-baseline-reality-lock.md
---

# Phase 10 Framing

Phase 10 starts only when PairSlash has already won a narrow wedge and the next credibility problem is no longer "does this workflow help?" but "can I trust what I install, update, and extend?" This is the phase where PairSlash extends trust from workflow behavior to release behavior.

The scope stays narrow. PairSlash is still the trust layer for terminal-native AI workflows, still supports exactly Codex CLI and GitHub Copilot CLI, still treats `/skills` as the canonical front door, and still keeps Global Project Memory explicit-write-only. Phase 10 is business-first, trust-layer-first, and explicit-first. It is not permission to widen the product.

Phase 10 exists because outside packs, upgrade decisions, and release credibility can become product blockers even after the core workflows are good enough to reuse. If release trust is weak, the trust layer stops being believable at the moment users need it most.

# Why This Phase Exists

- Once repeated use exists and outside packs start to matter, release opacity becomes a product problem. A user may trust a PairSlash workflow and still refuse to install or update if they cannot answer who shipped a pack, what changed, and whether rollback remains safe.
- PairSlash only wins if it becomes part of a trusted default path. At that point, opaque releases, fuzzy pack origin, and weak disclosure handling are adoption blockers, not just maintainer inconveniences.
- The business reason for Phase 10 is to protect conversion, reuse, and maintainer credibility when PairSlash starts carrying trust beyond first-party packs.
- This phase exists to make PairSlash credible to ship and extend. It does not exist to inflate security posture on paper.

# What This Phase Is Not

- It is not a security whitepaper project. The output must change what users can trust in release, install, update, and support flows.
- It is not a new agent framework or runtime-expansion program. PairSlash remains narrow and runtime-disciplined.
- It is not a pack marketplace, trust-score feed, or enterprise governance console.
- It is not a compliance-first program that ships ceremony before the product has earned the right to need it.
- It is not a background security product with hidden telemetry, default-on remote verification, or silent trust decisions.

# Entry Conditions

## Allowed To Enter Only When

- Official product-validation evidence shows the wedge is real, not just installable. Trusted Weekly Reuse Rate is at least `60%` overall, with onboarding and memory each at least `50%`.
- Evidence completeness is `100%`. PairSlash is logging the real wins and the real misses, not cherry-picking.
- Memory trust-boundary pass rate and preview-to-write fidelity stay at `100%`. Phase 10 is invalid if the explicit-first trust boundary is wobbling.
- Outside packs already exist, or are close enough to shipping, that pack origin, pack update trust, and maintainer credibility are active product questions.
- Release and support work already need provenance answers. Maintainers are being asked where a pack came from, what release produced it, what changed on upgrade, and how security issues are handled.
- Default surfaces are already usable enough that extra hardening will not destabilize `/skills`, `install`, `doctor`, `lint`, or `preview`.

## Still Not Claimable At Entry

- "Enterprise-grade supply-chain security."
- "Verified-safe third-party packs."
- "Runtime parity across lanes."
- "Automatic trust decisions."
- "Provenance means the code is safe."

# Non-Negotiable Invariants

- PairSlash still supports exactly two runtimes: Codex CLI and GitHub Copilot CLI.
- `/skills` remains the canonical front door. Phase 10 cannot create a competing front door.
- Canonical source packs remain the source of truth. Runtime skill folders stay derived artifacts.
- Global Project Memory remains authoritative, explicit-write-only, previewable, audited, and never implicitly promoted.
- No hidden writes, no hidden telemetry, no hidden trust promotion, and no background daemon become part of the default product.
- Install, update, and uninstall remain preview-first, PairSlash-owned-only, override-preserving, and rollback-safe.
- Doctor, lint, preview, and support flows stay local-first and evidence-bound.
- Hardening must explain trust more clearly without making default workflows heavier, slower, or more confusing.

# Required Outcomes

1. Release integrity / provenance

   PairSlash releases and shipped pack artifacts must carry machine-checkable origin evidence back to canonical source packs and the release action that produced them. This proves release integrity and provenance of PairSlash-owned artifacts. It does not certify that arbitrary code is safe.

2. Pack trust model

   PairSlash must make pack trust explicit, legible, and bounded. First-party packs, external packs, and unverifiable packs cannot all look the same in preview, install, update, or doctor, but trust must never be promoted silently or derived from hidden heuristics.

3. Upgrade safety

   Trust hardening must preserve PairSlash's preview-first lifecycle. Updates must show trust-relevant change before apply, preserve valid local overrides, block unsafe or trust-breaking transitions, and keep rollback as the default recovery path.

4. Security process

   PairSlash needs a real OSS maintainer process for report, triage, fix, disclose, and communicate. The process must be small enough to run, explicit enough to trust, and honest about what is evidence-backed versus still unclaimed.

# Anti-Goals

1. Do not add a third runtime to make Phase 10 look bigger.
2. Do not create a competing front door beside `/skills`.
3. Do not add hidden telemetry, background scanning, or default-on remote trust verification.
4. Do not introduce implicit trust promotion, hidden allowlists, or reputation scoring for packs.
5. Do not turn PairSlash into an enterprise governance suite, compliance bundle, or "safe because signed" marketing surface.

# Failure Modes

- Ceremony too early: if Phase 10 ships signatures, policy, or process before the wedge is real, maintainers pay operational cost without unlocking real trust. The phase becomes theater.
- Trust model half-built: if first-party and external packs are not clearly separated, or provenance exists but is not surfaced in default flows, users get false confidence instead of actionable trust.
- Claim outruns evidence: if docs say "enterprise-grade", "verified", or "secure" before the release evidence and maintainer process exist, PairSlash burns credibility faster than a normal product bug would.
- Explicit-first gets broken: if trust state changes silently, packs are implicitly promoted, or background checks influence behavior without visible preview, Phase 10 violates the core PairSlash contract.
- Product slows without credibility gain: if `/skills`, install, update, doctor, lint, or preview get heavier but users still cannot answer "who shipped this?" or "what changed?", the phase has failed.

# Final Thesis

Phase 10 makes PairSlash credible to install, update, and extend with outside packs by proving where releases come from, keeping pack trust explicit, and preserving preview-first, rollback-safe behavior across the two supported runtimes.

# Keep / Add / Never Add

| Keep from PairSlash core | Allowed additions in Phase 10 | Never add |
| --- | --- | --- |
| Trust layer for terminal-native AI workflows | Release provenance and integrity evidence for PairSlash-owned artifacts | Generic agent framework positioning |
| Exactly two runtimes: Codex CLI and GitHub Copilot CLI | Lane-specific release trust notes | Third runtime or faux parity claims |
| `/skills` as canonical front door | Pack trust state surfaced in preview, install, update, and doctor | A competing front door or pack UX that bypasses `/skills` |
| Explicit-write-only Global Project Memory | Provenance records that explain release origin and trust boundaries | Hidden memory writes or implicit promotion |
| Preview-first install, update, and uninstall with rollback and override safety | Trust-aware upgrade blocking and trust-delta preview | Mutation without preview, rollback, or ownership boundaries |
| Local-first support, redaction, and telemetry off by default | A small OSS security intake, triage, disclosure, and advisory process | Hidden telemetry, background scanning, or default-on remote verification |
| Canonical source packs with derived runtime assets | A bounded first-party vs external pack trust model | Marketplace/governance-suite drift, hidden allowlists, or reputation scoring |
