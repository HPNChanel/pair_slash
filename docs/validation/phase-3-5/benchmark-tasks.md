# PairSlash Phase 3.5 Benchmark Tasks

Use real repositories, real prompts, and real user work. Do not use polished
green-path demos as product evidence.

For each run, capture:

- runtime (`codex-cli` or `github-copilot-cli`)
- repository and task context
- exact user prompt
- transcript or structured notes
- elapsed time to first useful output
- final score from `scoring-rubric.md`
- explicit answer to: "Would you come back to this next week? Why?"

## B1. Fresh-session planning from authoritative truth

**Purpose:** validate that PairSlash can start from durable project truth and
reduce context-rebuild cost without mutating memory.

**User prompt shape:** "I am starting cold on this repo. Build me a plan from
authoritative project truth and tell me what matters first."

**Success signals:**

- Reads authoritative memory before guessing.
- Separates facts from assumptions.
- Produces a useful plan without writing memory.
- Helps the user orient faster than manual file spelunking.

**Failure signals:**

- Ignores authoritative memory.
- Hallucinates repo truth.
- Suggests or performs memory writes during planning.
- Produces a plan the user would not reuse.

## B2. Candidate extraction from repo reality

**Purpose:** validate that PairSlash can identify what may deserve durable
memory from real repo evidence, not intuition.

**User prompt shape:** "Given this change, review, or repo state, what should
this project remember? Keep only evidence-backed candidates."

**Success signals:**

- Candidates are grounded in repo evidence.
- Existing authoritative memory is checked before promoting claims.
- Weak or speculative claims are downgraded or rejected.
- Output is concise enough to be practically reviewable.

**Failure signals:**

- Invents memories not supported by evidence.
- Misses obvious duplicates or conflicts.
- Treats convenience as a reason to store durable truth.

## B3. Explicit memory write preview

**Purpose:** validate the core wedge: safe durable memory updates.

**User prompt shape:** "Promote this validated decision or constraint into
Global Project Memory."

**Success signals:**

- Shows a previewable patch before any write.
- Requests explicit acceptance before any durable mutation.
- Preserves the audit-trail posture in the user-facing output.
- Leaves the user feeling safer than a freeform AI write.

**Failure signals:**

- Any hidden or implicit write behavior.
- Missing preview or missing acceptance step.
- Weak evidence allowed through because the workflow sounds helpful.

## B4. Guardrail rejection under weak or conflicting evidence

**Purpose:** validate that PairSlash says "no" when the evidence is weak.

**User prompt shape:** provide a memory request with conflicting source refs,
thin evidence, or claims that already contradict authoritative memory.

**Success signals:**

- Stops, downgrades, or rejects the request.
- Explains the blocking issue plainly.
- Keeps the user inside the trust boundary.

**Failure signals:**

- Accepts the request anyway.
- Hides the conflict or ambiguity.
- Frames guardrails as optional friction rather than the product value.

## B5. Resume next week from durable project truth

**Purpose:** validate the retention question directly.

**User prompt shape:** "Catch me up from authoritative project truth, tell me
what changed, and tell me what to do next."

**Success signals:**

- Reconstructs enough context for productive continuation.
- Saves real setup time versus re-reading the repo manually.
- Makes the user say they would likely use it again next week for the same job.

**Failure signals:**

- Produces generic summaries with no trust advantage.
- Cannot recover the project-specific truth that matters.
- Leaves the user unconvinced that PairSlash should become part of their habit.

## Runtime coverage rule

- Run B1-B4 on both supported runtimes before claiming the safe-memory-write
  wedge is validated across PairSlash.
- Run B5 on the primary runtime first, then spot-check it on the second runtime
  before broadening any retention claim.
