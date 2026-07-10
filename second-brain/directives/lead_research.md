# Lead / Client Research

## What this workflow is

Produces a research brief on a prospect before outreach or a discovery call: who they are, what they likely need, entry angle, and talking points. Use before any first contact or discovery call.

## Prerequisites

- Context: `context/company.md` (what we sell — the brief must map their problems to our services)
- Skills: `skills/SKILL_BIBLE_discovery_calls.md`
- Scripts: `execution/research_prospect.md` (spec — owner's scraping repos plug in here)

## Inputs

| Field | Required | Description |
|---|---|---|
| Company / person name | yes | |
| Source links | no | LinkedIn, site, job posts — anything the owner already has |
| Outreach goal | yes | Cold outreach, discovery prep, or proposal support |

## Process

### Step 1: Gather raw signal [SCRIPT]

Company site, LinkedIn presence, job postings (AI/automation roles = budget signal), tech stack hints, recent news. Deterministic collection — belongs in the scraping script.

### Step 2: Map problems to services [JUDGMENT]

Read the signal against `context/company.md`. Which of our five service lines (RAG, voice, MCP, automations, custom agents) matches their visible pain? What is the wedge — the smallest credible first project?

### Step 3: Draft the brief [JUDGMENT]

One page: who they are (3 bullets), inferred problems (with the evidence for each inference labeled), recommended wedge, 3 talking points, 2 discovery questions, risks/disqualifiers.

### Step 4: File it [SCRIPT]

Save to `clients/{name}/profile.md` (draft status) if they become active, or `.tmp/` if speculative. Log the lead in the operator_os Outreach Tracker.

## Quality gates

- [ ] Every inference labeled as inference, with its evidence
- [ ] No fabricated facts about the prospect
- [ ] Wedge project is small enough to say yes to (per owner's scoping bottleneck)
- [ ] Brief fits on one page — dense, not padded

## Edge cases

- Prospect has no public footprint → say so; produce a question list instead of a fake brief
- Prospect is in a regulated industry → flag compliance implications for the proposal stage
- Signal conflicts (e.g. hiring AI engineers but CEO posts anti-AI takes) → surface the contradiction as a discovery question

## Self-annealing log

- 2026-07-07: Directive created. Scraping script is a spec (`execution/research_prospect.md`) pending integration of the owner's scraping repos.
