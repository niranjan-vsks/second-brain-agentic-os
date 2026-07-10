# Decision: Neon + Drizzle + Better Auth stack for operator_os

**Date:** 2026-07-07
**Status:** Active

The operator_os app runs on Neon Postgres with Drizzle ORM and Better Auth (email + password only), Next.js 16 App Router, server actions (no API routes for CRUD), SWR for client state.

**Because:** there is no RLS in this stack, so the security model is per-query userId scoping — every one of the app's server actions filters by the session user's id. This invariant is documented in the repo root CLAUDE.md and must survive all future refactors.

Related: [[2026-07-07_lesson-enforce-invariants-at-the-database-layer]], [[2026-07-07_reference-operator-os-architecture]]
