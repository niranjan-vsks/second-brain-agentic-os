"use server"

// Settings Hub server actions: JSON config store + encrypted API key vault.
// All queries userId-scoped (Neon has no RLS). Keys are AES-encrypted at rest
// and NEVER returned to the client — only provider + label + last four.

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { appConfig, apiKeys, connectedAccounts, youtubeChannels, secretAccessLog } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { encrypt, isCryptoConfigured } from "@/lib/crypto"
import {
  KEY_PROVIDERS,
  getConfig,
  getRecentSecretAccess,
  LEADGEN_DEFAULTS,
  META_ADS_DEFAULTS,
  GENERAL_DEFAULTS,
  CONNECTIONS_DEFAULTS,
  LLM_BRAIN_DEFAULTS,
  ROUTING_GROUPS,
  type LlmBrainConfig,
} from "@/lib/config"
import { describeLlm, describeLlmForUser } from "@/lib/llm"
import { TASK_TIERS } from "@/lib/model-router"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user.id
}

// --- Config blobs --------------------------------------------------------------

export async function saveConfigAction(key: string, value: Record<string, unknown>) {
  const userId = await getUserId()
  const allowed = new Set(["leadgen", "funnels.meta_ads", "general", "connections", "jobhunt", "llm_brain"])
  if (!allowed.has(key)) throw new Error("Unknown config key")
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
  revalidatePath("/")
  return { ok: true }
}

export async function getSettingsSnapshot() {
  const userId = await getUserId()

  const [leadgen, metaAds, general, connectionsForm, brainConfig, brainDesc, keyRows, calRows, ytRows, recentSecretAccess] =
    await Promise.all([
      getConfig(userId, "leadgen", LEADGEN_DEFAULTS),
      getConfig(userId, "funnels.meta_ads", META_ADS_DEFAULTS),
      getConfig(userId, "general", GENERAL_DEFAULTS),
      getConfig(userId, "connections", CONNECTIONS_DEFAULTS),
      getConfig(userId, "llm_brain", LLM_BRAIN_DEFAULTS),
      describeLlmForUser(userId).catch(() => ({ provider: "unknown", models: { light: "", standard: "", heavy: "" }, configured: false, keySource: "error reading brain" })),
      db.select().from(apiKeys).where(eq(apiKeys.userId, userId)),
      db.select().from(connectedAccounts).where(eq(connectedAccounts.userId, userId)),
      db.select().from(youtubeChannels).where(eq(youtubeChannels.userId, userId)),
      getRecentSecretAccess(userId, 20).catch(() => []),
    ])

  const llm = describeLlm()

  // Search provider: explicit env pin, else first of tavily/brave/serper with a stored key
  const activeSearchProvider =
    process.env.SEARCH_PROVIDER ||
    (["tavily", "brave", "serper"] as const).find((p) => keyRows.some((k) => k.provider === p)) ||
    ""
  const telegramActive = Boolean(keyRows.some((k) => k.provider === "telegram_bot") || process.env.TELEGRAM_BOT_TOKEN)
  const browserWorkerActive = Boolean(connectionsForm.browserWorkerUrl || process.env.BROWSER_WORKER_URL)

  return {
    leadgen,
    metaAds,
    general,
    connectionsForm,
    brainConfig,
    brain: brainDesc,
    routingGroups: ROUTING_GROUPS,
    // Masked key metadata only — never the key material
    keys: keyRows.map((k) => ({
      provider: k.provider,
      label: k.label,
      lastFour: k.lastFour,
      updatedAt: k.updatedAt.toISOString(),
    })),
    providers: Object.entries(KEY_PROVIDERS).map(([id, p]) => ({
      id,
      label: p.label,
      envVar: p.envVar,
      docsUrl: p.docsUrl,
      purpose: p.purpose,
      envConfigured: Boolean(process.env[p.envVar]),
    })),
    recentSecretAccess: recentSecretAccess.map((r) => ({
      provider: r.provider,
      action: r.action,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    })),
    connections: {
      googleCalendar: calRows.find((c) => c.provider === "google_calendar")?.status ?? "not_connected",
      youtubeChannels: ytRows.map((c) => ({ name: c.channelName, status: c.status })),
      telegram: telegramActive,
      cronSecret: Boolean(process.env.CRON_SECRET),
      searchProvider: activeSearchProvider,
      browserWorker: browserWorkerActive,
      encryptionReady: isCryptoConfigured(),
    },
    routing: {
      provider: llm.provider,
      models: llm.models,
      configured: llm.configured,
      taskCount: Object.keys(TASK_TIERS).length,
      tiers: {
        light: Object.entries(TASK_TIERS)
          .filter(([, t]) => t === "light")
          .map(([k]) => k),
        standard: Object.entries(TASK_TIERS)
          .filter(([, t]) => t === "standard")
          .map(([k]) => k),
        heavy: Object.entries(TASK_TIERS)
          .filter(([, t]) => t === "heavy")
          .map(([k]) => k),
      },
    },
  }
}

// --- API key vault --------------------------------------------------------------

// Returns {ok:false,error} instead of throwing, so a missing encryption key or
// bad input surfaces inline in the UI and never crashes the settings render.
export async function saveApiKeyAction(provider: string, key: string, label: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await getUserId()
  if (!KEY_PROVIDERS[provider]) return { ok: false, error: "Unknown provider" }
  const trimmed = key.trim()
  if (trimmed.length < 8) return { ok: false, error: "Key looks too short" }
  if (!isCryptoConfigured())
    return { ok: false, error: "CREDENTIALS_ENCRYPTION_KEY is not set on the server — add it in Vercel env vars, then redeploy, before storing keys." }

  try {
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
        .set({ encryptedKey, lastFour, label: label.trim(), updatedAt: new Date() })
        .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
    } else {
      await db.insert(apiKeys).values({ id: randomUUID(), userId, provider, label: label.trim(), encryptedKey, lastFour })
    }
    await db.insert(secretAccessLog).values({ id: randomUUID(), userId, provider, action: "write", source: "settings.saveApiKeyAction" }).catch(() => {})
    revalidatePath("/")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to store key" }
  }
}

/** Set the LLM brain (provider + optional per-tier models) — Settings → Model Brain. */
export async function saveBrainAction(cfg: LlmBrainConfig) {
  const userId = await getUserId()
  const current = await getConfig(userId, "llm_brain", LLM_BRAIN_DEFAULTS)
  // Only touch the global-brain fields; PRESERVE strategies/default/group + tasks.
  const clean: LlmBrainConfig = {
    ...current,
    provider: (["gateway", "openrouter", "moonshot", "google", "custom"] as const).includes(cfg.provider) ? cfg.provider : "gateway",
    baseUrl: (cfg.baseUrl ?? "").trim().slice(0, 200),
    models: {
      light: (cfg.models?.light ?? "").trim().slice(0, 100),
      standard: (cfg.models?.standard ?? "").trim().slice(0, 100),
      heavy: (cfg.models?.heavy ?? "").trim().slice(0, 100),
    },
  }
  await writeBrain(userId, clean)
  revalidatePath("/")
  return { ok: true }
}

async function writeBrain(userId: string, cfg: LlmBrainConfig) {
  const existing = await db
    .select({ id: appConfig.id })
    .from(appConfig)
    .where(and(eq(appConfig.userId, userId), eq(appConfig.key, "llm_brain")))
    .limit(1)
  if (existing.length > 0) {
    await db.update(appConfig).set({ value: cfg as unknown as Record<string, unknown>, updatedAt: new Date() }).where(and(eq(appConfig.userId, userId), eq(appConfig.key, "llm_brain")))
  } else {
    await db.insert(appConfig).values({ id: randomUUID(), userId, key: "llm_brain", value: cfg as unknown as Record<string, unknown> })
  }
}

/** Save the routing config: strategies + global default + per-area assignment. */
export async function saveRoutingAction(input: {
  strategies: LlmBrainConfig["strategies"]
  defaultStrategy: string
  groupStrategies: Record<string, string>
}) {
  const userId = await getUserId()
  const current = await getConfig(userId, "llm_brain", LLM_BRAIN_DEFAULTS)
  const strategies = (input.strategies ?? []).slice(0, 12).map((s) => ({
    id: (s.id || randomUUID().slice(0, 8)).slice(0, 40),
    name: (s.name || "Strategy").slice(0, 40),
    tiers: {
      light: { provider: s.tiers?.light?.provider ?? "gateway", model: (s.tiers?.light?.model ?? "").slice(0, 100) },
      standard: { provider: s.tiers?.standard?.provider ?? "gateway", model: (s.tiers?.standard?.model ?? "").slice(0, 100) },
      heavy: { provider: s.tiers?.heavy?.provider ?? "gateway", model: (s.tiers?.heavy?.model ?? "").slice(0, 100) },
    },
  }))
  const ids = new Set(strategies.map((s) => s.id))
  const groupStrategies: Record<string, string> = {}
  for (const [g, sid] of Object.entries(input.groupStrategies ?? {})) if (sid && ids.has(sid)) groupStrategies[g] = sid
  const merged: LlmBrainConfig = {
    ...current,
    strategies,
    defaultStrategy: ids.has(input.defaultStrategy) ? input.defaultStrategy : "",
    groupStrategies,
  }
  await writeBrain(userId, merged)
  revalidatePath("/")
  return { ok: true }
}

/** One-click: seed Gemini's benchmark strategies + set the balanced default. */
export async function applyRecommendedRoutingAction() {
  const userId = await getUserId()
  const { recommendedStrategies } = await import("@/lib/config")
  const current = await getConfig(userId, "llm_brain", LLM_BRAIN_DEFAULTS)
  const { strategies, defaultId } = recommendedStrategies()
  // Merge (replace same-id, keep the user's custom ones)
  const byId = new Map((current.strategies ?? []).map((s) => [s.id, s]))
  for (const s of strategies) byId.set(s.id, s)
  const merged: LlmBrainConfig = { ...current, strategies: [...byId.values()], defaultStrategy: defaultId }
  await writeBrain(userId, merged)
  revalidatePath("/")
  return { ok: true, count: strategies.length, defaultId }
}

export async function deleteApiKeyAction(provider: string) {
  const userId = await getUserId()
  await db.delete(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
  await db.insert(secretAccessLog).values({ id: randomUUID(), userId, provider, action: "delete", source: "settings.deleteApiKeyAction" }).catch(() => {})
  revalidatePath("/")
  return { ok: true }
}
