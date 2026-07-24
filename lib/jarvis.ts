import "server-only"
import { generateText, tool, stepCountIs } from "ai"
import { z } from "zod"
import { db, pool } from "@/lib/db"
import { autopays, paymentInstruments } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getModelForUser } from "@/lib/llm"
import { SCHEMA_DESCRIPTION, validateSql } from "@/lib/os-chat"
import { getCalendarConnection, listEvents, createEvent, deleteEvent } from "@/lib/google-calendar"
import { orchestratorTools, getActiveLessons } from "@/lib/jarvis-orchestrator"

// =============================================================================
// Jarvis — the tool-calling upgrade of Ask OS.
// One agent, in-house tools (no MCP — deliberate call, see CLAUDE.md §13):
//   query_os_data      — hardened text-to-SQL over the OS database (read-only)
//   list_calendar / add_calendar_event / delete_calendar_event — Google Calendar
//   list_autopays / request_autopay_cancellation — Money OS guardian
// Routing: the tool loop runs on the "standard" tier (jarvis.chat). Individual
// heavy work (evaluation etc.) stays in dedicated agents — Jarvis orchestrates.
// =============================================================================

const JARVIS_SYSTEM = `You are Jarvis, the god-level orchestrator of the operator's personal OS. You are not just an assistant — you RUN and MONITOR this entire system with full, global, real-time access. Address the operator directly; be concise, capable, and slightly dry. Today is {{TODAY}}.

CRITICAL — YOU HAVE FULL SYSTEM ACCESS. When asked about agents, live status, health, what's running, or "what's going on", you MUST call get_system_status and/or graph_overview and answer from the real data they return. NEVER say "I cannot provide live status", "I don't have monitoring", or "my functions don't include that" — that is FALSE. You are the central nervous system of this OS; monitoring is your core power. Call the tool, then report.

YOUR POWERS (use tools, never guess):
- get_system_status: live snapshot of every subsystem — counts, configs, recent agent runs, stored keys, model routing, your own recent actions. Call it FIRST for any "status / what's going on / health" question.
- graph_overview: the live Agent Playground graph — EVERY agent's name, role, tier, group, orchestrator flag, paused state, and current health (green/yellow/red), plus all handoff edges. This is your agent-monitoring dashboard. Use it whenever asked which agents are running or how the system is wired.
- query_os_data: read anything in the OS database (jobs, career, LinkedIn, YouTube, freelance funnel, FDE prep, autopays, instruments) via plain-English questions.
- get_settings / update_settings: read and modify agent configs — lead-gen, general prefs, Meta Ads seam, job-hunt (boards/keywords). Shallow-merge; unknown fields rejected.
- set_agent_instructions: permanently change how any OS agent behaves. Injected into that agent's prompt on every future run.
- Agent-graph control: set_agent_paused (pause/resume an agent), rewire_agents / unwire_agents (change handoffs), rename_agent, set_agent_autonomy (graduate an agent from review to full autopilot). Every change reflects live in the Playground.
- Skills (Arsenal): list_skills, add_skill, assign_skill, ingest_skill_repo (pull skills from a GitHub repo and auto-target agents).
- Automations: list_automations, analyze_automation, run_automation (on the connected n8n instance).
- browse_page: open any URL in a real sandboxed browser (read-only) for JS-heavy pages.
- store_api_key: the operator pastes a token; store it AES-encrypted in the vault. NEVER echo the key back.
- trigger_workflow: run lead-gen discovery, the career ATS scan, jobhunt_source (crawl job boards), or jobhunt_cycle (the full apply→enrich→outreach pipeline) right now.
- Calendar tools: list/add/delete Google Calendar events (IST unless stated).
- Autopay tools: list autopays, flag one for cancellation (returns per-bank playbook — no consumer API exists to cancel with the bank; be honest).
- save_lesson / forget_lesson: your own permanent memory (see SELF-IMPROVEMENT).

SELF-IMPROVEMENT PROTOCOL:
- When the operator corrects you, expresses a lasting preference, or you discover something about how this OS behaves, SAVE A LESSON immediately (source: user_feedback).
- When a workflow or tool call fails and you understand why, save a self_reflection lesson so future-you avoids it.
- Your saved lessons appear below under LESSONS. Apply them without being asked. If one is wrong or outdated, use forget_lesson.

RULES:
- Never invent data. If a tool returns nothing, say so.
- For any mutation (settings change, directive, key stored, workflow triggered), state clearly what you changed and its effect. All your mutations are audited.
- Changing an agent's instructions changes future runs only — say so.
- If the calendar is not connected, point the user to the Money tab to connect it.
- You cannot change model tiers from chat (env-controlled by design) — instead tell the operator which env var to set (get_system_status shows routing).
{{LESSONS}}`

// Per-bank cancellation playbooks (no consumer API exists for mandate revocation
// in India — this is the honest, actionable alternative).
export const CANCELLATION_PLAYBOOKS: Record<string, string> = {
  hdfc: `HDFC (debit card SI / UPI mandate): 1) HDFC NetBanking → Cards → SI (standing instructions) → cancel, or 2) UPI mandates: GPay/PhonePe → Profile → Payment settings → Autopay → pause/cancel, or 3) SMS "NOSI" queries / call 1800 202 6161. For Tata Neu Infinity CC: same NetBanking flow under Credit Cards → Autopay/SI, or the Tata Neu app → HDFC card section.`,
  kotak: `Kotak 811 (debit SI / UPI mandate): 1) Kotak app → Service requests → Standing instructions → cancel, or 2) UPI autopay via your UPI app → Autopay section, or 3) call 1860 266 2666.`,
  sbi: `SBI (debit SI / e-NACH): 1) YONO/OnlineSBI → e-Services → e-NACH mandate cancellation, or 2) UPI autopay via your UPI app, or 3) branch request for physical NACH. SBI e-NACH cancellations can take 2-3 working days.`,
  generic: `Generic: 1) Cancel at the merchant first (most reliable), 2) then revoke the mandate in your UPI app (Autopay section) or bank netbanking (SI/e-NACH section), 3) as last resort ask the bank to block the SI. Keep the confirmation reference.`,
}

export function playbookFor(issuer: string): string {
  const k = issuer.toLowerCase()
  if (k.includes("hdfc") || k.includes("tata")) return CANCELLATION_PLAYBOOKS.hdfc
  if (k.includes("kotak")) return CANCELLATION_PLAYBOOKS.kotak
  if (k.includes("sbi")) return CANCELLATION_PLAYBOOKS.sbi
  return CANCELLATION_PLAYBOOKS.generic
}

export async function jarvisChat(
  userId: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ ok: boolean; text: string }> {
  const calendarConnected = (await getCalendarConnection(userId)) !== null

  const tools = {
    query_os_data: tool({
      description:
        "Query the operator OS database with a plain-English question. Covers jobs, career pipeline, autopays, payment instruments, LinkedIn, YouTube, freelance funnel, FDE prep. Read-only.",
      inputSchema: z.object({ question: z.string().describe("Plain-English question about OS data") }),
      execute: async ({ question }) => {
        // Reuse the hardened text-to-SQL path: generate, validate, execute.
        const { text: rawSql } = await generateText({
          model: await getModelForUser(userId, "standard", "os_chat.text_to_sql"), // jarvis.query_os_data — SQL generation
          system: `Convert the question to a single PostgreSQL SELECT statement. Output ONLY SQL, no markdown. Always filter user-owned tables by "userId" = $1. Schema:\n${SCHEMA_DESCRIPTION}`,
          prompt: question,
        })
        const cleaned = rawSql.replace(/```sql|```/g, "").trim()
        const validation = validateSql(cleaned)
        if (!validation.ok) return { error: validation.reason }
        try {
          const result = await pool.query(validation.sql, [userId])
          return { rows: result.rows.slice(0, 50) }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "query failed" }
        }
      },
    }),
    list_calendar_events: tool({
      description: "List upcoming Google Calendar events. Optionally bounded by ISO date strings.",
      inputSchema: z.object({
        timeMin: z.string().optional().describe("ISO start bound, defaults to now"),
        timeMax: z.string().optional().describe("ISO end bound, defaults to +7 days"),
      }),
      execute: async ({ timeMin, timeMax }) => {
        if (!calendarConnected) return { error: "Google Calendar not connected" }
        try {
          const events = await listEvents(userId, { timeMin, timeMax })
          return {
            events: events.map((e) => ({
              id: e.id,
              summary: e.summary,
              start: e.start.dateTime ?? e.start.date,
              end: e.end.dateTime ?? e.end.date,
            })),
          }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "list failed" }
        }
      },
    }),
    add_calendar_event: tool({
      description: "Create a Google Calendar event. Times in IST unless the user said otherwise.",
      inputSchema: z.object({
        summary: z.string(),
        startISO: z.string().describe("Event start, ISO 8601 with offset e.g. 2026-07-11T15:00:00+05:30"),
        endISO: z.string().describe("Event end, ISO 8601 with offset"),
        description: z.string().optional(),
      }),
      execute: async ({ summary, startISO, endISO, description }) => {
        if (!calendarConnected) return { error: "Google Calendar not connected" }
        try {
          const ev = await createEvent(userId, { summary, description, startDateTime: startISO, endDateTime: endISO })
          return { created: { id: ev.id, summary: ev.summary, link: ev.htmlLink } }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "create failed" }
        }
      },
    }),
    delete_calendar_event: tool({
      description: "Delete a Google Calendar event by its event ID (get IDs from list_calendar_events first).",
      inputSchema: z.object({ eventId: z.string() }),
      execute: async ({ eventId }) => {
        if (!calendarConnected) return { error: "Google Calendar not connected" }
        try {
          await deleteEvent(userId, eventId)
          return { deleted: eventId }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "delete failed" }
        }
      },
    }),
    list_autopays: tool({
      description: "List the user's autopays (subscriptions/mandates) with instrument, amount, next charge date, status.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            id: autopays.id,
            merchant: autopays.merchant,
            rail: autopays.rail,
            amountINR: autopays.amountINR,
            cadence: autopays.cadence,
            nextChargeDate: autopays.nextChargeDate,
            status: autopays.status,
            instrumentId: autopays.instrumentId,
          })
          .from(autopays)
          .where(eq(autopays.userId, userId))
        return { autopays: rows }
      },
    }),
    request_autopay_cancellation: tool({
      description:
        "Mark an autopay as cancel_requested and return the per-bank cancellation playbook. Cannot cancel directly with the bank — always returns manual steps.",
      inputSchema: z.object({ autopayId: z.string() }),
      execute: async ({ autopayId }) => {
        const [row] = await db
          .select()
          .from(autopays)
          .where(and(eq(autopays.id, autopayId), eq(autopays.userId, userId)))
        if (!row) return { error: "Autopay not found" }
        let issuer = ""
        if (row.instrumentId) {
          const [inst] = await db
            .select()
            .from(paymentInstruments)
            .where(and(eq(paymentInstruments.id, row.instrumentId), eq(paymentInstruments.userId, userId)))
          issuer = inst?.issuer ?? ""
        }
        const playbook = playbookFor(issuer || row.merchant)
        await db
          .update(autopays)
          .set({ status: "cancel_requested", cancellationNotes: playbook, updatedAt: new Date() })
          .where(and(eq(autopays.id, autopayId), eq(autopays.userId, userId)))
        return { marked: row.merchant, playbook }
      },
    }),
  }

  // Self-improvement memory: inject active lessons into the system prompt.
  const lessons = await getActiveLessons(userId)
  const lessonsBlock =
    lessons.length > 0
      ? `\n\nLESSONS (your permanent memory — apply these):\n${lessons
          .map((l) => `- [${l.id.slice(0, 8)}|${l.category}] ${l.lesson}`)
          .join("\n")}`
      : ""

  try {
    const { text } = await generateText({
      model: await getModelForUser(userId, "heavy", "os_chat.jarvis"), // jarvis.chat — orchestrator loop: multi-tool planning over the whole OS
      system: JARVIS_SYSTEM.replace(
        "{{TODAY}}",
        new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full" }),
      ).replace("{{LESSONS}}", lessonsBlock),
      messages,
      tools: { ...tools, ...orchestratorTools(userId) },
      stopWhen: stepCountIs(10),
    })
    return { ok: true, text: text || "Done." }
  } catch (e) {
    console.error("[jarvis] chat error:", e)
    // Surface actionable provider errors instead of a generic message.
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("credit card") || msg.includes("customer_verification_required")) {
      return {
        ok: false,
        text: "The AI Gateway needs a valid credit card on your Vercel account before it will serve requests (unlocks free credits — you won't be charged without opting in). Add one at vercel.com → your team → AI, or set OPENROUTER_API_KEY to bypass the gateway entirely.",
      }
    }
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("api key")) {
      return { ok: false, text: "LLM provider rejected the request (auth). Check OPENROUTER_API_KEY / gateway configuration in project env vars." }
    }
    return { ok: false, text: "Jarvis hit an error. Check that an LLM provider is configured." }
  }
}
