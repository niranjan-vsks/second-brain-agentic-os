"use server"

// Settings Hub server actions: JSON config store + encrypted API key vault.
// All queries userId-scoped (Neon has no RLS). Keys are AES-encrypted at rest
// and NEVER returned to the client — only provider + label + last four.

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { appConfig, apiKeys, connectedAccounts, youtubeChannels } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { encrypt, isCryptoConfigured } from "@/lib/crypto"
import {
  KEY_PROVIDERS,
  getConfig,
  LEADGEN_DEFAULTS,
  META_ADS_DEFAULTS,
  GENERAL_DEFAULTS,
  CONNECTIONS_DEFAULTS,
} from "@/lib/config"
import { describeLlm } from "@/lib/llm"
import { TASK_TIERS } from "@/lib/model-router"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user.id
}

// --- Config blobs --------------------------------------------------------------

export async function saveConfigAction(key: string, value: Record<string, unknown>) {
  const userId = await getUserId()
  const allowed = new Set(["leadgen", "funnels.meta_ads", "general", "connections"])
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

  const [leadgen, metaAds, general, connectionsForm, keyRows, calRows, ytRows] = await Promise.all([
    getConfig(userId, "leadgen", LEADGEN_DEFAULTS),
    getConfig(userId, "funnels.meta_ads", META_ADS_DEFAULTS),
    getConfig(userId, "general", GENERAL_DEFAULTS),
    getConfig(userId, "connections", CONNECTIONS_DEFAULTS),
    db.select().from(apiKeys).where(eq(apiKeys.userId, userId)),
    db.select().from(connectedAccounts).where(eq(connectedAccounts.userId, userId)),
    db.select().from(youtubeChannels).where(eq(youtubeChannels.userId, userId)),
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

export async function saveApiKeyAction(provider: string, key: string, label: string) {
  const userId = await getUserId()
  if (!KEY_PROVIDERS[provider]) throw new Error("Unknown provider")
  const trimmed = key.trim()
  if (trimmed.length < 8) throw new Error("Key looks too short")
  if (!isCryptoConfigured()) throw new Error("ENCRYPTION_KEY is not set — cannot store keys securely")

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
    await db.insert(apiKeys).values({
      id: randomUUID(),
      userId,
      provider,
      label: label.trim(),
      encryptedKey,
      lastFour,
    })
  }
  revalidatePath("/")
  return { ok: true }
}

export async function deleteApiKeyAction(provider: string) {
  const userId = await getUserId()
  await db.delete(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
  revalidatePath("/")
  return { ok: true }
}
