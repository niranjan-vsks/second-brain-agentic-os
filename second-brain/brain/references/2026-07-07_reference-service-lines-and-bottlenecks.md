# Reference: Service lines and funnel bottlenecks

**Date:** 2026-07-07

Five service lines: RAG systems, voice agents (Vapi/Retell), MCP servers, workflow automations (n8n/Make/Zapier), custom Python/TS agents.

Owner-stated funnel bottlenecks (2026-07 design session), each mapped to tooling:

| Bottleneck | Countermeasure |
|---|---|
| Lead generation | Outreach Tracker + lead_research directive + (future) Deep Harvester scraping |
| Scoping/proposals | proposal_generation directive + SKILL_BIBLE_scoping_ai_projects + Artifact Generator |
| Build time | Asset Library (reusable components) |
| Testing/reliability | Eval-first scoping rule: baseline week before improvement quotes |
| Handoff/retention | Handoff artifacts as proposal line items + retention pipeline stage |

Related: [[2026-07-07_reference-operator-os-architecture]], [[2026-07-07_idea-deep-harvester-integration]]
