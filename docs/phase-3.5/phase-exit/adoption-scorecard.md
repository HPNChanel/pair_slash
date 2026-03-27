# PairSlash Phase 3.5 Adoption Scorecard

Date: 2026-03-25
Status: pre-benchmark baseline

This scorecard is for deciding whether PairSlash is earning habit, not whether
the docs or architecture look mature.

| Metric | Target | Current confidence | Measurement source | Owner | Next action |
|---|---|---|---|---|---|
| Trusted Weekly Reuse Rate | `>= 60%` overall on valid winning-wedge PairSlash runs; `>= 65%` on must-win tasks | None: no scored runs yet | Official benchmark log, weekly-return answer, and rubric-based scoring | product + validation | Run and score real wedge benchmarks, then compute by workflow |
| Safe-memory-write pass rate (`B3` and `B4`) | `100%` of required runs pass with `0` trust-boundary violations across both runtimes | None: no `B3` or `B4` runs logged | `docs/validation/phase-3-5/evidence-log.md`, `verdict.md`, and gate rubric | validation + runtime | Execute `B3` and `B4` once on Codex CLI and once on GitHub Copilot CLI |
| Task success without manual rescue on must-win tasks | `>= 75%` on must-win tasks and `>= 70%` overall | None: rescue tracking not started | Benchmark run logs using the Phase 3.5 benchmark rubric | workflow + validation | Log rescue count and outcome on every paired benchmark run |
| Rework reduction vs raw CLI on review/fix loop | `>= 30%` reduction in rework burden versus paired raw CLI runs | None: no paired review/fix runs | Paired benchmark runs and benchmark rubric from `docs/archive/research/phase-3.5/benchmarks/` | workflow + product | Run paired review/fix comparisons on the same repo snapshot |
| Repo re-orientation win against manual cold start | Positive time-to-first-success delta with no correctness regression on paired onboarding runs | Low: thesis is strong, proof is absent | `B1` paired runs, observer notes, and weekly-return answer | product + workflow | Run `B1` AB/BA comparisons on real return-to-repo tasks |
| Evidence coverage completeness | All `B1-B5` logged; `B3` and `B4` covered on both runtimes before verdict changes | None: official log is empty | `docs/validation/phase-3-5/evidence-log.md` and `verdict.md` scorecard | validation | Fill the log immediately after each run and refuse verdict upgrades without it |
| P1 ICP clarity | At least 3 strong P1 incidents or 2 segments with quote-level repeated pain evidence | Low: P1 is clear as a hypothesis only | Interview ingest, evidence table, and painpoint synthesis | product research | Ingest real interviews and populate the Phase 3.5 synthesis tables |

## Read This Scorecard Strictly

- `None` means there is no meaningful measured confidence yet.
- `Low` means the hypothesis is coherent but not validated.
- A better-looking README, message pack, or release checklist does not raise
  these confidence levels on its own.
