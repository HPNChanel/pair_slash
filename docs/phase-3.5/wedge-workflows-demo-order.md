# PairSlash Wedge Workflow Demo Order

Date: 2026-03-25
Status: recommended narrative order

## Summary

Use this order to show PairSlash as an adoption wedge instead of a bundle of
interesting workflows.

The story should move from easy first value, to durable trust, to repeated
day-to-day utility.

## Demo Order

| Order | Workflow | What to show | Why it goes here |
|---|---|---|---|
| 1 | `onboard-repo` | Start cold on a real repo, recover what matters fast, separate facts from assumptions, and identify next workflows | Best first impression and lowest-friction proof of value |
| 2 | `memory-candidate -> memory-write-global` | Extract only evidence-backed memory, show preview, require explicit acceptance, then write with audit posture | Strongest trust-layer proof and clearest moat |
| 3 | `review/fix loop` | Review a real diff, show evidence-backed findings, then hand off into an explicit fix step | Converts trust into recurring utility without leading with broad autonomy |

## Benchmark Order

This is the recommended benchmark order for wedge decisioning:

| Order | Benchmark shape | Goal |
|---|---|---|
| 1 | `onboard-repo` versus manual cold start | Test acquisition and immediate ROI |
| 2 | Memory happy path | Test trust gain on explicit durable write |
| 3 | Memory rejection path | Test whether guardrails are part of the value |
| 4 | `review/fix loop` | Test recurring utility and cleanup reduction |
| 5 | Next-week resume from durable truth | Test retention directly |

Important caveat:

The release-facing Phase 3.5 gate still needs strong evidence on the memory
write and rejection flows before Phase 4 claims broaden. This order is for
wedge decisioning and demo strategy, not for bypassing the trust gate.

## Messaging Order

| Order | Message | Proof to show | Do not say |
|---|---|---|---|
| 1 | "PairSlash gets you back into a repo faster and with fewer false assumptions." | Faster, more correct onboarding than manual repo spelunking | "It understands any repo automatically" |
| 2 | "PairSlash makes durable project truth safe enough to trust." | Candidate filtering, preview, explicit acceptance, audit posture, and rejection under weak evidence | "It updates memory for you automatically" |
| 3 | "PairSlash reduces almost-right AI cleanup without hiding control." | Review findings, explicit fix handoff, and lower rework on repeated jobs | "It is your autonomous coding agent" |

## Recommended Narrative Spine

1. Show the user can get oriented without guessing.
2. Show the user can store durable truth without hidden side effects.
3. Show the user can reduce repeated cleanup while staying in control.

This narrative is stronger than a memory-first story alone because it answers
three adoption questions in sequence:

- Why try it?
- Why trust it?
- Why come back next week?
