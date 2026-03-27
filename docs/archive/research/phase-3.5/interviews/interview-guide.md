# PairSlash Phase 3.5 Interview Guide

## Objective

Confirm or reject whether PairSlash is solving repeated, costly workflow pain for terminal-native AI users.

This guide is designed to extract evidence, not compliments.

## Interview Format

- Total length: 45 minutes
- Mode: semi-structured
- Default posture: behavior-first, recent-example-first
- Do not demo in the main flow
- Do not explain PairSlash early

## Intro Script (2 minutes)

Use this verbatim or very close to it:

> Thanks for taking the time. I am not here to pitch a product or get praise for AI tools. I want to understand what actually happened in your recent workflow, especially where terminal-native AI was helpful, where it created cleanup, and what made you trust or distrust it. I will keep asking for concrete recent examples. If something is not painful enough to matter, saying that is useful. With your permission, I will take structured notes.

## Timeboxed Flow

- A. Current workflow: 5 minutes
- B. Current pain: 7 minutes
- C. Trust and safety: 6 minutes
- D. Repo understanding and context loss: 6 minutes
- E. Repeated workflows: 6 minutes
- F. Memory / continuity: 6 minutes
- G. Adoption threshold: 5 minutes
- H. Why come back next week: 2 minutes

## A. Current Workflow

### Primary questions

- Walk me through the last time you used Codex CLI or GitHub Copilot CLI on a real repo.
- What were you trying to get done from the terminal?
- Where did the workflow start, and what did you rely on first?

### Probing questions

- Which repo was it, and how familiar were you with it before that session?
- What parts were manual versus AI-assisted?
- What did you open, read, run, or check before you trusted the output?

### Disconfirming questions

- Was that session actually unusual, or is it representative of how you work most weeks?
- If you had done it manually, would it really have been much worse?

## B. Current Pain

### Primary questions

- In that workflow, where did time, trust, or control break down?
- Tell me about the last time the AI was almost right but still created cleanup.
- What part of the workflow keeps repeating even though you wish it did not?

### Probing questions

- What exactly had to be fixed afterward?
- How did you notice it was wrong or incomplete?
- How much extra time did cleanup add?
- Has this happened once, or does it happen repeatedly?

### Disconfirming questions

- Is this a real repeated pain, or just a memorable annoyance?
- If the AI had been removed from that workflow, would the pain still exist?

## C. Trust and Safety

### Primary questions

- What has to be true before you trust an AI-assisted terminal workflow enough to reuse it?
- Where do you currently draw the line between safe help and unsafe autonomy?
- Have you ever blocked yourself or a teammate from using AI in a step because trust was too low?

### Probing questions

- What do you need to inspect before you accept an output?
- Which actions feel safe to automate, and which do not?
- Have you needed auditability, previewability, or explicit approval in practice? What happened?

### Disconfirming questions

- Do you actually need stronger trust mechanics here, or do you mostly need better model quality?
- Are you saying trust matters because it sounds right, or because you changed your behavior over it?

## D. Repo Understanding and Context Loss

### Primary questions

- What happened the last time you came back to a repo after a gap?
- How do you currently get oriented fast enough to act?
- Where do wrong assumptions usually come from?

### Probing questions

- Which files, commands, or notes do you reach for first?
- What do you do when chat history is not enough?
- How often do you discover late that your mental model of the repo was off?

### Disconfirming questions

- Is repo re-orientation actually a painful bottleneck, or just part of the job?
- Would better docs alone solve most of this?

## E. Repeated Workflows

### Primary questions

- Tell me about a repeated review, fix-test, or repo workflow you still run manually.
- Why has that workflow not become safe and reusable yet?
- What parts do you double-check every time because the AI is not trustworthy enough?

### Probing questions

- What does the checklist look like today?
- Is the cost mostly time, mistakes, or mental overhead?
- Have you built scripts, notes, or rituals around this already?

### Disconfirming questions

- Is this workflow frequent enough to matter weekly?
- Would a better prompt solve this, or is the issue deeper than prompting?

## F. Memory / Continuity

### Primary questions

- When project context has to survive across sessions or people, what do you rely on today?
- Tell me about the last time project memory failed you.
- What kinds of project truth do you not trust AI to preserve without review?

### Probing questions

- Where do important decisions or constraints live today?
- What becomes stale fastest?
- Have you seen contradictions between chat history, notes, PRs, and repo reality?

### Disconfirming questions

- Do you truly need durable project memory, or do you mostly need a better handoff habit?
- Would you actually consult a structured memory source later, or would it become shelfware?

## G. Adoption Threshold

### Primary questions

- I want to test a narrow concept, not sell it: a trust layer for Codex CLI and GitHub Copilot CLI that uses `/skills` as the entrypoint, keeps project memory authoritative-first, and requires explicit review before durable writes. Against your last real workflow, where would this fail first?
- What would it need to prove before you used it a second time?
- What would make you reject it even if the core idea sounds right?

### Probing questions

- Would explicit review feel like value or like extra ceremony in your case?
- Where would install friction be fatal, and where would you tolerate it?
- Which one of your recent pains would this help least?

### Disconfirming questions

- Is this solving a real workflow problem, or just dressing up habits you would not actually change?
- If it worked technically, would you still ignore it because the pain is not strong enough?

## H. What Would Make Them Come Back Next Week

### Primary questions

- Why would you use something like this again next week instead of forgetting it?
- What has to happen in week one for it to become part of your workflow?

### Probing questions

- What repeated trigger would bring you back?
- What evidence would tell you it is worth keeping?

### Disconfirming questions

- Is this only interesting on first exposure?
- Would you still come back once the novelty is gone?

## Mandatory Probes

Use these if they did not already answer them:

- Tell me about the last time the AI was almost right but still created cleanup.
- What has to be true before you trust an AI-assisted workflow enough to reuse it?
- What happened the last time you came back to a repo after a gap?
- What do you rely on today when chat history is not enough?
- Why would you use something like this again next week instead of forgetting it?

## Questions You Must Not Ask

Do not ask these in the main interview:

- Would you use PairSlash?
- Would explicit memory writes make you trust this more?
- Would `/skills` be helpful?
- Would auditability solve this?
- If PairSlash did X, would you pay for it?
- Is this a good idea?
- How much do you like this concept?

Why these are banned:

- they are leading
- they invite politeness instead of evidence
- they overweight concept reaction
- they do not predict repeated use

## Interviewer Rules

- Always pull the participant back to the last real incident.
- Ask for what they did, not what they believe in theory.
- Separate problem intensity from setup friction.
- Separate repeated behavior from novelty reaction.
- If the participant starts designing features, bring them back to what happened and what the workaround cost.
