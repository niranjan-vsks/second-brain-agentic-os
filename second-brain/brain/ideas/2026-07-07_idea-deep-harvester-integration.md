# Idea: Wire the owner's scraping repos into Deep Harvester + Trend Scout

**Date:** 2026-07-07
**Status:** Idea — not a commitment

The owner has open-source scraping repos. Two integration points are already stubbed and waiting:

1. **Deep Harvester** (operator_os, PRD in `lib/prd.ts`) — lead scraping into the Outreach Tracker
2. **Trend Scout** (LinkedIn OS) — currently inserts curated seed suggestions; PRD intent is live trend scraping
3. **research_prospect script** (this vault, `execution/research_prospect.md`) — spec ready, needs the repos

All three share the same collection layer. Build once, feed all three. Candidate first task for a Claude Code session: implement `research_prospect.mjs` against the repos, then adapt for the app's two scrapers.

Related: [[2026-07-07_reference-service-lines-and-bottlenecks]], [[2026-07-07_reference-operator-os-architecture]]
