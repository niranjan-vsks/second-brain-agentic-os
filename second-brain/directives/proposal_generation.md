# Proposal Generation

## What this workflow is

Turns a completed discovery call into a scoped, priced proposal. This attacks the owner's stated scoping/proposal bottleneck: vague requirements → fixed scope, explicit assumptions, staged pricing. Use after every discovery call that warrants a proposal.

## Prerequisites

- Context: `context/company.md` (pricing section), `context/core_values.md`
- Client: `clients/{name}/` full folder (profile, rules, preferences, history)
- Skills: `skills/SKILL_BIBLE_scoping_ai_projects.md`
- App: operator_os Artifact Generator has the proposal template; deal must exist in the pipeline

## Inputs

| Field | Required | Description |
|---|---|---|
| Discovery notes/transcript | yes | Raw material — drop in `sources/` first |
| Deal stage + budget signal | yes | From the pipeline board |
| Build type | yes | RAG / voice / MCP / automation / custom agent |

## Process

### Step 1: Extract requirements [JUDGMENT]

From the transcript: stated needs, implied needs, out-of-scope traps. Every requirement tagged stated/inferred.

### Step 2: Define the staged scope [JUDGMENT]

Stage 1 = smallest shippable win (1-2 weeks of owner-hours max, given the 10-15 hr/week budget). Stage 2+ = expansion. Fixed deliverables per stage, explicit "not included" list.

### Step 3: Price [JUDGMENT]

From `context/company.md` pricing. If pricing is `[FILL]`, STOP and ask the owner — never invent a rate.

### Step 4: Assemble the document [SCRIPT]

Proposal skeleton: problem summary (their words), staged scope table, timeline, price, assumptions, out-of-scope, next step. Store in `clients/{name}/` and the app's Artifacts tab.

### Step 5: History entry [SCRIPT]

Dated entry in `clients/{name}/history.md`: what was proposed, at what price, and why that scope.

## Quality gates

- [ ] Every deliverable is verifiable (a thing that exists or doesn't — no "improve X")
- [ ] Assumptions section present and specific
- [ ] Out-of-scope list present (scope creep is the failure mode)
- [ ] Stage 1 sized to the owner's actual weekly capacity
- [ ] No invented prices, dates, or capabilities

## Edge cases

- Client wants everything in stage 1 → propose the staged version anyway with reasoning; flag the risk to the owner
- Requirements contradict the client's own rules.md → surface before drafting
- Budget signal far below scope → offer the smallest honest wedge or a respectful no

## Self-annealing log

- 2026-07-07: Directive created targeting the scoping bottleneck from the funnel design session.
