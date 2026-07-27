# BULLSEYE BACKLOG — deferred build specs (do NOT build until the owner says the trigger word "bullseye")

> This file is the durable context/memory layer for large deferred builds. When the owner says **"bullseye"**, a fresh Opus/Sonnet session picks the item they name and builds it. Everything here is spec + intent, not running code. Cross-reference `CLAUDE.md` (architecture + invariants) — all invariants there still apply (userId scoping, getModel(tier), no fabrication, audit everything, human approval on outward-facing/irreversible actions).

---

## 1. Freelance Delivery CRM (HIGHEST PRIORITY for the agency)

**Why:** the agency (Lanthanic — see `new_agents/Lanthanic_context_handoff.md`) delivers AI services (agents, voice agents, videos, automations, sites, RAG, CRMs) to clients, and the **multi-agent system does the delivery**. That delivery needs CRM-style UI + tracking. This is the freelance funnel's most important upgrade.

### 1.1 Unified ID nomenclature (single `generateEntityId(type)` function)
Human-readable, sortable, prefix-per-entity. Format: `<PREFIX>-<YYYY>-<zero-padded-seq>` (seq is per-type, per-year).

| Entity | Prefix | Example |
|---|---|---|
| AI Employee (agent) | `EMP` | `EMP-2026-001` |
| Client | `CLI` | `CLI-2026-014` |
| Assignment (delivery job) | `ASG` | `ASG-2026-032` |
| Invoice | `INV` | `INV-2026-007` |
| Ticket (internal work item) | `TKT` | `TKT-2026-119` |

One function owns all of them so the scheme never drifts. Store the running counters (per type+year) in a small `id_counters` table or derive from max(existing).

### 1.2 AI Employee onboarding (each agency-agent = an onboarded "employee")
When the Agency-Agents roster (`~/Downloads/agency-agents-main`, 285 personas / 17 divisions in `divisions.json`) is integrated, each persona is onboarded as an EMP with a CRM record. Reuse the existing Playground/graph + voice + autonomy + skills machinery (do NOT build a new paradigm — CLAUDE.md §14 Agency-Agents note).

**Employee record fields:**
- `id` (EMP-…)
- `name` / persona name
- `division` (from divisions.json — 17 divisions)
- `role` / title
- `systemPrompt` (the persona md body, stored skill-style)
- `toolGrants` (scoped tools + MCP servers this employee may use — NOT global)
- `skillsAttached` (skill ids)
- `autonomyLevel` (review / auto)
- `voiceProfile` (optional)
- `costTier` (light/standard/heavy routing)
- `status` (active / retired)
- `createdAt` / `updatedAt`

### 1.3 Assignment entity (the delivery job — the CRM card)
**Fields (owner-specified + suggested):**
- `id` (ASG-…)
- `clientId` (CLI-…) + `clientName` (denormalized for display) ← owner asked for these
- `assignedEmployeeIds` (array of EMP ids — multi-agent delivery) ← owner: "our multi-agent system does the delivery"
- `serviceType` (rag / voice_agent / video / automation / website / crm / branding / … — extend `BUILD_TYPES` in lib/constants.ts)
- `title` ← owner
- `description` / brief ← owner
- `acceptanceCriteria` ← owner
- `paymentAmount` + `currency` (how much they're paying) ← owner
- `paymentStatus` (quoted / invoiced / partial / paid)
- **suggested additions:**
  - `deliverables` (checklist — reuse the STAGE_PLAYBOOKS pattern)
  - `status` lifecycle: `intake → scoping → in_progress → review → delivered → retention → closed` (DB CHECK-constrained, like other state machines)
  - `priority`
  - `dueDate` + `milestones`
  - `attachments` / links (Blob)
  - `notes`
  - `linkedTicketIds` (work broken into TKTs, assigned to EMPs via Jarvis dispatcher)
  - `invoiceId` (INV-… once invoiced)
  - `createdAt` / `updatedAt`
- Every mutation audited.

### 1.4 Ticket queue + Jarvis-as-dispatcher (the work tracker)
Separate layer from Agent Playground (Playground = agent topology/health; tickets = work items + ownership + status). `tickets` table; assignee can be a **human OR an EMP agent**. Jarvis tools: `create_ticket`, `assign_ticket`, `dispatch_ticket` → Jarvis reasons which EMP(s) fit an assignment and assigns. Status: `open → assigned → in_progress → needs_review → done`. Human-approval gate before anything outward-facing (Lanthanic §7.6).

---

## 2. Client Onboarding — agentic automation (owner will supply readymade GitHub repos / n8n workflows to ingest)
Automate: contract → kickoff questionnaire → asset collection → CRM record creation (CLI + ASG) → project workspace setup. Ingest owner-provided repos/n8n JSON via the existing Arsenal automation-import path (lib/n8n.ts). Productizable + sellable as "Automated CRM Onboarding" (Lanthanic flywheel — dogfood is the marketing).

## 3. Invoicing — agentic automation (owner will supply readymade repos / n8n)
Generate invoice (INV-…) from an assignment's payment terms → send → track paid status → reminders. Ingest owner-provided automation. Respect Money OS security constitution (metadata only, never card/bank creds).

---

## 4. Connection Hub — MCP connectors + npm-skill ingestion (owner asked; see complexity notes)

### 4.1 MCP connectors section (toggle UI like Claude.ai)
- New section in Connection Hub: list of MCP servers, each with an on/off Switch (mirror Claude.ai connectors UX).
- **REMOTE/HTTP(SSE) MCP servers: feasible.** Store `{name, url, authHeader (vault), enabled}` in a new `mcp_servers` table (userId-scoped; auth in the AES vault, never echoed). At agent runtime, for each enabled server, create an MCP client (AI SDK `experimental_createMCPClient`), pull its tools, merge into the tool set for Jarvis + relevant agents. Audited.
- **LOCAL/stdio MCP (the `npx …` launch kind): NOT runnable on Vercel serverless** — needs a persistent host to spawn/keep the subprocess. Either restrict to remote MCP, or route stdio MCP through a persistent worker (browser-worker pattern / separate always-on host). Be honest about this seam in the UI.

### 4.2 Skills via npm/npx paste
- Owner's ask: paste an npm/npx command → it adds the skills. Reframe needed: this repo's "skills" are DB-stored prompt blocks (lib/skills.ts, frontmatter/markdown), NOT executable npm packages. An `npx` executable is code, not a prompt-skill.
- **Feasible interpretation (medium-low):** paste an npm **package name** → fetch its README / SKILL.md from the npm registry (registry.npmjs.org) or unpkg → run through the existing `arsenal.skill_extract` (standard tier) → store as a DB skill. i.e. "pull the package's docs and distill a skill," which fits the existing zip/curated ingestion paths.
- Straight "run the npx command in-app" does NOT map to the web app's runtime and should not be promised.

---

## Trigger
Owner says **"bullseye"** + names the item → fresh Opus/Sonnet session builds it, following CLAUDE.md invariants + this spec.
