# LinkedIn Content Production

## What this workflow is

Produces one LinkedIn post from a trend item or idea, in the owner's voice, at an honest claim level, ready for review in the operator_os Review Queue. Use whenever the owner wants content drafted, or on the weekly content cadence.

## Prerequisites

- Context: `context/brand_voice.md`, `context/core_values.md`
- Skills: `skills/SKILL_BIBLE_linkedin_writing.md`
- App: the operator_os LinkedIn OS tab (Style Vault samples + voice preferences live there too — treat the app's Style Vault as the canonical sample store; this vault's brand_voice.md is the distilled ruleset)

## Inputs

| Field | Required | Description |
|---|---|---|
| Trend/idea | yes | From the Trend Feed or the owner directly |
| Claim status | yes | shipped / piloting / building / concept / insight / commentary — NEVER guess upward |
| Target outcome | no | Awareness, FDE positioning, or lead-gen; default: practitioner authority |

## Process

### Step 1: Load voice [JUDGMENT]

Read `context/brand_voice.md` and the top 3 writing samples. Note banned patterns.

### Step 2: Frame at the claim level [JUDGMENT]

The claim status caps every sentence. "Building" content describes the problem and approach — not results. "Shipped" content may cite outcomes, but only real ones from brain notes or owner input.

### Step 3: Draft [JUDGMENT]

Hook earned by the body. 1-3 line paragraphs. A specific number or artifact in the first two lines when honestly available. No hashtag walls.

### Step 4: Self-check against quality gates [JUDGMENT]

### Step 5: Submit to Review Queue [SCRIPT]

In the app context: create via the Draft Composer. In vault-only context: write to `.tmp/` and present for review. Never publish directly — human review is a hard invariant.

## Quality gates

- [ ] Every factual claim traces to a brain note, context file, or owner input
- [ ] Claim status honest — no inflation
- [ ] Zero banned words/patterns from brand_voice.md
- [ ] Would the owner defend every sentence in a technical interview?
- [ ] Hook promise fulfilled within the first 3 lines of the body

## Edge cases

- Trend is about a tool the owner hasn't used → claim status caps at "commentary"; frame as analysis, not experience
- Post needs a metric the owner hasn't provided → `[PLACEHOLDER]` + ask; never invent
- Owner rejects twice for voice → update brand_voice.md with the correction (self-annealing)

## Self-annealing log

- 2026-07-07: Directive created from the LinkedIn OS build (see repo CLAUDE.md §8).
