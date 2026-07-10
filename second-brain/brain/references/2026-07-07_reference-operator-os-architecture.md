# Reference: operator_os architecture map

**Date:** 2026-07-07

The companion Next.js app in this repo (see repo root `CLAUDE.md` for the full handoff doc):

- **3 tabs:** FDE Prep (syllabus/drills/planner/resources), Freelance Funnel (pipeline/outreach/assets/artifacts), LinkedIn OS (trends/review-queue/calendar/log/style-vault)
- **14 Postgres tables** on Neon; schema in `lib/db/schema.ts`; full DDL in `setup.sql`
- **35+ server actions** in `app/actions/*`, every one userId-scoped ([[2026-07-07_neon-better-auth-stack-for-operator-os]])
- **AI agents** in `app/actions/linkedin-agents.ts` via AI SDK + Vercel AI Gateway (model: `anthropic/claude-sonnet-4.5`)
- **Setup:** `SETUP.md` at repo root — Neon project + `setup.sql` + `.env.local` + `pnpm dev`

Deferred work lives in repo CLAUDE.md §6 and §8: Deep Harvester live scraping, LinkedIn OAuth/auto-metrics, email/Slack notification channels.

Related: [[2026-07-07_lesson-base-ui-vs-radix-gotchas]], [[2026-07-07_human-in-the-loop-for-all-linkedin-content]]
