# PairSlash Phase 3.5 Screener

## Purpose

Filter for participants with real terminal-native AI workflow pain, not concept curiosity.

Prioritize people who can describe recent incidents involving Codex CLI or GitHub Copilot CLI, repeated repo work, and trust or continuity problems.

## Questions

### 1. What best describes your role?

- Solo engineer or power user in terminal
- Tech lead / maintainer / staff engineer
- Platform / DevEx / internal tooling
- OSS maintainer / consultant
- Other

Scoring:

- Exact ICP match: 2
- Adjacent but plausible: 1
- Weak fit: 0

### 2. Which of these have you used in the last 30 days?

- Codex CLI
- GitHub Copilot CLI
- Both
- Neither, but I manage people who use them
- None of the above

Scoring:

- Codex CLI or GitHub Copilot CLI: 3
- Manages people who use them: 2
- None: 0

### 3. How often do you do repo work with AI from the terminal?

- Daily
- Multiple times per week
- Weekly
- Less than weekly
- Never

Scoring:

- Daily or multiple times per week: 3
- Weekly: 2
- Less than weekly: 1
- Never: 0

### 4. How often do you come back to the same repo after a context break?

- Daily
- Weekly
- A few times per month
- Rarely

Scoring:

- Daily or weekly: 3
- A few times per month: 2
- Rarely: 0

### 5. Which of these happened in the last 30 days? Pick all that apply.

- I lost time re-understanding a repo
- AI output was almost right but created cleanup or rework
- I repeated the same review / fix-test workflow manually
- I lost project context across sessions or people
- I needed clearer auditability or trust before letting AI touch durable project truth
- Setup or install friction blocked regular use
- None of the above

Scoring:

- 3 or more relevant pains: 4
- 2 relevant pains: 3
- 1 relevant pain: 2
- None: 0

### 6. Describe the last concrete example in 2-4 sentences.

Scoring:

- Specific, recent, behavioral, and costly: 4
- Specific but limited detail: 3
- General complaint with one weak example: 1
- Vague opinion only: 0

### 7. Which workflow best matches the example you just described?

- Repo understanding or orientation
- Review / fix-test loop
- Repeated terminal workflow reuse
- Memory continuity across sessions or people
- Trust / governance / auditability
- Setup / install
- Other

Scoring:

- Any target workflow: 2
- Other but still plausible: 1
- Unrelated: 0

### 8. If a workflow helps, what usually makes you use it again the next week?

- It saves real time on repeated work
- It reduces mistakes or rework
- It is easy to trust
- It is easy to set up
- I rarely use workflows twice

Scoring:

- Repeated work, reduced mistakes, or trust: 2
- Easy to set up only: 1
- Rarely uses twice: 0

### 9. Are you willing to talk through a recent real case live, including commands, files, or notes if needed?

- Yes
- Maybe
- No

Scoring:

- Yes: 2
- Maybe: 1
- No: 0

## Scoring Summary

- Maximum score: 25
- `A` priority: 18-25
- `B` priority: 13-17
- `C` priority: 8-12
- Reject by default: 0-7

## Priority Tags

### A

Recruit immediately.

Typical pattern:

- uses Codex CLI or GitHub Copilot CLI directly
- works in terminal repeatedly
- recent, specific, costly incident
- pain maps to at least one Phase 3.5 wedge
- can talk concretely about trust and reuse

### B

Recruit if quota needs balance.

Typical pattern:

- role is good
- workflow pain is real
- incident detail is decent
- usage intensity or relevance is lower than ideal

### C

Only recruit if there is a quota gap.

Typical pattern:

- adjacent role
- some relevant pain
- weak recency or weak specificity

## Include Logic

Include by default if all of the following are true:

- score is `A` or `B`
- recent workflow is real and specific
- candidate fits one of the ICP segments
- candidate has repeated repo context or team accountability for repeated repo context

Include conditionally if:

- score is `C`
- and the segment quota is underfilled
- and the candidate has at least one strong recent example

## Exclude Logic

Exclude if any of the following are true:

- no recent concrete incident
- no terminal-native AI workflow relevance
- no relationship to Codex CLI or GitHub Copilot CLI
- only curiosity about AI, no operational pain
- insists on broad orchestration or autopilot as the primary desired outcome
- no repeated repo or repeated workflow pattern

## Notes for Recruiter

- Push for the most recent real example.
- If the candidate only gives beliefs, ask once for a concrete incident.
- If they still cannot provide one, reject.
- Do not sell PairSlash in the screener.
