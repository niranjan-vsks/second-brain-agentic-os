import "server-only"
import { tool } from "ai"
import { z } from "zod"
import { randomUUID } from "crypto"
import { db, pool } from "@/lib/db"
import { appConfig, apiKeys, jarvisActions, jarvisLessons, leadgenRuns, skills, automations } from "@/lib/db/schema"
import { and, eq, desc } from "drizzle-orm"
import {
  getConfig,
  KEY_PROVIDERS,
  AGENT_KEYS,
  type AgentKey,
  type AgentOverrides,
  LEADGEN_DEFAULTS,
  GENERAL_DEFAULTS,
  META_ADS_DEFAULTS,
  JOBHUNT_DEFAULTS,
} from "@/lib/config"
import { encrypt, isCryptoConfigured } from "@/lib/crypto"
import { describeLlm } from "@/lib/llm"
import { TASK_TIERS } from "@/lib/model-router"
import { AGENT_BY_KEY } from "@/lib/agent-registry"
import { renameAgent, setAgentPaused, addEdge, deleteEdge, setAgentAutonomy } from "@/lib/agent-graph-mutations"

// =============================================================================
// Jarvis orchestrator tools — the "god-mode" layer.
//
// Design decisions (deliberate, documented for handoff):
// - ALLOWLISTED WRITES ONLY. Jarvis can only touch config keys, agent keys,
//   providers, and workflows that are explicitly registered here. There is no
//   generic "write anything" tool — a prompt-injected or confused Jarvis cannot
//   drop tables, exfiltrate keys, or mutate arbitrary rows.
// - EVERY MUTATION IS AUDITED into jarvis_actions (tool, summary, payload).
//   Secrets are never written to the audit log (only provider + last four).
// - SELF-IMPROVEMENT = jarvis_lessons. Active lessons are injected into the
//   system prompt on every chat. Jarvis is instructed to save a lesson whenever
//   the operator corrects it or states a lasting preference, and to record
//   self_reflection lessons when a workflow fails. This is memory, not
//   self-modifying code — the safe 90% of "self-improving agent".
// =============================================================================

// --- Config registry: what Jarvis may read/write ------------------------------

const CONFIG_REGISTRY: Record<string, { defaults: Record<string, unknown>; description: string }> = {
  leadgen: {
    defaults: LEADGEN_DEFAULTS as unknown as Record<string, unknown>,
    description: "Lead-gen agent: enabled, icpNotes, categories, locations, sources, qualifyThreshold, maxPerRun, autoPromote",
  },
  general: {
    defaults: GENERAL_DEFAULTS as unknown as Record<string, unknown>,
    description: "General prefs: displayName, timezone, telegramMirror, notifyInApp",
  },
  "funnels.meta_ads": {
    defaults: META_ADS_DEFAULTS as unknown as Record<string, unknown>,
    description: "Meta Ads funnel seam: enabled, adAccountId, pageId, dailyBudgetINR, notes",
  },
  jobhunt: {
    defaults: JOBHUNT_DEFAULTS as unknown as Record<string, unknown>,
    description: "Job-Hunt engine Sourcer: enabled, boards (name+url list), roleKeywords, locations, maxPerBoard",
  },
}

async function upsertConfig(userId: string, key: string, value: Record<string, unknown>) {
  const existing = await db
    .select()
    .from(appConfig)
    .where(and(eq(appConfig.userId, userId), eq(appConfig.key, key)))
    .limit(1)
  if (existing.length > 0) {
    await db
      .update(appConfig)
      .set({ value, updatedAt: new Date() })
      .where(and(eq(appConfig.userId, userId), eq(appConfig.key, key)))
  } else {
    await db.insert(appConfig).values({ id: randomUUID(), userId, key, value })
  }
}

async function logAction(userId: string, toolName: string, summary: string, payload: Record<string, unknown> = {}) {
  try {
    await db.insert(jarvisActions).values({ id: randomUUID(), userId, tool: toolName, summary, payload })
  } catch (e) {
    console.error("[jarvis] audit log failed:", e)
  }
}

// --- Lessons (self-improvement memory) ----------------------------------------

export async function getActiveLessons(userId: string): Promise<{ id: string; category: string; lesson: string }[]> {
  const rows = await db
    .select({ id: jarvisLessons.id, category: jarvisLessons.category, lesson: jarvisLessons.lesson })
    .from(jarvisLessons)
    .where(and(eq(jarvisLessons.userId, userId), eq(jarvisLessons.active, true)))
    .orderBy(desc(jarvisLessons.createdAt))
    .limit(30)
  return rows
}

// --- The tool set ---------------------------------------------------------------

export function orchestratorTools(userId: string) {
  return {
    get_system_status: tool({
      description:
        "Live snapshot of the whole operator OS: counts per subsystem, recent agent runs, current configs, agent instruction overrides, model routing, and recent Jarvis actions. Call this before advising on or changing anything system-level.",
      inputSchema: z.object({}),
      execute: async () => {
        const countsResult = await pool.query(
          `SELECT
            (SELECT count(*) FROM jobs WHERE "userId" = $1) AS jobs,
            (SELECT count(*) FROM leads WHERE "userId" = $1) AS funnel_leads,
            (SELECT count(*) FROM leadgen_prospects WHERE "userId" = $1) AS prospects,
            (SELECT count(*) FROM leadgen_prospects WHERE "userId" = $1 AND status = 'qualified') AS prospects_qualified,
            (SELECT count(*) FROM autopays WHERE "userId" = $1 AND status = 'active') AS active_autopays,
            (SELECT count(*) FROM video_projects WHERE "userId" = $1) AS video_projects`,
          [userId],
        )
        const counts = countsResult.rows[0]
        const recentRuns = await db
          .select({
            source: leadgenRuns.source,
            trigger: leadgenRuns.trigger,
            found: leadgenRuns.prospectsFound,
            qualified: leadgenRuns.prospectsQualified,
            status: leadgenRuns.status,
            at: leadgenRuns.createdAt,
          })
          .from(leadgenRuns)
          .where(eq(leadgenRuns.userId, userId))
          .orderBy(desc(leadgenRuns.createdAt))
          .limit(3)
        const recentActions = await db
          .select({ tool: jarvisActions.tool, summary: jarvisActions.summary, at: jarvisActions.createdAt })
          .from(jarvisActions)
          .where(eq(jarvisActions.userId, userId))
          .orderBy(desc(jarvisActions.createdAt))
          .limit(5)
        const overrides = await getConfig<AgentOverrides>(userId, "agent_overrides", {})
        const leadgenCfg = await getConfig(userId, "leadgen", LEADGEN_DEFAULTS)
        const storedKeys = await db
          .select({ provider: apiKeys.provider, lastFour: apiKeys.lastFour })
          .from(apiKeys)
          .where(eq(apiKeys.userId, userId))
        return {
          counts,
          leadgen: { enabled: leadgenCfg.enabled, threshold: leadgenCfg.qualifyThreshold, autoPromote: leadgenCfg.autoPromote },
          agentOverridesSet: Object.keys(overrides),
          storedApiKeys: storedKeys,
          modelRouting: { ...describeLlm(), taskCount: Object.keys(TASK_TIERS).length },
          recentLeadgenRuns: recentRuns,
          recentJarvisActions: recentActions,
          crons: [
            "career-scanner every 4h",
            "autopay-reminder daily 8:00 IST",
            "leadgen-agent daily 4:00 UTC (if enabled)",
            "generation/upload/render pollers every 2min",
            "analytics-poller every 6h",
          ],
        }
      },
    }),

    get_settings: tool({
      description: `Read a configuration blob. Available keys: ${Object.entries(CONFIG_REGISTRY)
        .map(([k, v]) => `"${k}" (${v.description})`)
        .join("; ")}; plus "agent_overrides" (per-agent operator directives).`,
      inputSchema: z.object({ key: z.enum([...(Object.keys(CONFIG_REGISTRY) as [string, ...string[]]), "agent_overrides"]) }),
      execute: async ({ key }) => {
        if (key === "agent_overrides") {
          const overrides = await getConfig<AgentOverrides>(userId, "agent_overrides", {})
          return { key, value: overrides, availableAgents: AGENT_KEYS }
        }
        const entry = CONFIG_REGISTRY[key]
        const value = await getConfig(userId, key, entry.defaults)
        return { key, value, editableFields: Object.keys(entry.defaults) }
      },
    }),

    update_settings: tool({
      description:
        'Update fields in a configuration blob (shallow merge — only pass fields to change). E.g. {"key":"leadgen","patchJson":"{\\"qualifyThreshold\\":75,\\"enabled\\":true}"} raises the lead-gen threshold and enables the daily cron. Unknown fields are rejected.',
      inputSchema: z.object({
        key: z.enum(Object.keys(CONFIG_REGISTRY) as [string, ...string[]]),
        patchJson: z.string().describe("JSON object with ONLY the fields to change"),
      }),
      execute: async ({ key, patchJson }) => {
        const entry = CONFIG_REGISTRY[key]
        let patch: Record<string, unknown>
        try {
          patch = JSON.parse(patchJson)
        } catch {
          return { error: "patchJson is not valid JSON" }
        }
        const allowed = Object.keys(entry.defaults)
        const unknown = Object.keys(patch).filter((k) => !allowed.includes(k))
        if (unknown.length > 0) return { error: `Unknown fields: ${unknown.join(", ")}. Allowed: ${allowed.join(", ")}` }
        const current = await getConfig(userId, key, entry.defaults)
        const merged = { ...current, ...patch } as Record<string, unknown>
        await upsertConfig(userId, key, merged)
        await logAction(userId, "update_settings", `Updated ${key}: ${Object.keys(patch).join(", ")}`, { key, patch })
        return { updated: key, changedFields: Object.keys(patch), newValue: merged }
      },
    }),

    set_agent_instructions: tool({
      description: `Set (or clear with empty string) a standing operator directive for one of the OS agents. This PERMANENTLY changes how that agent behaves from now on. Agents: ${Object.entries(AGENT_KEYS)
        .map(([k, v]) => `${k} — ${v}`)
        .join("; ")}.`,
      inputSchema: z.object({
        agent: z.enum(Object.keys(AGENT_KEYS) as [AgentKey, ...AgentKey[]]),
        directive: z.string().describe("The standing instruction, e.g. 'Shorter posts, max 120 words, always end with a question.' Empty string clears."),
      }),
      execute: async ({ agent, directive }) => {
        const overrides = await getConfig<AgentOverrides>(userId, "agent_overrides", {})
        const next = { ...overrides }
        if (directive.trim()) next[agent] = directive.trim().slice(0, 2000)
        else delete next[agent]
        await upsertConfig(userId, "agent_overrides", next as Record<string, unknown>)
        await logAction(userId, "set_agent_instructions", `${directive.trim() ? "Set" : "Cleared"} directive for ${agent}`, {
          agent,
          directive: directive.slice(0, 500),
        })
        return { agent, directive: next[agent] ?? "(cleared)", note: "Takes effect on the agent's next run." }
      },
    }),

    store_api_key: tool({
      description: `Store an API key/token in the encrypted vault (AES at rest; overrides env vars). Providers: ${Object.entries(KEY_PROVIDERS)
        .map(([k, v]) => `${k} (${v.purpose})`)
        .join("; ")}. Confirm the provider back to the user; NEVER repeat the key itself.`,
      inputSchema: z.object({
        provider: z.enum(Object.keys(KEY_PROVIDERS) as [string, ...string[]]),
        key: z.string().min(8).describe("The raw API key or token the user provided"),
      }),
      execute: async ({ provider, key }) => {
        if (!isCryptoConfigured()) return { error: "ENCRYPTION_KEY is not set — cannot store keys securely. Add it in env vars first." }
        const trimmed = key.trim()
        const encryptedKey = encrypt(trimmed)
        const lastFour = trimmed.slice(-4)
        const existing = await db
          .select()
          .from(apiKeys)
          .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
          .limit(1)
        if (existing.length > 0) {
          await db
            .update(apiKeys)
            .set({ encryptedKey, lastFour, label: "via Jarvis", updatedAt: new Date() })
            .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
        } else {
          await db.insert(apiKeys).values({ id: randomUUID(), userId, provider, label: "via Jarvis", encryptedKey, lastFour })
        }
        await logAction(userId, "store_api_key", `Stored ${provider} key ending ...${lastFour}`, { provider, lastFour })
        return { stored: provider, lastFour, note: "Key encrypted and stored. It takes effect immediately (DB key overrides env var)." }
      },
    }),

    trigger_workflow: tool({
      description:
        "Trigger an OS workflow right now. Workflows: leadgen_discovery (run the lead-gen agent: discover + AI-qualify prospects per current config), career_scan (zero-token ATS scan of tracked companies for new matching roles), jobhunt_source (Node 1 Sourcer: crawl the configured career pages/job boards for matching roles and stage them into the Career pipeline).",
      inputSchema: z.object({
        workflow: z.enum(["leadgen_discovery", "career_scan", "jobhunt_source", "jobhunt_cycle"]),
      }),
      execute: async ({ workflow }) => {
        try {
          if (workflow === "leadgen_discovery") {
            const { runLeadgenAgent } = await import("@/lib/leadgen")
            const result = await runLeadgenAgent(userId, "manual")
            await logAction(userId, "trigger_workflow", `Ran leadgen_discovery: ${result.message}`, { workflow, ...result })
            return { workflow, ...result }
          }
          if (workflow === "jobhunt_source") {
            const { runSourcer } = await import("@/lib/jobhunt/sourcer")
            const result = await runSourcer(userId, "jarvis")
            await logAction(userId, "trigger_workflow", `Ran jobhunt_source: ${result.staged} staged`, { workflow, ...result })
            return { workflow, ...result }
          }
          if (workflow === "jobhunt_cycle") {
            const { runJobHuntCycle } = await import("@/lib/jobhunt/orchestrator")
            const result = await runJobHuntCycle(userId, "jarvis")
            await logAction(userId, "trigger_workflow", `Ran jobhunt_cycle: ${result.processed} processed`, { workflow, processed: result.processed })
            return { workflow, ...result }
          }
          const { runZeroTokenScan } = await import("@/lib/career/scanner")
          const result = await runZeroTokenScan(userId)
          await logAction(userId, "trigger_workflow", `Ran career_scan`, { workflow, result })
          return { workflow, result }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "workflow failed"
          await logAction(userId, "trigger_workflow", `FAILED ${workflow}: ${msg}`, { workflow, error: msg })
          return { error: msg }
        }
      },
    }),

    save_lesson: tool({
      description:
        "Save a permanent lesson to your own memory. Use when the operator corrects you, states a lasting preference, or when a workflow fails and you learn why. Lessons are injected into your system prompt in every future conversation — this is how you self-improve.",
      inputSchema: z.object({
        category: z.enum(["general", "linkedin", "youtube", "leadgen", "career", "money"]),
        lesson: z.string().min(10).max(500).describe("Concise, actionable lesson, e.g. 'Operator prefers comp figures in INR lakhs, never USD.'"),
        source: z.enum(["user_feedback", "self_reflection"]),
      }),
      execute: async ({ category, lesson, source }) => {
        await db.insert(jarvisLessons).values({ id: randomUUID(), userId, category, lesson, source })
        await logAction(userId, "save_lesson", `Learned (${category}): ${lesson.slice(0, 120)}`, { category, source })
        return { saved: true, lesson }
      },
    }),

    forget_lesson: tool({
      description: "Deactivate a saved lesson by ID (lesson IDs are shown in your system prompt). Use when the operator says a remembered preference no longer applies.",
      inputSchema: z.object({ lessonId: z.string() }),
      execute: async ({ lessonId }) => {
        await db
          .update(jarvisLessons)
          .set({ active: false })
          .where(and(eq(jarvisLessons.id, lessonId), eq(jarvisLessons.userId, userId)))
        await logAction(userId, "forget_lesson", `Forgot lesson ${lessonId}`, { lessonId })
        return { forgotten: lessonId }
      },
    }),

    // --- Arsenal: skills ------------------------------------------------------

    list_skills: tool({
      description:
        "List the operator's installed skills (Arsenal capability modules injected into agent prompts). Shows name, description, target agents, active flag. Use before adding/assigning skills.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: skills.id,
            name: skills.name,
            description: skills.description,
            targetAgents: skills.targetAgents,
            active: skills.active,
            source: skills.source,
          })
          .from(skills)
          .where(eq(skills.userId, userId))
          .orderBy(desc(skills.updatedAt))
          .limit(50)
        return { skills: rows, availableAgents: Object.keys(AGENT_KEYS) }
      },
    }),

    add_skill: tool({
      description:
        "Install a new skill into the Arsenal — a block of prompt-level expertise (rules, method, templates) that gets injected into the targeted agents' system prompts on every future run. Use when the operator teaches you a technique worth making permanent, or when you extract a capability from an analyzed automation.",
      inputSchema: z.object({
        name: z.string().min(3).max(120),
        description: z.string().max(300),
        content: z.string().min(40).max(20000).describe("The skill body: concrete rules/method, not vague advice"),
        targetAgents: z
          .string()
          .describe(`Comma-separated agent keys from: ${Object.keys(AGENT_KEYS).join(", ")}. Empty = library-only.`),
      }),
      execute: async ({ name, description, content, targetAgents }) => {
        const { upsertSkill, isAgentKey } = await import("@/lib/skills")
        const cleanTargets = targetAgents
          .split(",")
          .map((a) => a.trim())
          .filter(isAgentKey)
          .join(",")
        const { id, created } = await upsertSkill(
          userId,
          { name, description, content, tags: "jarvis", targetAgents: cleanTargets },
          "jarvis",
        )
        await logAction(userId, "add_skill", `${created ? "Installed" : "Updated"} skill "${name}" → [${cleanTargets || "library"}]`, {
          skillId: id,
          targetAgents: cleanTargets,
        })
        return { skillId: id, created, targetAgents: cleanTargets, note: "Takes effect on the targeted agents' next run." }
      },
    }),

    assign_skill: tool({
      description:
        "Retarget or toggle an existing skill: change which agents it injects into, or activate/deactivate it. Get IDs from list_skills.",
      inputSchema: z.object({
        skillId: z.string(),
        targetAgents: z.string().optional().describe(`Comma-separated agent keys (${Object.keys(AGENT_KEYS).join(", ")}); omit to keep current`),
        active: z.boolean().optional(),
      }),
      execute: async ({ skillId, targetAgents, active }) => {
        const { isAgentKey } = await import("@/lib/skills")
        const patch: Record<string, unknown> = { updatedAt: new Date() }
        if (targetAgents !== undefined) {
          patch.targetAgents = targetAgents
            .split(",")
            .map((a) => a.trim())
            .filter(isAgentKey)
            .join(",")
        }
        if (active !== undefined) patch.active = active
        await db.update(skills).set(patch).where(and(eq(skills.id, skillId), eq(skills.userId, userId)))
        await logAction(userId, "assign_skill", `Updated skill ${skillId}`, { skillId, targetAgents, active })
        return { updated: skillId, ...patch }
      },
    }),

    // --- Arsenal: automations -------------------------------------------------

    list_automations: tool({
      description:
        "List imported automations (n8n workflows) with their status and analysis summary. Use before running or analyzing one.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: automations.id,
            name: automations.name,
            description: automations.description,
            status: automations.status,
            analysis: automations.analysis,
          })
          .from(automations)
          .where(eq(automations.userId, userId))
          .orderBy(desc(automations.updatedAt))
          .limit(30)
        const { isN8nConfigured } = await import("@/lib/n8n")
        return {
          automations: rows.map((r) => ({
            ...r,
            analysis: (r.analysis as { summary?: string })?.summary ?? "(not analyzed yet)",
          })),
          n8nConfigured: await isN8nConfigured(userId),
        }
      },
    }),

    analyze_automation: tool({
      description:
        "Deep-analyze an imported automation: what it does end-to-end, whether it's worth running whole, and which parts are absorbable into our agents as skills. Run this before recommending anything about an automation.",
      inputSchema: z.object({ automationId: z.string() }),
      execute: async ({ automationId }) => {
        const { analyzeAutomation } = await import("@/app/actions/arsenal")
        const result = await analyzeAutomation(automationId)
        await logAction(userId, "analyze_automation", `Analyzed automation ${automationId}`, { automationId, ok: result.ok })
        return result
      },
    }),

    run_automation: tool({
      description:
        "Run an imported automation on the operator's connected n8n instance (deploys it there first if needed). Only invoke when the operator asks for it OR when the automation's analysis clearly shows running it would serve the operator's current request — say so when you do.",
      inputSchema: z.object({ automationId: z.string() }),
      execute: async ({ automationId }) => {
        const { runAutomationAction } = await import("@/app/actions/arsenal")
        const result = await runAutomationAction(automationId, "jarvis")
        await logAction(userId, "run_automation", `Ran automation ${automationId}: ${result.ok ? "ok" : result.error}`, {
          automationId,
          ok: result.ok,
        })
        return result
      },
    }),

    // --- Browser automation (agent-browser in Vercel Sandbox) -----------------

    browse_page: tool({
      description:
        "Open a URL in a real sandboxed browser (agent-browser) and return the page title, readable text, and an accessibility snapshot of interactive elements. READ-ONLY — no clicking, typing, or form submission. Use for pages that need JS rendering (job portals, SPAs) when plain fetch isn't enough. Slow (~20-40s cold start) — use sparingly, one call per page.",
      inputSchema: z.object({
        url: z.string().url().describe("Full URL including https://"),
      }),
      execute: async ({ url }) => {
        try {
          const { browsePage, isAgentBrowserAvailable } = await import("@/lib/browser-automation")
          if (!isAgentBrowserAvailable()) {
            return {
              error:
                "Browser sandbox not available in this environment. On Vercel deployments it activates automatically; locally it needs VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID.",
            }
          }
          const page = await browsePage(url)
          await logAction(userId, "browse_page", `Browsed ${url} — "${page.title}"`, { url })
          return { title: page.title, finalUrl: page.url, pageText: page.pageText.slice(0, 10000), interactiveElements: page.snapshot.slice(0, 4000) }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "browse failed"
          await logAction(userId, "browse_page", `FAILED ${url}: ${msg.slice(0, 200)}`, { url, error: msg.slice(0, 300) })
          return { error: msg }
        }
      },
    }),

    // --- Agent graph (shared with the Agent Playground — one source of truth) --

    graph_overview: tool({
      description:
        "Read the live agent graph shown in the Agent Playground: every agent's unique name, machine key, role, tier, group, orchestrator flag, paused state, and current health status (green/yellow/red). Use before rewiring, pausing, or renaming agents. Changes you make with the other graph tools appear in the Playground automatically.",
      inputSchema: z.object({}),
      execute: async () => {
        // Read the same overlay + status the Playground renders (userId-explicit).
        const { getOverlay, mergeGraph } = await import("@/lib/agent-graph")
        const { getStatusSources, blockedReasons, agentStatus } = await import("@/lib/agent-status")
        const [overlay, sources] = await Promise.all([getOverlay(userId), getStatusSources(userId)])
        const graph = mergeGraph(overlay)
        const blocked = blockedReasons()
        return {
          agents: graph.agents.map((a) => ({
            key: a.key,
            name: a.displayName,
            role: a.role,
            tier: a.tier,
            group: a.group,
            orchestrator: Boolean(a.isOrchestrator),
            paused: a.paused,
            autonomy: a.autonomy,
            status: a.paused ? "idle (paused)" : agentStatus(a, sources, blocked).status,
          })),
          handoffs: graph.edges.map((e) => `${e.source} → ${e.target} (${e.kind})`),
        }
      },
    }),

    set_agent_paused: tool({
      description:
        "Pause or resume an agent by its machine key (from graph_overview). Paused agents are excluded from orchestration at dispatch time and dim in the Playground. Load-bearing agents cannot be paused.",
      inputSchema: z.object({
        agentKey: z.string(),
        paused: z.boolean(),
      }),
      execute: async ({ agentKey, paused }) => {
        if (!AGENT_BY_KEY[agentKey] && !agentKey.startsWith("custom.")) return { error: `Unknown agent key: ${agentKey}` }
        const r = await setAgentPaused(userId, agentKey, paused)
        await logAction(userId, "set_agent_paused", `${paused ? "Paused" : "Resumed"} ${agentKey}`, { agentKey, paused, ok: r.ok })
        return r
      },
    }),

    rewire_agents: tool({
      description:
        "Add a directional handoff edge between two agents (source → target) in the shared agent graph. Use to route one agent's output into another — e.g. split a chain by pointing a script agent at a different prompt-building agent. Reflects immediately in the Playground.",
      inputSchema: z.object({
        source: z.string().describe("source agent key"),
        target: z.string().describe("target agent key"),
        label: z.string().optional(),
      }),
      execute: async ({ source, target, label }) => {
        const r = await addEdge(userId, source, target, label)
        await logAction(userId, "rewire_agents", `Wired ${source} → ${target}`, { source, target, ok: r.ok })
        return r
      },
    }),

    unwire_agents: tool({
      description: "Remove a handoff edge by its id (edge ids come from graph_overview handoffs / the Playground).",
      inputSchema: z.object({ edgeId: z.string() }),
      execute: async ({ edgeId }) => {
        const r = await deleteEdge(userId, edgeId)
        await logAction(userId, "unwire_agents", `Removed edge ${edgeId}`, { edgeId })
        return r
      },
    }),

    rename_agent: tool({
      description: "Give an agent a new unique display name in the shared graph (cosmetic identity, machine key unchanged).",
      inputSchema: z.object({ agentKey: z.string(), name: z.string().min(1).max(40) }),
      execute: async ({ agentKey, name }) => {
        const r = await renameAgent(userId, agentKey, name)
        await logAction(userId, "rename_agent", `Renamed ${agentKey} → "${name}"`, { agentKey, name })
        return r
      },
    }),

    set_agent_autonomy: tool({
      description:
        "Set an agent's autonomy level in the shared graph: 'review' (human approves its consequential actions — the safe default) or 'auto' (the agent acts on its own — graduated autopilot). Use as the operator grows to trust an agent. Consequential agent actions consult this at dispatch time. Reflects in the Playground immediately.",
      inputSchema: z.object({
        agentKey: z.string(),
        level: z.enum(["review", "auto"]),
      }),
      execute: async ({ agentKey, level }) => {
        if (!AGENT_BY_KEY[agentKey] && !agentKey.startsWith("custom.") && !agentKey.startsWith("jobhunt.")) {
          return { error: `Unknown agent key: ${agentKey}` }
        }
        const r = await setAgentAutonomy(userId, agentKey, level)
        await logAction(userId, "set_agent_autonomy", `Set ${agentKey} autonomy → ${level}`, { agentKey, level })
        return r
      },
    }),
  }
}
