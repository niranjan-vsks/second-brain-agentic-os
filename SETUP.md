# second-brain-os — Local Setup Guide

This is a Next.js 16 app backed by Neon Postgres and Better Auth.
Follow these steps in order. The whole process takes about 10 minutes.

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A free [Neon](https://neon.tech) account
- A [Vercel](https://vercel.com) account (only needed if you want to deploy)

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/Second-brain-os.git
cd Second-brain-os
```

---

## Step 2 — Create a Neon project

1. Go to [console.neon.tech](https://console.neon.tech) and sign in.
2. Click **New Project**.
3. Name it `second-brain-os` (any name works).
4. Choose the region closest to you.
5. Click **Create project**.
6. On the project dashboard, click **Connect** → copy the **Connection string**.
   It looks like:
   ```
   postgres://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this — it is your `DATABASE_URL`.

---

## Step 3 — Run the database schema

1. In the Neon dashboard, go to the **SQL Editor** tab (left sidebar).
2. Open `setup.sql` from the root of this repo.
3. Copy the **entire contents** and paste into the Neon SQL Editor.
4. Click **Run**.
5. You should see `14 statements executed successfully` (or similar).
6. Verify by clicking **Tables** in the sidebar — you should see all 14 tables.

> The file uses `CREATE TABLE IF NOT EXISTS` on every statement, so it is
> safe to run more than once if anything goes wrong.

---

## Step 4 — Create your environment variables

In the project root, create a file called `.env.local`:

```bash
touch .env.local
```

Open it and add the following (replace the placeholder values):

```env
# Neon — paste your connection string from Step 2
DATABASE_URL=postgres://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Better Auth — generate a random secret with the command below
BETTER_AUTH_SECRET=your_secret_here

# Vercel AI Gateway — needed for the LinkedIn OS Draft Composer agent
# Get this from: vercel.com → your team → Settings → AI → API Keys
AI_GATEWAY_API_KEY=your_key_here
```

**Generate `BETTER_AUTH_SECRET`:**

```bash
openssl rand -base64 32
```

Copy the output and paste it as the value.

**Get `AI_GATEWAY_API_KEY`:**

1. Go to [vercel.com](https://vercel.com) → your team.
2. Settings → AI → API Keys → Create Key.
3. Copy and paste.

> `AI_GATEWAY_API_KEY` is only required for the LinkedIn OS AI agents
> (Draft Composer, Tweak Agent). Everything else works without it.

---

## Step 5 — Install dependencies

```bash
pnpm install
```

---

## Step 6 — Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

You should see the Sign Up page. Create an account — this automatically
seeds your FDE Prep syllabus (25 topics across 5 tracks) and FDE drill
questions on first login.

---

## Step 7 — Verify everything works

Walk through this checklist after signing up:

| Check | What to do |
|---|---|
| Auth | Sign up → redirected to dashboard |
| FDE Prep | Topics tab shows 25 seeded topics with progress bars |
| Weekly Planner | Add a study session for this week |
| Drill Bank | Question bank shows pre-seeded FDE questions |
| Resource Vault | Add a link |
| Freelance Pipeline | Add a deal → open it → stage checklist loads |
| Asset Library | Add a prompt asset |
| Outreach Tracker | Add a lead |
| Artifact Generator | Pick a template → generate a proposal |
| LinkedIn OS | Add a trend item manually |
| Style Vault | Add a writing sample and a voice preference |
| Notifications bell | Appears in header top-right |
| Sign out | Returns to sign-in page |

---

## Deployment to Vercel

```bash
pnpm build   # verify it builds locally first
```

Then:

1. Push to GitHub (already done if you cloned from `Second-brain-os`).
2. Go to [vercel.com/new](https://vercel.com/new) → Import the repo.
3. In **Environment Variables**, add the same three variables from Step 4:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `AI_GATEWAY_API_KEY`
4. Click **Deploy**.

> On Vercel, `BETTER_AUTH_URL` is not needed — the auth config auto-detects
> `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`.

---

## Handing off to Claude Code

The file `CLAUDE.md` at the repo root is a full context document written
specifically for Claude Code. When you open this repo in Claude Code it
reads `CLAUDE.md` automatically and gets:

- What each of the 3 tabs does and why
- The full file map with reading order
- Every table and its purpose
- The security invariant (userId-scoping on all server actions, no RLS)
- Critical gotchas (Base UI dialog pattern, trusted origins config)
- The Research Agent PRD location (`lib/prd.ts`)
- The LinkedIn OS state machine and deferred work
- Explicit rules for refining the codebase without breaking patterns

To start a Claude Code session:

```bash
cd Second-brain-os
claude   # or: claude --context CLAUDE.md
```

---

## Opening the Second Brain vault in Obsidian

The repo contains an Obsidian-compatible vault at `second-brain/`.

1. Open Obsidian → **Open folder as vault** → select the `second-brain/` folder inside your clone.
2. Obsidian will create a local `.obsidian/` folder for UI state — it is already gitignored, so your personal workspace settings never pollute the repo.
3. Open `brain/INDEX.md` for the map of all knowledge notes, or open the graph view to see the wiki-link structure.
4. Read `second-brain/CLAUDE.md` first — it is the vault's constitution (context loading order, standing rules, self-annealing protocol).
5. Fill the `[FILL]` sections in `context/owner.md`, `context/company.md`, and `context/brand_voice.md` — fastest method: record yourself talking for 20-30 minutes, transcribe, and have Claude Code organize it into these files.
6. To regenerate the brain index after adding notes: `node second-brain/execution/generate_index.mjs`.

The workflow: **you** read and curate in Obsidian; **Claude Code** reads and writes the vault when run from the repo root (it discovers both `CLAUDE.md` files automatically).

---

## Operating the YouTube Ads Pipeline (day-to-day)

The **YouTube** tab is a multi-agent content pipeline. Everything works out of the box in stub mode; wiring the env vars below turns each stub into the real service — no code changes. Full technical detail is in `CLAUDE.md` §10.

### One-time configuration
1. Open the **YouTube** tab → **Channels & Settings**.
2. **Add a channel.** Without Google OAuth env vars it is added as a stub (status `needs_reauth`) so you can build the whole pipeline; once OAuth is configured, click **Connect** to authorize the real channel.
3. **Fill pipeline settings:** content domain, tone/voice notes, and **red-flag terms** (comma-separated). Red-flag terms are the safety net — any script containing one can never auto-publish.
4. Choose the default video format and whether new projects **bypass approval** by default.

### The daily loop
1. **Create a video** (or paste a list of topics into **New Batch**). Each becomes a project in `draft`.
2. **Write Script** → the Script Composer agent (your configured LLM) drafts script + shot breakdown → `script_ready`.
3. **Generate** → the Prompt Engineer builds the generation prompt and submits to Higgsfield → `generating`. The `generation-poller` cron finishes it automatically and persists the video to Blob.
4. **Review:** projects land in **Review Queue** as `pending_approval` (watch the video, request edits in natural language, then Approve/Reject) — unless the project has bypass enabled and passes the **sanity floor** (non-empty script, no red-flag terms, generation succeeded), in which case it becomes `auto_approved`.
5. **Upload:** the `upload-worker` cron generates title/description/tags via the LLM and uploads to YouTube → `published`.
6. **Analytics:** the `analytics-poller` cron records view/like/comment snapshots every 6 hours (visible in the **Analytics** sub-tab).

### Editing videos
In the Review Queue, type a plain-English edit ("trim the first 3 seconds, add captions"). The `edits` action turns it into a constrained Remotion spec; the `render-poller` cron produces a new version and flips `isCurrent`. Version history is preserved.

### Ad creatives (Freelance Funnel → Ad Studio)
Generate PAS/BAB/testimonial-style ad scripts + videos and attach them to a specific deal. Same generation backend as the YouTube pipeline.

### Jarvis (chat, formerly Ask OS)
The **Jarvis** tab is a tool-calling assistant: it can query your data (same read-only SQL guardrails as before — SELECT-only, table allowlist, user-scoped, audited), manage your Google Calendar (list/add/delete events once connected via the Money tab), and manage your autopays (list them, flag one for cancellation and hand you the bank playbook). The mic button enables voice commands (browser speech recognition, best in Chrome). Flip the toggle off for classic quick-SQL mode. Telegram uses the classic path.

### Model routing (cost control)
Every agent task is mapped to a model tier in `lib/model-router.ts`: **light** (formatting, metadata), **standard** (outreach/LinkedIn drafts, SQL generation), **heavy** (job evaluation, resume tailoring, YouTube scripts, Jarvis tool-loop). Defaults: Gemini Flash-Lite / Gemini Flash / Claude Sonnet via the AI Gateway. Override any tier with `GATEWAY_MODEL_LIGHT/STANDARD/HEAVY` (or `LLM_MODEL_*` on OpenRouter/custom) — no code changes needed. Failed light/standard outputs auto-escalate one tier once.

### Cron schedules (Vercel)
Defined in `vercel.json` and protected by `CRON_SECRET`: generation-poller, upload-worker, render-poller run every 2 minutes; analytics-poller every 6 hours; career-scanner every 4 hours; autopay-reminder daily at 8:00 IST. On Vercel they run automatically once the project is deployed and `CRON_SECRET` is set.

---

## Operating Career Intelligence (day-to-day)

The **Career** tab is a job-search operating system ported from the owner's career-ops Claude Code setup. The zero-token scanner works immediately with no configuration; LLM agents need an LLM provider (see the LLM Brain section); deep research upgrades from prompt-generator to auto-execution when a search provider is set.

### One-time configuration
1. **Settings sub-tab:** enable role families (FDE / AI PM / GenAI Architect / Solutions), geographies, comp guardrails (defaults: ₹30–50L floor / ₹75L+ stretch domestic; $5–7k/mo floor int'l), red-flag terms, and the automation toggles (auto-tailor, auto-outreach — all off by default; every automated step respects these).
2. **Resumes sub-tab:** add your master resume (markdown). **Evaluation and tailoring refuse to run without one** — the agent never fabricates a profile (source-of-truth rule).
3. **Scanner sub-tab:** track companies by their Greenhouse/Lever board slug (e.g. `vercel` for boards.greenhouse.io/vercel), and set title keywords in Settings.

### The daily loop
1. **Discover:** the career-scanner cron (4h) or "Scan Now" pulls jobs from tracked ATS boards — zero LLM tokens, public JSON APIs, title-filtered and URL-deduped. Or add any job manually.
2. **Evaluate:** per job, runs the rubric (1–5 score, ≥3.5 = shortlist), legitimacy check (3 tiers), and generates the 6-block report (role summary, CV match, level strategy, comp demand, personalization plan, interview plan).
3. **Tailor:** generates a job-specific resume version + cover letter with a required change explanation and a deterministic ATS keyword score (0–100, matched/missing lists). All versions are kept.
4. **Outreach:** drafts recruiter/hiring-manager messages (contacto templates). Drafts only — you send them.
5. **Deep research:** auto-executes 6-axis company research when a search provider is configured; otherwise generates a copy-paste prompt for Perplexity/ChatGPT (saved to the Research sub-tab either way).
6. **Apply assist:** paste portal questions, get draft answers grounded only in your resume + STAR story bank.
7. **Run Auto-Pipeline** chains evaluate → shortlist → tailor → outreach in one click, gated by your Settings toggles.

### Story Bank
Maintain STAR stories (Situation/Task/Action/Result/Reflection) tagged by requirement. Evaluation Block F and apply-assist pull from these.

---

## Operating Money OS (autopay guardian)

The **Money** tab tracks your payment instruments and autopays with a zero-credential design: only labels, issuers, and last-4 digits are stored — never full card numbers, PINs, or bank logins.

1. **Add instruments** (cards/UPI handles as metadata). The owner's four (HDFC Debit, Tata Neu Infinity HDFC CC, Kotak 811 Debit, SBI Debit) are pre-seeded.
2. **Add autopays**: merchant, rail (UPI mandate / card standing instruction / e-NACH), amount, cadence, next charge date, and how many days before you want a reminder.
3. **Reminders**: a daily cron (8:00 IST) creates an in-app notification for anything charging within its reminder window.
4. **Cancelling**: click "Request Cancel" (or ask Jarvis) — the autopay flips to `cancel_requested` and you get the exact per-bank playbook (HDFC/Kotak/SBI/Tata Neu steps for UPI mandates, card SIs, and e-NACH). No consumer API exists in India to cancel mandates programmatically — anyone claiming otherwise is a red flag.
5. **Google Calendar**: the Connect button on this tab links your calendar for Jarvis (add/list/delete events). Uses the same Google OAuth app as YouTube — enable the Calendar API and register `/api/auth/google-calendar/callback` as a second redirect URI.

---

## Operating the Settings Hub (central configuration)

Click the **gear icon** in the top navbar. Six sections:

1. **General** — display name, timezone, notification preferences.
2. **Model Routing** — live read-only view of which model tier (light/standard/heavy) each agent task uses, plus the exact env var names to override any tier. Models are changed via env vars (v0: settings menu → Vars; Vercel: project → Settings → Environment Variables), not the UI — deliberate, so a mis-click can't brick your agents.
3. **Connections** — status of Google/YouTube, Google Calendar, Telegram, and MCPs. Note: Higgsfield MCP is connected at the v0 chat level (prompt form → Tools), not inside the app.
4. **API Keys** — bring your own keys (OpenRouter, Tavily, Brave, Serper, Google Maps, Meta Ads). Keys are AES-encrypted at rest; only the last 4 characters are ever shown after saving. Resolution order everywhere: stored key first, env var fallback.
5. **Agents** — configure the Lead-Gen Agent: target business categories, locations, minimum qualification score, daily prospect cap, and the auto-run toggle for the daily cron.
6. **Funnels** — Meta Ads seam: store your ad account ID + access token now; campaign automation is a future build (config-only today, clearly labeled).

## Operating the Lead-Gen Agent (Freelance Funnel)

Freelance Funnel → **Lead-Gen Agent** sub-tab. The pipeline is discover → AI-qualify → review → promote:

1. **Configure** your ICP in Settings → Agents (or use the defaults: local businesses in your area).
2. **Run discovery** — two sources: *Maps (no website)* finds local businesses without websites via Google Places (needs `GOOGLE_MAPS_API_KEY` or a stored Google Maps key), and *AI upgrade* finds businesses with outdated web presence via web search (needs a Tavily/Brave/Serper key).
3. **AI qualification** scores each prospect 0–100 against your ICP with a rationale and suggested pitch angle. Prospects at/above your min score become `qualified`.
4. **Review and promote** — promoting inserts the prospect into your normal leads pipeline (source-tagged); reject the rest. The agent never touches your funnel stages.
5. **Auto-run**: enable in Settings → Agents to run discovery daily at 4:00 UTC. Every run (manual or cron) is logged in the run history at the bottom of the panel.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid origin` on sign up | You are accessing from a non-localhost URL. Add the origin to `trustedOrigins` in `lib/auth.ts`. |
| `BETTER_AUTH_SECRET not set` | The env var is missing. Check `.env.local` and restart the dev server. |
| Tables not found on first load | You forgot Step 3. Run `setup.sql` in the Neon SQL Editor. |
| AI Composer returns 402/payment error | Add a card to your Vercel account at vercel.com → Settings → Billing. The AI Gateway requires billing to be enabled even for free-tier usage. |
| `Cannot find module 'pg'` | Run `pnpm install` again. The `pg` driver must be installed. |
| Session lost on page reload (localhost) | Rare; confirm `NODE_ENV=development` is set. The auth config applies `sameSite: none, secure: true` cookies in dev for iframe compatibility. |
| Video generation always fails with a stub message | Expected until `HIGGSFIELD_API_KEY` is set. Verify the endpoint paths in `lib/higgsfield.ts` against Higgsfield's current docs. |
| Channel stuck on `needs_reauth` | Google OAuth env vars are missing or the consent flow was cancelled. Set `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` + `TOKEN_ENCRYPTION_KEY`, then click **Connect**. |
| Crons never run locally | Vercel crons only fire on deployment. To test locally, hit the route manually with the `Authorization: Bearer $CRON_SECRET` header. |
| Ask OS says a table isn't allowed | By design — only allowlisted tables in `lib/os-chat.ts` are queryable, and only SELECT. Add tables to the allowlist if needed. |
| Career: "Evaluate" refuses to run | No master resume exists. Add one in Career → Resumes. This is the source-of-truth rule, not a bug. |
| Career scan adds 0 jobs, all title-filtered | No title keywords / role families are enabled in Career → Settings. Set them and re-scan. |
| Deep research only generates a prompt | No search provider configured. Set `SEARCH_PROVIDER` + `SEARCH_API_KEY` (or `CRAWL4AI_BASE_URL`) to auto-execute. |

---

## Environment variables — quick reference

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | Yes | Neon dashboard → Connect → Connection string |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AI_GATEWAY_API_KEY` | Default LLM path | vercel.com → Settings → AI → API Keys |
| `OPENROUTER_API_KEY` + `LLM_MODEL` | To use your own LLM (e.g. GLM) | openrouter.ai → Keys. Set `LLM_MODEL` to the model slug. Takes priority over the gateway. |
| `LLM_BASE_URL` + `LLM_API_KEY` | Any OpenAI-compatible endpoint | Your provider. Alternative to OpenRouter. |
| `TOKEN_ENCRYPTION_KEY` | For YouTube OAuth | `openssl rand -hex 32` (encrypts stored OAuth tokens) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Real YouTube upload/analytics | Google Cloud Console → OAuth credentials |
| `HIGGSFIELD_API_KEY` | Real video generation | Higgsfield dashboard |
| `BLOB_READ_WRITE_TOKEN` | Video persistence | Add the Vercel Blob integration |
| `REMOTION_RENDER_URL` / `REMOTION_RENDER_SECRET` | Real video editing | Your Remotion render service |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ALLOWED_USER_ID` | Telegram chat mirror | @BotFather; your numeric Telegram user id |
| `SEARCH_PROVIDER` / `SEARCH_API_KEY` | Career deep-research auto-execution | tavily \| brave \| serper \| crawl4ai; provider dashboard |
| `CRAWL4AI_BASE_URL` | crawl4ai search/crawl provider | Your self-hosted crawl4ai instance URL |
| `BROWSER_WORKER_URL` / `BROWSER_WORKER_SECRET` | Career PDF render + portal snapshots | Your browser-automation worker service |
| `GOOGLE_MAPS_API_KEY` | Lead-Gen Agent maps discovery | Google Cloud Console → enable Places API (or store in Settings → API Keys) |
| `META_ADS_ACCESS_TOKEN` | Meta Ads funnel seam (config-only today) | Meta Business → system user token (or store in Settings → API Keys) |
| `GATEWAY_MODEL_LIGHT/STANDARD/HEAVY` | Per-tier model overrides | Any valid AI Gateway model ID (see Settings → Model Routing for tier map) |
| `CRON_SECRET` | Cron auth (on Vercel) | `openssl rand -base64 32` |

See `.env.example` for the annotated full list. Every pipeline variable above is optional — the app runs in stub mode without them and each one activates its subsystem with no code changes.
