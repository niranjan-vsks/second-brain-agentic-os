# SKILL_BIBLE: Scoping AI Projects

> Source: distilled from the owner's stated bottlenecks (scoping/proposals, build time, testing/reliability — funnel design session 2026-07) and production-AI delivery patterns. Date: 2026-07-07.
> Refine with post-mortems of real projects as they complete (source_mining on project retros).

## Core principles

1. **Scope the verification, not just the build.** AI projects fail at "is it good enough?", not "does it run?". Every scope must include the eval/acceptance mechanism, or the project has no end.
2. **Deterministic boundary first.** Split every requested system into: deterministic parts (integrations, pipelines, formatting — fixed-cost, quotable) and probabilistic parts (model behavior — must be scoped as iterations against a baseline, never as a guaranteed outcome).
3. **Stage 1 must fit the capacity.** Owner has 10-15 hrs/week. Stage 1 of any proposal = maximum 2 weeks of those hours. Anything bigger gets staged.
4. **The client owns ground truth.** They provide the test cases / golden answers. If they can't, producing them IS stage 1. Never accept "you'll know it when you see it" as an acceptance criterion.

## The scoping framework

For each deliverable, answer in writing:

1. **Input contract** — what exactly comes in (format, volume, source, auth)
2. **Output contract** — what exactly goes out, and who/what consumes it
3. **Acceptance test** — the specific check that says "done" (eval set score, latency bound, side-by-side approval)
4. **Failure policy** — what happens when the AI is wrong: human review queue, fallback, or hard error (this decides the architecture: HITL vs. autonomous)
5. **Integration surface** — every external system touched, with the auth story for each

If any of the five can't be answered, that's a discovery gap — go back, don't guess.

## Pricing structure by type

| Type | Structure | Why |
|---|---|---|
| Deterministic build (pipelines, integrations, MCP servers) | Fixed price per stage | Predictable effort |
| Model behavior work (RAG quality, agent reliability) | Baseline week + fixed iteration blocks against an agreed eval set | Open-ended tuning is unquotable |
| Retainers (maintenance, monitoring, drift) | Monthly, scoped by response SLA | Attacks the retention bottleneck |

## Numbers that anchor scope conversations

- Model at 90% per-step accuracy over 5 chained steps → ~59% end-to-end. This is THE argument for pushing steps into deterministic code and scoping HITL boundaries early.
- Baseline-first: week 1 of any RAG/agent engagement = eval set + measured baseline. Improvement work is quoted only after the baseline exists.

## Common mistakes

- Quoting accuracy before seeing the client's data
- Scoping "improve X" instead of "X passes test Y"
- Including data cleanup implicitly — it's ALWAYS its own line item; client data is always worse than claimed
- Letting "small additions" ride free — the out-of-scope list exists to be pointed at kindly
- Underscoping the handoff: docs, runbooks, and a recorded walkthrough are deliverables, not favors (retention bottleneck)

## Quality checklist

- [ ] Every deliverable has all five framework answers written
- [ ] Deterministic vs. probabilistic split explicit in the proposal
- [ ] Eval/acceptance mechanism named for every probabilistic deliverable
- [ ] Stage 1 ≤ 2 weeks of owner-hours
- [ ] Out-of-scope list present
- [ ] Handoff artifacts included as line items
