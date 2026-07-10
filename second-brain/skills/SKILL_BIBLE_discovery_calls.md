# SKILL_BIBLE: Discovery Calls for AI Projects

> Source: distilled from the owner's funnel design sessions (2026-07) — the stated bottlenecks were scoping and proposals, which are downstream of discovery quality. Date: 2026-07-07.
> Refine with transcripts of the owner's real discovery calls (drop in `sources/`, run source_mining).

## Core principles

1. **Discovery is diagnosis, not pitching.** The call succeeds if you leave knowing their actual workflow, not if they're impressed.
2. **AI buyers usually misdiagnose their own problem.** "We need a chatbot" usually means "our team answers the same 40 questions weekly." Dig for the underlying workflow before accepting the stated solution.
3. **Budget signal beats budget question.** Job postings, team size, existing tool spend tell you more than "what's your budget?" — which most prospects deflect anyway.
4. **The wedge project wins.** Leave with ONE small, high-certainty first project identified. Big-bang scopes die in procurement and kill solo-capacity delivery.

## The call structure (45 min)

| Phase | Minutes | Goal |
|---|---|---|
| Context | 5 | Their role, how they found you, what triggered the call NOW |
| Workflow excavation | 15 | Walk the actual process step by step: who does what, in which tool, how long, what breaks |
| Cost of the problem | 10 | Hours/week lost, error cost, opportunity cost — get a number, even rough |
| Solution shape | 10 | Sketch the wedge; test their reaction to staged delivery |
| Next step | 5 | Concrete: proposal by [date], or a named disqualification |

## Exact questions that work

- "Walk me through the last time this happened — step by step, tool by tool."
- "If this problem disappeared tomorrow, what would the team do with the time?"
- "Who else has tried to fix this — internally or a vendor? What happened?"
- "What does 'done' look like in 90 days — what would you show your boss?"
- "Which parts of this can NEVER be wrong?" (this scopes the human-in-the-loop boundary and the eval requirements)

## Red flags (disqualify or de-risk)

- Cannot name who owns the problem → no internal champion → project stalls
- Wants "AI strategy" not a working system → advisory trap for a builder
- Refuses staged delivery, insists on big-bang → misaligned with solo delivery capacity
- Expects model magic without providing data access → the project fails at integration, not intelligence

## Common mistakes

- Demoing before diagnosing — anchors them on features, not their workflow
- Accepting the stated problem ("we need RAG") without excavating the workflow behind it
- Leaving without a dated next step
- Over-promising accuracy: never quote accuracy numbers before seeing their data. Say "we'll establish a baseline in week one" instead.

## Quality checklist (post-call)

- [ ] The actual workflow documented, tool by tool
- [ ] A cost-of-problem number (even rough, labeled as their estimate)
- [ ] One wedge project identified and sized
- [ ] Human-in-the-loop / can-never-be-wrong boundaries captured
- [ ] Dated next step agreed
- [ ] History entry written to `clients/{name}/history.md`
