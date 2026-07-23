# operator_os — Context Handoff Document

> Purpose: This document gives you (Claude Code) full context on what was built, why, and how it fits together. Read this first, then cross-verify against the actual source files listed below. Trust the code over this doc if they ever disagree.

---

## 0. CURRENT STATUS — START HERE (last updated: Jarvis god-mode orchestrator build)

**App shell:** premium dark "mission control" theme with a top navbar and grouped dropdown navigation — Career Ops (FDE Prep, Career Intelligence) · Business Ops (Freelance Funnel, LinkedIn OS, YouTube Studio) · Life Ops (Money OS) · Jarvis (direct button) · Settings Hub (gear icon). The old flat 8-tab row is gone; sections render inside the same `components/dashboard.tsx` state machine (`SectionKey`).

| Subsystem | State | Blocking env (if any) |
|---|---|---|
| FDE Prep, Freelance Funnel | Fully live | — |
| Lead-Gen Agent (Freelance → Lead-Gen Agent sub-tab) | Fully live UI + agent; discovery needs a key | `GOOGLE_MAPS_API_KEY` or Tavily/Brave/Serper key (Settings → API Keys or env) |
| LinkedIn OS | Fully live (HITL, never auto-posts) | — |
| YouTube pipeline | UI + state machines live; generation/upload are env-activated stubs | See §10 stub activation map |
| Career Intelligence | Fully live; scanner cron runs 4-hourly; FDE Master resume loaded; owner settings seeded | Search provider + browser worker optional (§10-style seams) |
| Tiered model routing | Fully live (light/standard/heavy, all call sites annotated) | Optional per-tier overrides: `GATEWAY_MODEL_{LIGHT,STANDARD,HEAVY}` |
| Settings Hub (gear icon) | Fully live: General, Model Routing (live tier view), Connections, API Key Vault (AES at rest), Agents (lead-gen config), Funnels (Meta Ads seam) | — |
| Jarvis (god-mode orchestrator: 13-tool loop, heavy tier) | Fully live — system status, settings read/write, agent directives, key vault writes, workflow triggers, self-improving lesson memory, full audit trail | Calendar tools need Google OAuth (below) |
| Google Calendar | Code complete; needs `GOOGLE_CLIENT_ID/SECRET` + Calendar API enabled + `/api/auth/google-calendar/callback` registered as redirect URI | Same Google app as YouTube |
| Money OS (autopay guardian) | Fully live; owner's 4 instruments seeded; reminder cron daily 8:00 IST | — |
| Meta Ads funnel | Config seam only (Settings → Funnels): account ID + token stored, no campaign push yet (deliberate deferral) | `META_ADS_ACCESS_TOKEN` when built |

**Non-negotiable invariants (violating these = quality degradation):**
1. Additive-only: never break FDE Prep / Freelance Funnel / LinkedIn OS / YouTube when adding features.
2. All mutations go through server actions with per-query `userId` scoping (Neon has no RLS).
3. All LLM calls: `getModel(tier)` via `lib/llm.ts`, tier from `lib/model-router.ts` registry, `// task_name — rationale` comment at each call site. Never hardcode model strings.
4. Ask OS/Jarvis SQL: SELECT-only, table allowlist, `$1 = userId` param, audited. Never widen this.
5. Money OS: metadata only — never store card numbers, CVVs, PINs, or bank credentials. Cancellation is playbook-driven (no consumer mandate-cancellation API exists in India).
6. Tokens (YouTube, Calendar) are AES-encrypted via `lib/crypto.ts` before hitting the DB.
7. Never port profile.yml/cv.md from the career-ops repo (stale AI-PM versions). The live master resume is the "FDE Master" row in the resumes table.
8. BYO API keys: AES-encrypted in `api_keys` table, resolution order is ALWAYS stored key → env fallback (`resolveApiKey()` in `lib/config.ts`). Full key values are never returned to the client after saving — only lastFour.
9. Lead-Gen Agent promotes prospects INTO the existing `leads` table — it never modifies the funnel pipeline schema or stages.
10. Jarvis god-mode (`lib/jarvis-orchestrator.ts`): every mutating tool writes a `jarvis_actions` audit row; settings writes are shallow-merge against allowlisted config keys only; `set_agent_instructions` writes `app_config.agent_overrides` which the 5 agents (linkedin_post, youtube_script, leadgen_qualify, career_outreach, ads_creative) append via `directiveBlock()` — directives can never override safety/fabrication rules; `store_api_key` reuses the AES vault and never echoes keys; `jarvis_lessons` (active only) are injected into every Jarvis system prompt for self-improvement. Model tiers stay env-controlled — Jarvis cannot change them from chat.

**Owner context you must know:** owner account = `nakri981@gmail.com`; comp guardrails ₹30–50L floor / ₹75L+ stretch (domestic), $5–7k/mo floor (international remote); FDE-first role families (fde, genai_arch, solutions, ai_pm); accounts tracked in Money OS: HDFC Debit, Tata Neu Infinity HDFC CC, Kotak 811 Debit, SBI Debit (Skydo planned for international freelancing).

**Deferred / open work (intentional):** §8 LinkedIn deferred list · §10 YouTube stub activation + PRD §13 deferrals · WealthOS (separate app, separate chat) is NOT part of this repo. **Job-Hunt Engine — ALL 4 NODES BUILT** (§16): Sourcer (internet-wide search discovery via the search seam + seed boards, zero-token regex extraction → stages `discovered` job_applications), Enricher (`lib/apollo-hunter.ts` Apollo→Hunter waterfall → hiring manager), Applicant (`submitApplication` in lib/browser-automation.ts — agent-browser best-effort form fill + résumé upload + confirmation screenshot to Blob + tracking id; autonomy-gated review/auto), Emissary (humanized cold email w/ portfolio deep-link liner + LinkedIn DM draft; review gate on the final draft, sends only when emissary=auto + Resend configured + manager email). Shared packet in `job_applications.jobhunt` (jsonb); per-node status in `job_hunt_runs` (all 4 glow in the Playground). Orchestrator `runJobHuntCycle` chains apply→enrich→outreach; Jarvis `trigger_workflow` gains `jobhunt_source`+`jobhunt_cycle`. UI: Career → Auto-Apply sub-tab (per-node autonomy dials, discovery config, approval queue, pipeline, run history). Activation env: SEARCH provider (sourcing), APOLLO_API_KEY/HUNTER_API_KEY (enricher — in .env.local), agent-browser live on Vercel (applicant), RESEND_API_KEY+EMAIL_FROM (emissary send). Remaining polish: per-job PDF résumé tailoring→render for upload (currently uploads master résumé; renderPdf seam is browser-worker-only), Loom V2 stub, humanize Arsenal skill (operator adds). **Agency-Agents Roster (FINAL PHASE, deferred until owner says go):** the `agency-agents` repo (`~/Downloads/agency-agents-main`, 285 persona md files across 17 divisions defined in `divisions.json`) is to be integrated as a **hireable agent roster** — browse/search by division → "Add to team" instantiates a persona as a real Playground node (graph-overlay added-agent + auto voice + autonomy dial + its md body as system prompt, stored skill-style), plus a Jarvis `hire_agent` tool to staff specialists on demand and retire them. Reuses the existing graph/voice/autonomy/skills machinery — do NOT build a new paradigm. Do not start until the owner explicitly asks (they will).

**Docs map:** this file (architecture + invariants) · `SETUP.md` (operator's usage guide) · `drizzle/` (versioned migrations, source of truth for the schema — auto-applied by `scripts/migrate.mjs` on every `pnpm build`/deploy; `setup.sql` is kept only as historical reference, don't re-run it) · `.env.example` (every env var, annotated).

**Schema changes now go through drizzle-kit, not hand-edited SQL:** edit `lib/db/schema.ts`, run `pnpm db:generate` to write a new versioned migration into `drizzle/`, commit it. Never edit files already in `drizzle/` after they're committed — generate a new one instead.

---

## 1. What This App Is

**operator_os** is a personal "operating system" dashboard for a senior Agentic AI engineer (7 yrs experience) running three parallel tracks:

1. **FDE Prep** — aggressive 1-2 month preparation for Forward Deployed Engineer roles. Focus areas: System Design, LLD, AI Deployment, Production RAG, Finetuning/Evals. Time budget: 10-15 hrs/week, FDE-heavy split.
2. **Freelance Funnel** — an orchestrated client-delivery funnel for building/shipping AI agents and automations (RAG systems, voice agents via Vapi/Retell, MCP servers, n8n/Make automations, custom Python/TS agents). The owner's stated bottlenecks were: lead generation, scoping/proposals, build time, testing/reliability, and handoff/retention — so ALL funnel stages are tooled.
3. **LinkedIn OS** — a human-in-the-loop LinkedIn content engine (see §9). Trend intake → AI Draft Composer → owner review with git-style revisions, diffs, and a tweak chat → approve/schedule → posted log with engagement metrics. NOTHING is ever auto-posted; the owner approves everything.

The stated meta-goal: production-ready quality, consistency on weaker models, scalability/repeatability, faster delivery. Everything is template-driven and checklist-driven on purpose.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | React 19, Turbopack |
| Database | Neon Postgres | Connected via Vercel integration, `DATABASE_URL` env var |
| ORM | Drizzle (`drizzle-orm/node-postgres`) | Shares a single `pg` Pool with Better Auth. Do NOT introduce `@neondatabase/serverless` or `@vercel/postgres`. |
| Auth | Better Auth (email + password only) | Requires `BETTER_AUTH_SECRET` env var |
| UI | shadcn/ui built on **@base-ui/react** (NOT Radix) | See "Critical Gotchas" below |
| Styling | Tailwind CSS v4 (no tailwind.config; tokens in `app/globals.css` via `@theme`) | Dark command-center theme, teal/cyan primary, monospace accents (Geist Mono) |
| Data fetching | SWR on the client, server actions for mutations | No API routes except the Better Auth handler |
| Icons | lucide-react | |

---

## 3. File Map (read these to absorb the codebase)

### Core infrastructure
- `lib/auth.ts` — Better Auth server config. **Load-bearing file.** Contains the `trustedOrigins` cascade including dev-only wildcards (`https://*.vusercontent.net`, `https://*.v0.app`, `http://localhost:3000`) required for the v0 preview iframe, plus `sameSite: "none", secure: true` dev cookies. Do not weaken either or auth silently breaks in preview environments.
- `lib/auth-client.ts` — Better Auth React client (`authClient.signIn.email`, `authClient.signUp.email`).
- `lib/db/index.ts` — Drizzle client over a shared `pg` Pool.
- `lib/db/schema.ts` — ALL tables. Four Better Auth tables (`user`, `session`, `account`, `verification` — camelCase columns, do not rename) + app tables (see §4).
- `app/api/auth/[...all]/route.ts` — Better Auth HTTP handler mount.

### Domain data & content
- `lib/constants.ts` — The domain brain. Exports:
  - `STAGES` — 7 funnel stages: lead, discovery, proposal, build, test, handoff, retention
  - `BUILD_TYPES` — rag, voice, mcp, automation, custom
  - `STAGE_PLAYBOOKS` — per-stage SOP checklist items (auto-copied into a deal's checklist when it enters a stage)
  - `ARTIFACT_TEMPLATES` — markdown templates: proposal, discovery doc, test plan, handoff doc
  - `SYLLABUS_TRACKS` + `SYLLABUS_SEED` �� 5 tracks, 25 seeded FDE prep topics with priorities
  - `DRILL_SEED` — 10 seeded FDE interview practice questions
- `lib/prd.ts` — `RESEARCH_AGENT_PRD`: a molecular-detail PRD for a "Deep Harvester" research agent (see §6). This is content, not running code.
- `lib/seed.ts` — server-only first-login auto-seed (syllabus topics + drills per user).
- `lib/types.ts` — shared TS types inferred from the Drizzle schema.

### Server actions (ALL mutations go through these)
- `app/actions/funnel.ts` — deals, deal checklists, assets, leads, artifacts
- `app/actions/prep.ts` — topics, study sessions, drills, resources (+ `seedSyllabus`)

**Security invariant:** every action calls `getUserId()` (throws if no session) and every single `where` clause includes `eq(table.userId, userId)`. There is NO RLS on Neon — this per-query scoping is the only isolation mechanism. Preserve it in every new action you write. This was audit-verified: 35 actions, all scoped, cross-account isolation tested in-browser.

### Pages & components
- `app/page.tsx` — protected server component: gets session, redirects to `/sign-in`, runs first-login seed, fetches initial data, renders `<Dashboard>`.
- `components/dashboard.tsx` — app shell: header, sign-out, the two top-level tabs.
- `components/freelance/` — `freelance-tab.tsx` (sub-tab shell), `pipeline-board.tsx` (kanban + deal dialog with stage mover), `deal-checklist.tsx` (per-stage playbook checklist), `outreach-tracker.tsx` (leads table + follow-up cadence), `asset-library.tsx` (prompt/pattern vault with category+buildType filters), `artifact-generator.tsx` (template-driven doc generator, saves artifacts, copy-to-clipboard).
- `components/prep/` — `prep-tab.tsx` (sub-tab shell), `syllabus-view.tsx` (topic tree grouped by track with status cycling + progress bars), `weekly-planner.tsx` (week navigator, planned vs actual minutes vs the 900-min/week budget), `drill-bank.tsx` (question bank with write-your-answer flow and status: unanswered → drafted → reviewed), `resource-vault.tsx` (links/notes per topic), `prd-view.tsx` (renders + copies the Research Agent PRD).
- `app/sign-in/`, `app/sign-up/`, `components/auth-form.tsx` — standard Better Auth email/password pages.

---

## 4. Database Schema (already applied to Neon — do NOT re-create)

Better Auth tables: `user`, `session`, `account`, `verification` (standard Better Auth shapes, camelCase columns, FKs intact).

App tables (all have a plain `userId` text column, deliberately NO foreign keys for iteration speed):

| Table | Purpose | Key columns |
|---|---|---|
| `deals` | Pipeline board cards | stage (StageId), buildType, value (int, dollars), notes, nextAction |
| `deal_checklist` | Per-deal, per-stage SOP items | dealId, stage, item, done, sortOrder |
| `assets` | Prompt/asset library | category (prompt/architecture/code/sop), buildType, content, tags (comma string) |
| `leads` | Outreach tracker | channel, status (new/contacted/replied/call-booked/dead), lastTouch, nextFollowUp |
| `artifacts` | Generated client docs | dealId (nullable), type, title, content (markdown) |
| `topics` | FDE syllabus | track (TrackId), priority (1=critical..3), status (not-started/in-progress/done), sortOrder |
| `study_sessions` | Weekly planner | topicId (nullable), weekStart (date), day, plannedMinutes, actualMinutes, done |
| `drills` | Question bank | topicId (nullable), question, answer, difficulty, status |
| `resources` | Resource vault | topicId (nullable), url, kind, notes |

Schema changes: apply DDL directly against Neon (the owner uses the Neon integration; from your side use any Postgres client with `DATABASE_URL`), then mirror the change in `lib/db/schema.ts`. One statement per execution.

---

## 5. Critical Gotchas (things that WILL bite you)

1. **This shadcn/ui is built on @base-ui/react, NOT Radix.** There is no `asChild` prop. To render a trigger as a custom element use the `render` prop: `<DialogTrigger render={<Button />}>children</DialogTrigger>`. Using `asChild` causes nested-`<button>` hydration errors (this exact bug was found and fixed in pipeline-board, outreach-tracker, and asset-library). Check `components/ui/dialog.tsx` before touching any trigger.
2. **Auth trustedOrigins:** the app runs inside cross-origin preview iframes during development. `lib/auth.ts` has dev-only wildcard origins and `sameSite: "none"` dev cookies. If sign-up ever returns "Invalid origin", the serving origin isn't in `trustedOrigins` — add it there, dev-gated; don't disable origin checking.
3. **No fetch-in-useEffect.** Initial data comes from the RSC (`app/page.tsx`) and is passed down; client components use SWR (`fallbackData` pattern) + server actions, then `mutate()`.
4. **Escape apostrophes in JSX** (`&apos;` or string expressions) — the codebase follows this convention.
5. **Design tokens only** — colors come from semantic tokens in `app/globals.css` (`bg-background`, `text-primary`, etc.). No raw `bg-black`/`text-white`. Dark theme is default and set on `<html>`.
6. **Env vars required:** `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` (≥32 chars). `BETTER_AUTH_URL` optional (falls back through Vercel URLs).

---

## 6. The Research Agent PRD ("Deep Harvester") — `lib/prd.ts`

The PRD tab (FDE Prep → Research Agent PRD) contains a complete, molecular-detail PRD the owner intends to hand to you to BUILD as a separate project. Summary of what it specifies:

- A focused research agent that takes a topic (e.g. "production RAG evaluation"), plans a structured crawl, scrapes the web using the owner's existing open-source scraping repos (they will provide these — do not build a scraper from scratch), filters/ranks content, and organizes output into a deterministic folder structure of Markdown files + PDFs per topic.
- Output structure is designed for direct import into NotebookLM (manual upload initially; automation later if feasible).
- The PRD defines: agent loop architecture, source-quality heuristics, dedup strategy, MD/PDF output contracts, folder naming conventions, config surface, failure handling, and an explicit "Phase 2" hook for integrating the agent's outputs back into THIS app (e.g. auto-populating the `resources` table via an import endpoint).
- Read `lib/prd.ts` in full before building it. When you build it, respect the output contract exactly — the folder structure IS the API.

---

## 7. Behavioral Details Worth Knowing

- **First-login seeding:** `app/page.tsx` calls the seed helper; if the user has zero topics it inserts the 25-topic syllabus and 10 drills. Idempotent per user.
- **Stage playbooks:** when a deal moves to a new stage (`moveDealStage`), checklist items for that stage are auto-created from `STAGE_PLAYBOOKS` if they don't already exist for that deal+stage.
- **Weekly planner budget:** hardcoded 900 minutes/week (15 hrs) target; shows planned vs actual vs budget.
- **Artifact generator:** picks a template + optional deal, pre-fills `{{placeholders}}` from deal data where possible, saves to `artifacts`, supports copy-to-clipboard.
- **Verified flows (browser-tested):** sign-up, sign-in, sign-out, protected-route redirect, deal creation, stage checklist toggling, all sub-tabs render, per-user data isolation, origin security (403 on untrusted origins).

## 8. LinkedIn OS (third tab)

A surgically integrated content engine following the owner's "LinkedIn OS Master Prompt" spec. Human-in-the-loop is the core invariant: the AI never posts; it drafts, the owner reviews/approves.

### Files
- `app/actions/linkedin.ts` — CRUD for all 7 LinkedIn tables + the post state machine + notifications. Same `getUserId()` scoping invariant as everything else.
- `app/actions/linkedin-agents.ts` — the AI agents, built on the AI SDK (`ai` package) via Vercel AI Gateway (`generateText`, model string `anthropic/claude-sonnet-4.5`):
  - **Draft Composer** — takes a trend item + mandatory claim status, loads the owner's writing samples (Style Vault) + active voice preferences, and generates a draft in the owner's voice. Saves as `pending_review`, creates revision 1, fires a `new_draft` notification.
  - **Tweak Agent** — chat-based refinement on a specific post. Each AI edit creates a new revision. Owner chat messages and agent replies persist in `post_chat_messages`.
  - **Claim-status honesty enforcement** is in the system prompt: the agent must frame content matching the claim level (shipped/piloting/building/concept/insight/commentary) and never inflate claims.
- `components/linkedin/` — `linkedin-tab.tsx` (stat cards + 5 sub-tabs), `trend-feed.tsx` (manual idea intake + "Run Trend Scout" seeded suggestions + Draft dialog with claim-status picker), `review-queue.tsx` (the core: pending posts, inline editor saving owner revisions, revision history with side-by-side diff via the `diff` npm package, tweak chat, approve/reject/schedule), `post-calendar.tsx` (7-day week grid of scheduled posts, mark-as-posted flow), `published-log.tsx` (posted history + manual engagement metrics entry: likes/comments/shares/impressions), `style-vault.tsx` (writing samples + voice preference rules, toggleable).
- `components/notifications-bell.tsx` — header bell, SWR-polled (30s), unread count, mark-all-read.
- `components/linkedin/claim-status.ts` — claim status labels/colors shared across components.

### Post state machine
`pending_review` → (approve) → `approved` → (schedule) → `scheduled` → (mark posted) → `posted`; or → `rejected` at review. Enforced by DB CHECK constraints AND validated in `updatePostStatus`.

### LinkedIn OS tables (already applied to Neon)
| Table | Purpose |
|---|---|
| `trend_items` | Trend/idea intake (source: manual or scout) |
| `writing_samples` | Owner's real posts for voice cloning |
| `voice_preferences` | Durable style rules (active flag), injected into every agent prompt |
| `linkedin_posts` | The post entity: claimStatus + status (both CHECK-constrained), scheduling timestamps, engagement metric columns |
| `draft_revisions` | Git-style history: every AI or owner edit = new numbered revision |
| `post_chat_messages` | Per-post tweak chat transcript |
| `notifications` | In-app notifications (new_draft, reminders) |

### Env var needed
`AI_GATEWAY_API_KEY` is NOT required inside v0 (gateway works zero-config for Anthropic), but IS required when self-hosting outside Vercel/v0. The AI Gateway account must have billing enabled — composer calls fail with a "credit card required" gateway error otherwise (this is an account issue, not a code bug).

### Known deferred work (intentional, good candidates for you)
- Trend Scout currently inserts curated seed suggestions; the PRD intent is live scraping (owner has scraping repos to integrate — same situation as the Deep Harvester in §6).
- LinkedIn API integration (OAuth + real posting + metrics pull) is deliberately absent; `linkedinPostId` and `metricsSource` columns are ready for it. Scheduling is calendar-only; actual posting is manual.
- Notification channels beyond in_app (email/Slack) — the `channel` column exists.

## 9. The Second Brain Vault (`second-brain/`)

Alongside the app lives an Obsidian-compatible second brain vault implementing the DOE pattern (Directive / Orchestration / Execution) from "The Second Brain Blueprint" (Doby Lanete, DobotAI). **The vault has its own constitution: `second-brain/CLAUDE.md`. Read it before doing any work inside the vault — it defines context loading priority, standing rules, and the self-annealing protocol.**

Structure: `context/` (company, brand voice, core values, owner — several `[FILL]` sections await the owner's input via the record-and-transcribe method), `directives/` (6 SOPs: LinkedIn content production, lead research, proposal generation, brain backlinking, contradiction audit, source mining — plus `_TEMPLATE.md`), `execution/` (`generate_index.mjs` is a working script that rebuilds `brain/INDEX.md`; `research_prospect.md` is a spec awaiting the owner's scraping repos), `skills/` (3 skill bibles: LinkedIn writing, discovery calls, scoping AI projects — plus extraction template), `clients/_template/` (profile/rules/preferences/history — copy per client), `brain/` (9 seeded, wiki-linked notes across decisions/notes/references/metrics/ideas), `sources/` (raw exports for mining).

App-vault contract: the app is structured operational state (Postgres); the vault is judgment, expertise, and memory (markdown). Client added in app → create `clients/{name}/` in vault. Deal closed or decision made → brain note. `.tmp/`, `.obsidian/`, `.env` are gitignored. The owner opens `second-brain/` as an Obsidian vault to read it; the AI writes to it.

## 10. YouTube Ads Pipeline + Ad Creative Engine (4th tab + Ask OS)

Built from the "YouTube Ads Pipeline PRD" (in chat history; core spec summarized here). Multi-agent content pipeline: Topic → Script Composer → Prompt Engineer → Higgsfield generation → Review (or bypass) → YouTube upload → analytics. Everything is real and wired; three external services are **configurable stubs** that activate purely by setting env vars (see `.env.example`) — zero code changes needed.

### The flexible LLM brain + TIERED MODEL ROUTING — `lib/llm.ts` + `lib/model-router.ts`
`getModel(tier)` is the single seam every agent uses, now with **three cost tiers**: `light` (extraction, formatting, metadata — default gateway model google/gemini-2.5-flash-lite), `standard` (prose drafting, SQL generation — google/gemini-2.5-flash), `heavy` (rubric evaluation, resume tailoring, script composition, research synthesis — anthropic/claude-sonnet-4.5). Design decision: **deterministic task→tier map, NOT a learned/LLM router** — operator_os has a closed set of ~15 known agent tasks, so a lookup table beats a classifier (no extra latency/cost/failure mode). Context never lives in any model — it all lives in Neon — so models are freely swappable per tier.
- Provider priority (unchanged): `OPENROUTER_API_KEY` > `LLM_BASE_URL`+`LLM_API_KEY` > Vercel AI Gateway default.
- Per-tier env overrides: `GATEWAY_MODEL_{LIGHT,STANDARD,HEAVY}` (gateway) or `LLM_MODEL_{LIGHT,STANDARD,HEAVY}` (OpenRouter/custom); base `GATEWAY_MODEL`/`LLM_MODEL` = single-model fallback for all tiers.
- `lib/model-router.ts` holds the canonical TASK_TIERS registry (every agent task → tier, with rationale comments) and `generateRouted()` — the optional escalation wrapper: if a light/standard output fails validation (bad JSON, empty, refusal), it retries ONCE on the next tier up. That's the only "dynamic" routing — 80% of a smart router's value, none of its complexity.
- **Never hardcode a model string in an agent — always `getModel(tier)` with the tier from the registry.** Every call site carries a `// task_name — rationale` comment. LinkedIn agents are migrated (standard tier).

### State machine (video_projects.status, DB CHECK enforced)
draft → scripting → script_ready → prompt_ready → generating → generated → pending_approval | auto_approved → uploading → published; failures → failed (retryable via transitionProject to draft); rejection → rejected. `bypassApproval` set per project/batch at creation, immutable after. **Sanity floor** (`app/actions/youtube.ts`): auto-publish is blocked if red-flag terms (pipeline_settings) match, script is empty/too short, or generation failed — then it falls back to pending_approval.

### Files
- `lib/llm.ts` (LLM seam), `lib/crypto.ts` (AES-256-GCM for OAuth tokens, needs `TOKEN_ENCRYPTION_KEY`), `lib/storage.ts` (Blob wrapper — the S3-swap seam), `lib/higgsfield.ts` (generation client; STUB until `HIGGSFIELD_API_KEY` — submits fake job ids, poller marks them failed with a clear message), `lib/youtube-api.ts` (OAuth token refresh + resumable upload + Data API metrics), `lib/os-chat.ts` (text-to-SQL: SELECT-only, table allowlist, userId injection, LIMIT clamp, audit trail in os_chat_messages.sqlExecuted).
- `app/actions/youtube.ts` (channels, settings, projects, state machine, sanity floor), `youtube-agents.ts` (Script Composer + Prompt Engineer via `getModel()`), `ads.ts` (ad creative generation for Freelance tab), `edits.ts` (Remotion edit requests: NL prompt → constrained JSON spec via LLM; STUB until `REMOTION_RENDER_URL`), `chat.ts` (Ask OS).
- Cron routes (vercel.json schedules, protected by `CRON_SECRET` Bearer): `generation-poller` (2 min: polls Higgsfield, persists to Blob, routes approve/bypass), `upload-worker` (2 min: generates metadata JSON via LLM, uploads to YouTube), `analytics-poller` (6 h: append-only youtube_metrics snapshots), `render-poller` (2 min: Remotion job status → edit_versions with isCurrent flip).
- OAuth: `app/api/auth/youtube/{start,callback}` (Google offline consent; callback encrypts refresh token, channel status connected). Telegram: `app/api/telegram/webhook` (mirror of Ask OS chat; secured by `TELEGRAM_ALLOWED_USER_ID` allowlist).
- UI: `components/youtube/*` (pipeline board with per-status actions, review queue with video player + edit requests, analytics, channels & settings), `components/freelance/ad-creative-studio.tsx` (Ad Studio sub-tab, attaches creatives to deals), `components/os-chat.tsx` (Ask OS tab).

### 11 new tables (text PKs via randomUUID, unlike the serial PKs elsewhere — PRD choice)
youtube_channels, pipeline_settings, video_projects, video_scripts (append-only revisions), generation_jobs, youtube_videos, youtube_metrics (append-only), ad_creatives, os_chat_messages, edit_requests, edit_versions.

### Stub activation map (set env → subsystem goes live, no code changes)
| Env vars | Unlocks |
|---|---|
| GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI + TOKEN_ENCRYPTION_KEY | Real YouTube OAuth, upload, analytics |
| HIGGSFIELD_API_KEY | Real video generation (verify endpoint paths in lib/higgsfield.ts against their docs) |
| BLOB_READ_WRITE_TOKEN (Blob integration) | Video persistence |
| REMOTION_RENDER_URL/SECRET | Real edit rendering |
| TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USER_ID | Telegram chat mirror (register webhook: `https://api.telegram.org/bot<token>/setWebhook?url=<app>/api/telegram/webhook`) |
| OPENROUTER_API_KEY (+ LLM_MODEL) | Swap the LLM brain off the default gateway |

### Deferred by PRD (§13 — do not build unless asked)
Multi-tenant/client-facing, RAG memory, OpenClaw/WhatsApp, A/B thumbnails, revenue tracking, autonomous topics, TikTok/Instagram crossposting, in-browser video editing.

## 11. Career Intelligence Subsystem (5th tab)

Built from the 10-doc Career Intelligence PRD pack (00_SYSTEM_CONSTITUTION binding; doc 09 is the authoritative port of the career-ops repo's real prompt content — the repo's own CLAUDE.md was overwritten by an unrelated tool and must be ignored). Ports the owner's `career-ops` Claude Code system (AGENTS.md + modes/*.md) into operator_os as durable agents. Additive only — golden rule: never modify FDE Prep, Freelance Funnel, LinkedIn OS, or YouTube Pipeline.

### Files
- `lib/career/scanner.ts` — **zero-token ATS scanner**: hits public Greenhouse/Lever JSON APIs directly (no LLM, no search provider — fully live with zero config). Title filter → URL dedup vs scan_history → insert as `discovered`. Tracked companies + title keywords live in `career_settings.extra` (JSON). Cron: `app/api/cron/career-scanner` every 4h; also manual "Scan Now".
- `lib/career-prompts/index.ts` — verbatim-ported prompt content from doc 09: evaluator rubric (1–5 scoring with decision rules: ≥3.5 shortlist), 6-block report structure (A role summary … F interview plan; Block G = portal snapshot via browser worker; H = draft answers), legitimacy heuristics (3 tiers), tailoring constitution (**never fabricate** — the sanity floor for resumes), outreach templates (contacto), deep-research 6-axis structure. All agents compose from here; do not re-derive prompt text from the career-ops repo.
- `lib/search.ts` — provider-agnostic web search seam: `SEARCH_PROVIDER` ∈ tavily | brave | serper | crawl4ai (+ `SEARCH_API_KEY` / `CRAWL4AI_BASE_URL`). `isSearchConfigured()` gates auto-execution.
- `lib/career/browser-worker.ts` — stub seam (`BROWSER_WORKER_URL`/`SECRET`) for PDF render, scan verification, portal snapshots.
- `app/actions/career.ts` — CRUD: settings (singleton, incl. comp guardrails ₹30–50L floor/₹75L+ stretch domestic, $5–7k/mo floor int'l), jobs + state machine transitions, stories (STAR), research notes, master resumes, contacts/outreach.
- `app/actions/career-agents.ts` — LLM agents via `getModel()`: `evaluateJob` (rubric → 6-block report + score + legitimacy tier; refuses if no master resume — source-of-truth rule), `tailorResume` (tailored resume_versions + cover_letter_versions with required changeExplanation + deterministic ATS keyword score 0–100), `prepareOutreach` (contacto), `deepResearch` (auto-executes when search configured, else generates copy-paste research prompt — Task 0.4 decision), `applyAssist` (drafts portal answers from resume + stories only), `runAutoPipeline` (evaluate → auto-shortlist ≥ threshold → tailor → outreach, gated per-step by settings toggles + sanity floor).
- UI `components/career/*`: career-tab (6 sub-tabs: Pipeline, Scanner, Resumes, Story Bank, Research, Settings), job-pipeline (status board + Add Job), job-detail (evaluate/tailor/deep/apply/auto actions + 6-block report + JD), resume-studio, story-bank, scanner-panel, research-panel, career-settings-panel.

### State machine (job_applications.status, DB CHECK)
discovered → evaluating → evaluated → shortlisted → tailored → outreach_prepared → pending_approval | auto_approved → applied → responded → interview → offer; terminal: rejected, discarded, skip.

### 12 tables (text PKs)
career_settings, job_applications, evaluation_reports, interview_stories, scan_history, company_research, contacts (career), outreach_messages, resumes, resume_versions, cover_letters, cover_letter_versions. All in Ask OS allowlist (+Telegram mirror).

### Known state / next steps
- **profile port DONE (Task 0.1)**: the owner's current FDE-focused resume is loaded as the "FDE Master" resume (with a v1 baseline resume_version) under the owner account, and career_settings is seeded with FDE-first role families (fde, genai_arch, solutions, ai_pm). The career-ops repo's profile.yml/cv.md remain stale AI-PM versions — never port them. Evaluation/tailoring are unblocked (pending LLM provider).
- Stub activation: SEARCH_PROVIDER+key → deep auto-executes; BROWSER_WORKER_URL → PDFs/snapshots; LLM provider (see §10) → all agents.
- The zero-token scanner is fully live with no configuration.

## 12. Jarvis (tool-calling Ask OS upgrade) + Money OS (6th tab)

### Jarvis — `lib/jarvis.ts`, `app/actions/chat.ts` (askJarvis)
The Ask OS chat is upgraded to "Jarvis": an AI SDK tool-loop agent (`generateText` + `tools` + `stopWhen: stepCountIs(6)`, heavy tier) with 6 tools: `query_database` (reuses the SAME hardened text-to-SQL path — validateSql + allowlist + userId param, exported from lib/os-chat.ts), `list_calendar_events` / `create_calendar_event` / `delete_calendar_event` (Google Calendar), `list_autopays` / `request_autopay_cancellation` (Money OS; cancellation = status flip to cancel_requested + playbook returned, never a real payment action). The UI (`components/os-chat.tsx`) has a Jarvis/quick-SQL mode switch and a **voice input mic button** (Web Speech API, `webkitSpeechRecognition`, graceful fallback when unsupported). Classic `askOs` path is untouched; Telegram still uses it.

### Google Calendar — `lib/google-calendar.ts`, `app/api/auth/google-calendar/{start,callback}`
Direct OAuth + REST (calendar.events scope), NOT MCP — deliberate: one in-house agent needing 3 operations doesn't justify an MCP server. Reuses the same `GOOGLE_CLIENT_ID/SECRET` as YouTube (register the second callback URL in Google Cloud Console + enable Calendar API). Tokens AES-encrypted via lib/crypto.ts into `connected_accounts` (same pattern as youtube_channels). Auto-refresh on expiry.

### Money OS — `app/actions/money.ts`, `components/money/money-tab.tsx`, `app/api/cron/autopay-reminder`
Autopay guardian for the owner's Indian accounts. **SECURITY CONSTITUTION: no bank credentials, full card numbers, CVVs, or PINs are EVER stored — payment_instruments is metadata only** (label, issuer, last-4, UPI handle). There is NO consumer API in India to programmatically cancel UPI mandates/card SIs (Razorpay/Stripe are merchant-side; the AA framework is read-only + requires FIU registration) — so cancellation is **playbook-driven**: per-rail, per-issuer step-by-step instructions (HDFC/Kotak/SBI/Tata Neu covered in `CANCELLATION_PLAYBOOKS` in money.ts). Daily cron (2:30 UTC = 8:00 IST) creates in-app notifications for autopays within `reminderDaysBefore` of `nextChargeDate`. Owner's 4 instruments are seeded. Future seams: AA (Setu/Finvu) read-only sync; Skydo for international freelancing.

### 3 new tables
connected_accounts (encrypted OAuth), payment_instruments (metadata only), autopays (status: active → cancel_requested → cancelled | paused). payment_instruments + autopays are in the Ask OS allowlist.

## 13. Settings Hub + Lead-Gen Agent + Premium Shell

### Settings Hub — `components/settings/settings-tab.tsx`, `app/actions/settings.ts`, `lib/config.ts`
Central configuration surface (gear icon in navbar). Six sections: **General** (display name, timezone, notification toggles → `app_config` key "general"), **Model Routing** (read-only live view of the tier registry + env override names — models are still env-controlled by design, so a bad UI edit can't brick agents), **Connections** (status cards for Google/YouTube/Calendar/Telegram/Higgsfield MCP; MCP note: Higgsfield is connected at the v0 chat level, not in-app), **API Key Vault** (BYO keys: OpenRouter, Tavily, Brave, Serper, Google Maps, Meta Ads — AES-encrypted into `api_keys`, lastFour shown, never returned after save), **Agents** (lead-gen agent config → `app_config` key "leadgen": ICP categories, locations, min score, daily cap, auto-run toggle), **Funnels** (Meta Ads seam → `app_config` key "funnels.meta_ads": account ID + token; no campaign push built yet — deliberate).
`lib/config.ts` is the resolution seam: `resolveApiKey(userId, provider)` → decrypted stored key or env fallback; `getConfig/setConfig` for JSON config. Anything needing a key must go through this, never read env directly for BYO-able providers.

### Lead-Gen Agent — `lib/leadgen.ts`, `app/actions/leadgen.ts`, `app/api/cron/leadgen-agent`, `components/freelance/leadgen-panel.tsx`
Pipeline: **discover → AI-qualify → review → promote**. Discovery source A: Google Places API (`GOOGLE_MAPS_API_KEY` or stored key) finds local businesses WITHOUT websites (classic freelance wedge). Source B: web search (Tavily/Brave/Serper via the same provider seam as career deep-research) finds businesses with outdated sites / AI-upgrade candidates. Qualifier: `leadgen.qualify` (standard tier) scores 0–100 against the owner's ICP config with rationale + pitch angle; score ≥ minScore → `qualified`. Promotion inserts into the existing `leads` table (source tagged) — funnel pipeline untouched. Cron: daily 4:00 UTC, runs only if `autoRun` enabled in config. All runs audited in `leadgen_runs`.

### Premium shell — `components/dashboard.tsx`, `app/globals.css`
Top navbar with Base UI dropdown groups (NOTE: this project's dropdown-menu is Base UI-based — use `render={<Button/>}` not `asChild`, `onClick` not `onSelect`, and labels must sit inside `DropdownMenuGroup`). Design tokens: deeper background (oklch 0.13), elevation utilities `.surface-raised` / `.surface-glow` / `.grid-backdrop` / `.text-micro` in globals.css. Section header strip shows group + section name. Mobile: horizontal scroll chip nav. All section components (FdeTab, FreelanceTab, etc.) were NOT modified — only the shell around them.

### 4 new tables
`app_config` (per-user JSON store, unique userId+key) · `api_keys` (encrypted, unique userId+provider) · `leadgen_prospects` (status: discovered → qualified → promoted | rejected) · `leadgen_runs` (audit). All in Ask OS allowlist? NO — deliberately excluded (api_keys must never be queryable via chat SQL; prospects/runs can be added later if wanted).

## 14. Arsenal — Skills + Automations (Jarvis's extensible capability layer)

### Skills — `lib/skills.ts`, `lib/skills-seed.ts`, `app/actions/arsenal.ts`, `components/arsenal/arsenal-tab.tsx`
A skill = a DB-stored block of prompt-level expertise (rules/method/templates). Active skills whose `targetAgents` include an agent key are appended to that agent's system prompt at run time via `skillsBlockFor(userId, agentKey)` — the same seam as Jarvis's `directiveBlock`, injected in all 5 LLM agents (linkedin_post, youtube_script, leadgen_qualify, career_outreach, ads_creative). Deterministic targeting (no classifier), 6-skill/4000-char caps per agent, and skills can NEVER override safety/fabrication rules. Ingestion: curated pack (`CURATED_PACK` — 10 skills distilled from the 100-agents marketing guide, tuned to the India-freelance ICP), zip upload of SKILL.md files (frontmatter or LLM metadata inference — `arsenal.skill_extract`, standard tier), Jarvis `add_skill`, or absorbed from automations. Git-repo-link ingestion is a planned follow-up.

### Automations — `lib/n8n.ts`, `automations`/`automation_runs` tables
Import pasted n8n workflow JSON on the Arsenal page → deterministic node inventory → heavy-tier analysis (`arsenal.analyze_automation`): end-to-end summary, run-whole verdict, absorbable capabilities (each optionally pre-written as skill content — one-click "Absorb as skill"), risks. Running whole workflows needs the n8n seam: instance URL in Settings → Connections (`connections.n8nBaseUrl`) + API key in vault (`n8n` provider) — deploy/activate/run/executions via n8n public API; honest stub until connected. All runs audited in `automation_runs`.

### Jarvis god-mode extensions
6 new tools: `list_skills`, `add_skill`, `assign_skill`, `list_automations`, `analyze_automation`, `run_automation`. Jarvis may self-invoke `run_automation` when the analysis clearly serves the operator's request but must announce it. All mutations audited in `jarvis_actions`.

### Browser automation — `lib/browser-automation.ts`
agent-browser (vercel-labs) running in an ephemeral **Vercel Sandbox** microVM via `@agent-browser/sandbox` — serverless-native, no local daemon, no repo vendoring (the operator's local clone at `../agent-browser-main` is NOT a dependency). Activates automatically on Vercel deployments (OIDC token) or locally with `VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID`. Career browser functions (`verifyPostingLiveness`, `snapshotPosting`) now resolve: custom `BROWSER_WORKER_URL` worker → agent-browser sandbox → stub. `renderPdf` stays custom-worker-only (binary out of sandbox = follow-up). Jarvis gained `browse_page` (READ-ONLY: title + readable text + interactive-element snapshot; ~20-40s cold start; audited). Playwright MCP is an IDE-side tool for Claude Code sessions, not app runtime — in-app last fallback is plain fetch (`lib/search.ts fetchPage`).

### Agent Playground — `lib/agent-registry.ts`, `lib/agent-graph.ts`, `lib/agent-status.ts`, `lib/agent-graph-mutations.ts`, `app/actions/playground.ts`, `components/playground/*`
Live, editable orchestration canvas (React Flow / `@xyflow/react`) — new nav section next to Jarvis/Arsenal. **Single source of truth = `lib/agent-registry.ts`** (27 real agents derived from `TASK_TIERS` + the actual state machines/chains, each with a stable human `displayName`, role, tier, group, orchestrator flag, `statusSource`, and real handoff/control edges) **⊕ per-user overlay** in `app_config` key `"agent_graph"` (renames, pauses, added/removed agents+edges, orchestrator overrides, canvas layout). `lib/agent-graph.ts` merges base⊕overlay into the effective graph; `lib/agent-graph-mutations.ts` is the ONE write path shared by the Playground UI **and** Jarvis (5 new tools: `graph_overview`, `set_agent_paused`, `rewire_agents`, `unwire_agents`, `rename_agent`) so the two surfaces never drift (spec §2.6). Every mutation audited into `jarvis_actions` (tool `agent_graph`). **Status is code-only, ZERO LLM** (`lib/agent-status.ts`): one batched SQL of latest-row lookups across the state/audit tables → green/yellow/red/idle + an env-driven blocked overlay (missing `HIGGSFIELD_API_KEY` → Forge red). SWR-polled every 15s. Editing: add/delete/pause/resume/rename agents, drag-to-rewire + cut edges, persisted layout; load-bearing agents (`loadBearing:true`) are protected from delete/pause. Pause is enforced at dispatch: `runLeadgenAgent` + `runAutoPipeline` check `isAgentPaused` and skip with a clear message (the pattern extends to other dispatch points as needed). Design tokens added to `globals.css`: `--status-{success,pending,error}`, motion tokens (`--ease-out`, `--dur-*`), and utilities `.node-glow-*` / `.node-face` / `.press` / `.skeleton`. **Note (open):** the broader app-wide premium UI polish (every section) is staged — the Playground and the shared token/utility foundation shipped; section-by-section restyle is the remaining workstream.

### Secrets hardening (same pass)
`secret_access_log` table — every vault read/write/delete audited (provider/action/source, never values), surfaced in Settings → API Keys. `scripts/rotate-encryption-key.mjs` re-encrypts all AES columns under a new `CREDENTIALS_ENCRYPTION_KEY` (idempotent). Correct env name everywhere: `CREDENTIALS_ENCRYPTION_KEY` (older docs said TOKEN_ENCRYPTION_KEY — wrong). Bootstrap secrets (`CREDENTIALS_ENCRYPTION_KEY`, `CRON_SECRET`, `DATABASE_URL`, `BETTER_AUTH_SECRET`) are deliberately env-only — they can't live inside the vault they protect. AA (Setu) is a read-only config seam only — no consumer API exists for mandate cancellation (see Money OS constitution).

## 15. How to Refine This Codebase

1. Read this doc, then read `lib/constants.ts`, `lib/db/schema.ts`, `app/actions/*.ts`, and `components/dashboard.tsx` — that's ~80% of the mental model.
2. Follow existing patterns exactly: server action + `getUserId()` + userId-scoped queries + `revalidatePath` / SWR `mutate`.
3. New UI: use existing `components/ui/*` primitives (Base UI conventions), semantic tokens, mobile-first flexbox.
4. Any new table: `userId` text column, no FKs, mirror in `lib/db/schema.ts`, scope every query.
5. Do not add OAuth/magic links/localStorage persistence for the operator login, and do not swap the DB driver. (Google OAuth for YouTube channel connection in §10 is separate and expected.)
6. For vault work, `second-brain/CLAUDE.md` governs — including the self-annealing rule: every failure or correction becomes an edit to a directive, script, or skill file.
7. All AI agents must use `getModel(tier)` from `lib/llm.ts` with a tier from the `lib/model-router.ts` registry — never hardcode model strings, and annotate each call site with `// task_name — rationale`.
