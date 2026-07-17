// Central configuration resolution for the Settings Hub.
//
// Two stores:
//   app_config  — per-user JSON config blobs (agent configs, funnel seams, prefs)
//   api_keys    — BYO API keys, AES-encrypted at rest (lib/crypto.ts)
//
// SECRET RESOLUTION ORDER (used by every consumer):
//   1. User's DB key (api_keys row for the provider, decrypted)
//   2. Environment variable fallback
// This lets the owner bring their own keys from the UI without redeploying,
// while env vars remain the gold standard for catastrophic-if-leaked secrets.

import { db } from "@/lib/db"
import { appConfig, apiKeys } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { decrypt, isCryptoConfigured } from "@/lib/crypto"

// Provider registry: id -> env var fallback + display metadata.
// Adding a new provider = one entry here + it appears in the Settings UI.
export const KEY_PROVIDERS: Record<
  string,
  { label: string; envVar: string; docsUrl: string; purpose: string }
> = {
  openrouter: {
    label: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/keys",
    purpose: "BYO LLM provider (GLM, Kimi, etc.) — overrides the AI Gateway",
  },
  tavily: {
    label: "Tavily Search",
    envVar: "TAVILY_API_KEY",
    docsUrl: "https://app.tavily.com",
    purpose: "Web search for career deep-research and lead-gen discovery",
  },
  brave: {
    label: "Brave Search",
    envVar: "BRAVE_API_KEY",
    docsUrl: "https://api.search.brave.com",
    purpose: "Alternative web search provider",
  },
  serper: {
    label: "Serper (Google SERP)",
    envVar: "SERPER_API_KEY",
    docsUrl: "https://serper.dev",
    purpose: "Google search results — used by lead-gen Maps discovery",
  },
  google_maps: {
    label: "Google Maps Places",
    envVar: "GOOGLE_MAPS_API_KEY",
    docsUrl: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
    purpose: "Direct Places API for the Maps lead-gen pipeline (richer than SERP)",
  },
  meta_ads: {
    label: "Meta Ads",
    envVar: "META_ADS_ACCESS_TOKEN",
    docsUrl: "https://developers.facebook.com/tools/explorer",
    purpose: "Meta Ads funnel seam — campaign sync (stub until connected)",
  },
}

/** Resolve a secret: user's stored DB key first, env var fallback. Null if neither. */
export async function getSecret(userId: string, provider: string): Promise<string | null> {
  try {
    if (isCryptoConfigured()) {
      const rows = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
        .limit(1)
      if (rows.length > 0 && rows[0].encryptedKey) {
        const value = decrypt(rows[0].encryptedKey)
        if (value) return value
      }
    }
  } catch {
    // fall through to env
  }
  const envVar = KEY_PROVIDERS[provider]?.envVar
  return (envVar && process.env[envVar]) || null
}

/** Read a JSON config blob for a user. Returns fallback when unset. */
export async function getConfig<T>(userId: string, key: string, fallback: T): Promise<T> {
  const rows = await db
    .select()
    .from(appConfig)
    .where(and(eq(appConfig.userId, userId), eq(appConfig.key, key)))
    .limit(1)
  if (rows.length === 0) return fallback
  return { ...fallback, ...(rows[0].value as object) } as T
}

// --- Typed config shapes (defaults double as documentation) -------------------

export interface LeadgenConfig {
  enabled: boolean
  /** ICP definition fed verbatim to the qualifier agent */
  icpNotes: string
  /** Business categories to hunt, comma-separated */
  categories: string
  /** Target locations, comma-separated */
  locations: string
  /** maps_no_website: businesses without websites; ai_upgrade: businesses needing AI automation */
  sources: { maps_no_website: boolean; ai_upgrade: boolean }
  /** Minimum AI score (0-100) to auto-qualify a prospect */
  qualifyThreshold: number
  /** Max prospects per run (cost guardrail) */
  maxPerRun: number
  /** Auto-promote qualified prospects into the leads funnel */
  autoPromote: boolean
}

export const LEADGEN_DEFAULTS: LeadgenConfig = {
  enabled: false,
  icpNotes:
    "Small businesses in India without a web presence, or SMBs with manual workflows that need AI automation, chatbots, agentic workflows, AI websites/apps, or ad creatives. Deal size ₹50k-₹5L. Decision-maker reachable via phone/WhatsApp.",
  categories: "restaurants, clinics, salons, real estate agents, coaching institutes, boutiques, gyms",
  locations: "Hyderabad, Bengaluru, Chennai",
  sources: { maps_no_website: true, ai_upgrade: true },
  qualifyThreshold: 60,
  maxPerRun: 15,
  autoPromote: false,
}

export interface MetaAdsFunnelConfig {
  enabled: boolean
  adAccountId: string
  pageId: string
  dailyBudgetINR: number
  notes: string
}

export const META_ADS_DEFAULTS: MetaAdsFunnelConfig = {
  enabled: false,
  adAccountId: "",
  pageId: "",
  dailyBudgetINR: 500,
  notes: "",
}

export interface GeneralConfig {
  displayName: string
  timezone: string
  telegramMirror: boolean
  notifyInApp: boolean
}

export const GENERAL_DEFAULTS: GeneralConfig = {
  displayName: "",
  timezone: "Asia/Kolkata",
  telegramMirror: true,
  notifyInApp: true,
}
