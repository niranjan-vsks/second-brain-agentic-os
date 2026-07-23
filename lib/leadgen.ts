// Lead-Gen Agent — Freelance Funnel automation.
//
// Pipeline: DISCOVER -> QUALIFY -> (optionally) PROMOTE
//   1. DISCOVER: find candidate businesses via Google Maps Places API (if key)
//      or SERP search (Serper/Tavily fallback). Two source modes:
//        - maps_no_website: businesses with no/weak web presence
//        - ai_upgrade: businesses whose workflows suggest AI automation need
//   2. QUALIFY: an LLM scores each prospect 0-100 against the owner's ICP and
//      writes a pitch angle. standard tier (structured judgment, not deep
//      reasoning). Validation-failure escalates via the tier system.
//   3. PROMOTE: qualified prospects become rows in the existing leads table
//      (channel "leadgen_agent"), feeding the untouched funnel pipeline.
//
// Configurable stub philosophy (same as YouTube pipeline): with no search key,
// discovery returns a clear "configure me" error instead of fake data.

import { generateText } from "ai"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { leadgenProspects, leadgenRuns, leads } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getModelForUser } from "@/lib/llm"
import {
  getSecret,
  getConfig,
  getAgentOverride,
  directiveBlock,
  LEADGEN_DEFAULTS,
  type LeadgenConfig,
} from "@/lib/config"
import { skillsBlockFor } from "@/lib/skills"

export interface DiscoveredBusiness {
  businessName: string
  category: string
  location: string
  phone: string
  website: string
  mapsUrl: string
  signals: string
}

// --- Discovery -----------------------------------------------------------------

async function discoverViaGoogleMaps(
  apiKey: string,
  category: string,
  location: string,
  maxResults: number,
): Promise<DiscoveredBusiness[]> {
  // Places API (New) Text Search — one call, no scraping.
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery: `${category} in ${location}`, maxResultCount: Math.min(maxResults, 20) }),
  })
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as {
    places?: Array<{
      displayName?: { text?: string }
      formattedAddress?: string
      nationalPhoneNumber?: string
      websiteUri?: string
      googleMapsUri?: string
      primaryTypeDisplayName?: { text?: string }
      rating?: number
      userRatingCount?: number
    }>
  }
  return (data.places ?? []).map((p) => ({
    businessName: p.displayName?.text ?? "Unknown",
    category: p.primaryTypeDisplayName?.text ?? category,
    location: p.formattedAddress ?? location,
    phone: p.nationalPhoneNumber ?? "",
    website: p.websiteUri ?? "",
    mapsUrl: p.googleMapsUri ?? "",
    signals: `rating=${p.rating ?? "n/a"} reviews=${p.userRatingCount ?? 0} website=${p.websiteUri ? "yes" : "NO"}`,
  }))
}

async function discoverViaSerper(
  apiKey: string,
  category: string,
  location: string,
  maxResults: number,
): Promise<DiscoveredBusiness[]> {
  const res = await fetch("https://google.serper.dev/places", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: `${category} in ${location}` }),
  })
  if (!res.ok) throw new Error(`Serper ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as {
    places?: Array<{
      title?: string
      address?: string
      category?: string
      phoneNumber?: string
      website?: string
      rating?: number
      ratingCount?: number
      cid?: string
    }>
  }
  return (data.places ?? []).slice(0, maxResults).map((p) => ({
    businessName: p.title ?? "Unknown",
    category: p.category ?? category,
    location: p.address ?? location,
    phone: p.phoneNumber ?? "",
    website: p.website ?? "",
    mapsUrl: p.cid ? `https://maps.google.com/?cid=${p.cid}` : "",
    signals: `rating=${p.rating ?? "n/a"} reviews=${p.ratingCount ?? 0} website=${p.website ? "yes" : "NO"}`,
  }))
}

// --- Qualification --------------------------------------------------------------

const QUALIFIER_PROMPT = `You are a lead qualification agent for a solo AI agency operator in India who builds: AI websites, mobile apps, chatbots, AI agents/agentic workflows, n8n automations, and ad creatives / UGC content.

For each business below, score how good a prospect it is (0-100) for the given source mode:
- maps_no_website: high scores for real businesses with NO website (they need one), decent review counts (proof they're active), and categories where a website/booking/chatbot drives revenue.
- ai_upgrade: high scores for businesses whose category implies manual, repetitive workflows (appointment booking, lead follow-up, catalog inquiries, review management) that AI automation would clearly improve.

Rules:
- Never fabricate facts about a business. Judge only from the provided data.
- Penalize chains/franchises (they have central IT) and businesses that look closed or fake.
- pitchAngle must be ONE concrete sentence naming the specific thing you'd build for them.

Return STRICT JSON array, one object per business, same order:
[{"score": <0-100>, "rationale": "<one sentence>", "pitchAngle": "<one sentence>"}]
Return ONLY the JSON array.`

interface Qualification {
  score: number
  rationale: string
  pitchAngle: string
}

async function qualifyBatch(
  userId: string,
  businesses: DiscoveredBusiness[],
  source: string,
  icpNotes: string,
  operatorDirective = "", // Jarvis-set override for what makes a good/bad prospect
  skillsCtx = "", // Arsenal skills assigned to leadgen_qualify
): Promise<Qualification[]> {
  const prompt = `Source mode: ${source}\n\nOperator ICP notes: ${icpNotes}\n\nBusinesses:\n${JSON.stringify(
    businesses.map((b) => ({
      name: b.businessName,
      category: b.category,
      location: b.location,
      website: b.website || "NONE",
      signals: b.signals,
    })),
    null,
    2,
  )}`

  const parse = (text: string): Qualification[] | null => {
    try {
      const cleaned = text.replace(/```json|```/g, "").trim()
      const arr = JSON.parse(cleaned) as Qualification[]
      if (!Array.isArray(arr) || arr.length !== businesses.length) return null
      return arr.map((q) => ({
        score: Math.max(0, Math.min(100, Math.round(Number(q.score) || 0))),
        rationale: String(q.rationale ?? "").slice(0, 500),
        pitchAngle: String(q.pitchAngle ?? "").slice(0, 500),
      }))
    } catch {
      return null
    }
  }

  const system = QUALIFIER_PROMPT + directiveBlock(operatorDirective) + skillsCtx

  // standard tier with one manual escalation to heavy on parse failure
  const { text } = await generateText({
    model: await getModelForUser(userId, "standard", "leadgen.qualify"), // leadgen.qualify — structured scoring against ICP
    system,
    prompt,
  })
  const first = parse(text)
  if (first) return first

  const { text: retry } = await generateText({
    model: await getModelForUser(userId, "heavy", "leadgen.qualify"), // leadgen.qualify escalation — retry on invalid JSON
    system,
    prompt,
  })
  const second = parse(retry)
  if (second) return second
  throw new Error("Qualifier returned invalid JSON twice")
}

// --- Orchestrator ----------------------------------------------------------------

export async function runLeadgenAgent(
  userId: string,
  trigger: "manual" | "cron",
  overrides?: { category?: string; location?: string; source?: "maps_no_website" | "ai_upgrade" },
): Promise<{ runId: string; found: number; qualified: number; message: string }> {
  const config = await getConfig<LeadgenConfig>(userId, "leadgen", LEADGEN_DEFAULTS)
  if (trigger === "cron" && !config.enabled) {
    return { runId: "", found: 0, qualified: 0, message: "Lead-gen agent disabled in Settings" }
  }
  // Agent Playground pause guard (dispatch-time check, spec §2.5).
  const { isAgentPaused } = await import("@/lib/agent-graph")
  if (await isAgentPaused(userId, "leadgen.qualify")) {
    return { runId: "", found: 0, qualified: 0, message: "Prospector is paused in the Agent Playground — resume it to run." }
  }

  const source =
    overrides?.source ?? (config.sources.maps_no_website ? "maps_no_website" : "ai_upgrade")
  const categories = (overrides?.category ? [overrides.category] : config.categories.split(",")).map((c) => c.trim()).filter(Boolean)
  const locations = (overrides?.location ? [overrides.location] : config.locations.split(",")).map((l) => l.trim()).filter(Boolean)
  if (categories.length === 0 || locations.length === 0) {
    throw new Error("Configure at least one category and location in Settings → Agents")
  }

  // Rotate deterministically so cron runs cover the config space over time
  const dayIndex = Math.floor(Date.now() / 86400000)
  const category = categories[dayIndex % categories.length]
  const location = locations[dayIndex % locations.length]
  const query = `${category} in ${location} (${source})`

  const runId = randomUUID()
  await db.insert(leadgenRuns).values({ id: runId, userId, trigger, source, query, status: "running" })

  try {
    // Discovery: Maps key preferred, Serper fallback
    const mapsKey = await getSecret(userId, "google_maps")
    const serperKey = await getSecret(userId, "serper")
    let discovered: DiscoveredBusiness[]
    if (mapsKey) {
      discovered = await discoverViaGoogleMaps(mapsKey, category, location, config.maxPerRun)
    } else if (serperKey) {
      discovered = await discoverViaSerper(serperKey, category, location, config.maxPerRun)
    } else {
      throw new Error(
        "No discovery provider configured. Add a Google Maps Places or Serper API key in Settings → API Keys.",
      )
    }

    // maps_no_website mode: keep only businesses without a website
    const candidates =
      source === "maps_no_website" ? discovered.filter((b) => !b.website) : discovered

    // Dedupe against existing prospects
    const existing = await db
      .select({ name: leadgenProspects.businessName })
      .from(leadgenProspects)
      .where(eq(leadgenProspects.userId, userId))
    const known = new Set(existing.map((e) => e.name.toLowerCase()))
    const fresh = candidates.filter((b) => !known.has(b.businessName.toLowerCase())).slice(0, config.maxPerRun)

    if (fresh.length === 0) {
      await db
        .update(leadgenRuns)
        .set({ status: "completed", prospectsFound: 0, prospectsQualified: 0 })
        .where(eq(leadgenRuns.id, runId))
      return { runId, found: 0, qualified: 0, message: `No new prospects for "${query}" — all known or filtered` }
    }

    // Qualification (with any Jarvis-set operator directive)
    const qualifyDirective = await getAgentOverride(userId, "leadgen_qualify")
    const qualifySkills = await skillsBlockFor(userId, "leadgen_qualify") // Arsenal skills
    const quals = await qualifyBatch(userId, fresh, source, config.icpNotes, qualifyDirective, qualifySkills)
    let qualified = 0

    for (let i = 0; i < fresh.length; i++) {
      const b = fresh[i]
      const q = quals[i]
      const isQualified = q.score >= config.qualifyThreshold
      if (isQualified) qualified++
      const prospectId = randomUUID()
      await db.insert(leadgenProspects).values({
        id: prospectId,
        userId,
        source,
        businessName: b.businessName,
        category: b.category,
        location: b.location,
        phone: b.phone,
        website: b.website,
        mapsUrl: b.mapsUrl,
        signals: b.signals,
        aiScore: q.score,
        aiRationale: q.rationale,
        pitchAngle: q.pitchAngle,
        status: isQualified ? "qualified" : "discovered",
      })
      // Auto-promotion into the funnel (opt-in)
      if (isQualified && config.autoPromote) {
        await promoteProspectToLead(userId, prospectId)
      }
    }

    await db
      .update(leadgenRuns)
      .set({ status: "completed", prospectsFound: fresh.length, prospectsQualified: qualified })
      .where(eq(leadgenRuns.id, runId))
    return {
      runId,
      found: fresh.length,
      qualified,
      message: `"${query}": ${fresh.length} new prospects, ${qualified} qualified (threshold ${config.qualifyThreshold})`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error"
    await db.update(leadgenRuns).set({ status: "failed", errorMessage: msg }).where(eq(leadgenRuns.id, runId))
    throw e
  }
}

/** Promote a prospect into the existing leads funnel (additive integration point). */
export async function promoteProspectToLead(userId: string, prospectId: string): Promise<number> {
  const rows = await db
    .select()
    .from(leadgenProspects)
    .where(and(eq(leadgenProspects.userId, userId), eq(leadgenProspects.id, prospectId)))
    .limit(1)
  if (rows.length === 0) throw new Error("Prospect not found")
  const p = rows[0]
  if (p.status === "promoted" && p.promotedLeadId) return p.promotedLeadId

  const inserted = await db
    .insert(leads)
    .values({
      userId,
      name: p.businessName,
      company: p.category,
      channel: "leadgen_agent",
      status: "new",
      notes: [
        `[Lead-Gen Agent] score=${p.aiScore ?? "?"}/100 (${p.source})`,
        p.pitchAngle ? `Pitch: ${p.pitchAngle}` : "",
        p.aiRationale ? `Why: ${p.aiRationale}` : "",
        p.phone ? `Phone: ${p.phone}` : "",
        p.location ? `Location: ${p.location}` : "",
        p.mapsUrl ? `Maps: ${p.mapsUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    })
    .returning({ id: leads.id })

  const leadId = inserted[0].id
  await db
    .update(leadgenProspects)
    .set({ status: "promoted", promotedLeadId: leadId, updatedAt: new Date() })
    .where(and(eq(leadgenProspects.userId, userId), eq(leadgenProspects.id, prospectId)))
  return leadId
}
