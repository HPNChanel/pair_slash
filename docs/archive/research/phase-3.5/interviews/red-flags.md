# PairSlash Phase 3.5 Interview Red Flags

## Purpose

Use this sheet to detect when interview data is getting too polite, too abstract, or too contaminated by concept-selling.

## Red Flags

### 1. No recent real story

How it shows up:

- participant talks in generalities
- examples are older than a month
- no clear trigger, action, or outcome

Why it is dangerous:

- you will synthesize opinions, not behavior

How to repair in the interview:

- ask for the last time it happened
- ask what repo it was, what command they ran, and what they had to fix
- if they still stay vague, downgrade confidence immediately

How to mark it afterward:

- `interview_confidence: low`
- `concrete_incident_present: false`

### 2. Interview turns hypothetical

How it shows up:

- discussion shifts to "would use", "could use", or "maybe useful"
- participant starts designing the product

Why it is dangerous:

- it inflates demand and hides current workaround cost

How to repair in the interview:

- interrupt politely and ask what happened last time in a real workflow
- ask what they do today without the product

How to mark it afterward:

- record willingness claims separately from behavioral evidence

### 3. Interviewer is leading

How it shows up:

- interviewer names PairSlash benefits before the participant does
- interviewer asks if auditability, `/skills`, or explicit writes would help

Why it is dangerous:

- participant mirrors the framing

How to repair in the interview:

- stop naming features
- reset with: "Let me back up. What actually happened in the last case?"

How to mark it afterward:

- tag the affected section as contaminated
- reduce evidence strength for any matching claims

### 4. Every answer sounds positive but nothing changed

How it shows up:

- participant says the idea sounds good
- but cannot name a repeated pain, workaround cost, or behavior they would change

Why it is dangerous:

- this is novelty reaction, not solution pull

How to repair in the interview:

- ask what they are doing today instead
- ask what would make them ignore the product next week

How to mark it afterward:

- `repeat_use_signal: novelty_only` unless evidence says otherwise

### 5. Install friction dominates too early

How it shows up:

- participant keeps returning to setup, packaging, or onboarding
- deeper workflow pain stays unexamined

Why it is dangerous:

- setup becomes a false core problem

How to repair in the interview:

- separate "what blocked first use" from "what pain would justify using it again"
- return to recent workflow pain and workaround cost

How to mark it afterward:

- keep install friction separate from primary painpoints

### 6. No trust threshold emerges

How it shows up:

- participant says trust matters
- but cannot explain what must be true before reuse

Why it is dangerous:

- trust remains slogan-level

How to repair in the interview:

- ask what they inspect today before accepting output
- ask which action types still feel too risky

How to mark it afterward:

- downgrade `solution_pull`
- leave trust threshold incomplete rather than guessing

### 7. Repeat-use signal is weak

How it shows up:

- participant likes the concept
- but cannot name a recurring weekly trigger

Why it is dangerous:

- the workflow may not be habit-forming

How to repair in the interview:

- ask what would bring them back next week
- ask how often the underlying pain actually happens

How to mark it afterward:

- set repeat-use signal to `none` or `conditional`

### 8. Role mismatch distorts conclusions

How it shows up:

- platform roles talk mostly about governance
- power users talk mostly about speed
- synthesis blends them too early

Why it is dangerous:

- you lose the real segment differences

How to repair in the interview:

- keep the person in their actual operating context
- ask which pain is theirs versus their team's

How to mark it afterward:

- synthesize by ICP segment first, then compare

## Mid-Study Correction Loop

### After Interview 4

Check for:

- too many vague stories
- too much setup discussion
- not enough almost-right AI rework detail
- not enough trust threshold clarity

If any of these are true:

- tighten the screener for recency and specificity
- shorten generic workflow questions
- add a harder probe on cleanup cost and current workaround

### After Interview 8

Check for:

- segment imbalance
- too much positivity with weak repeat-use evidence
- no clear distinction between core pain and adoption friction

If any of these are true:

- rebalance recruiting quota
- make disconfirming questions earlier in the guide
- tighten note-taking around repeat-next-week signal

## Recovery Rules

- If the participant drifts abstract, ask for the last real case.
- If the interview drifts into pitch mode, stop and return to behavior.
- If the participant cannot produce a concrete incident after two tries, end early and mark the session low-confidence.
- If the participant only wants autonomous orchestration, record that as a disqualifying direction, not as demand for PairSlash.
