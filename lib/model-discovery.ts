import "server-only"

// Live model discovery — lists the models actually available on the
// operator's own connection (vault key or env fallback), instead of a
// hand-maintained static guess list. Each provider's real /models (or
// equivalent) endpoint is queried with the resolved key.

export type CatalogProvider = "gateway" | "openrouter" | "moonshot" | "google" | "custom"

export interface ModelListResult {
  ok: boolean
  models: string[]
  /** why the list is empty/stale, shown inline so the operator can still type a model manually */
  error?: string
}

const TIMEOUT_MS = 10000

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" })
  } finally {
    clearTimeout(t)
  }
}

function fail(error: string): ModelListResult {
  return { ok: false, models: [], error }
}

/** OpenAI-compatible GET /models — used by Moonshot, OpenRouter, and custom endpoints. */
async function listOpenAICompatible(baseUrl: string, apiKey: string, providerLabel: string): Promise<ModelListResult> {
  try {
    const r = await timedFetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!r.ok) return fail(`${providerLabel} returned ${r.status} listing models`)
    const j = (await r.json().catch(() => null)) as { data?: { id?: string }[] } | null
    const ids = (j?.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
    if (ids.length === 0) return fail(`${providerLabel} returned no models`)
    return { ok: true, models: ids.sort() }
  } catch (e) {
    return fail(`Couldn't reach ${providerLabel}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function listGoogle(apiKey: string): Promise<ModelListResult> {
  try {
    const r = await timedFetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
    )
    if (!r.ok) return fail(`Google returned ${r.status} listing models`)
    const j = (await r.json().catch(() => null)) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[]
    } | null
    const ids = (j?.models ?? [])
      // Only text-generation-capable models; drop embeddings/vision-only/etc.
      .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean)
    if (ids.length === 0) return fail("Google returned no usable models")
    return { ok: true, models: ids.sort() }
  } catch (e) {
    return fail(`Couldn't reach Google: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Vercel AI Gateway model catalog. Public, no key required — it's an
 * aggregator listing every model it can route to, not tied to one account.
 */
async function listGateway(): Promise<ModelListResult> {
  try {
    const r = await timedFetch("https://ai-gateway.vercel.sh/v1/models")
    if (!r.ok) return fail(`Gateway returned ${r.status} listing models`)
    const j = (await r.json().catch(() => null)) as { data?: { id?: string }[] } | null
    const ids = (j?.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
    if (ids.length === 0) return fail("Gateway returned no models")
    return { ok: true, models: ids.sort() }
  } catch (e) {
    return fail(`Couldn't reach the AI Gateway: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * List the models actually available on this connection. `resolveKey` looks
 * up the vault/env secret for a given provider id (kept as a param so this
 * module doesn't import the db-touching lib/config.ts directly at build time
 * of callers that don't need it).
 */
export async function listAvailableModels(
  provider: CatalogProvider,
  resolveKey: (keyProvider: string) => Promise<string | null>,
  customBaseUrl?: string,
): Promise<ModelListResult> {
  if (provider === "gateway") return listGateway()

  if (provider === "google") {
    const key = await resolveKey("google_ai")
    if (!key) return fail("No Google AI Studio key — add one in Settings → API Keys.")
    return listGoogle(key)
  }
  if (provider === "moonshot") {
    const key = await resolveKey("moonshot")
    if (!key) return fail("No Moonshot (Kimi) key — add one in Settings → API Keys.")
    return listOpenAICompatible("https://api.moonshot.ai/v1", key, "Moonshot")
  }
  if (provider === "openrouter") {
    const key = await resolveKey("openrouter")
    if (!key) return fail("No OpenRouter key — add one in Settings → API Keys.")
    return listOpenAICompatible("https://openrouter.ai/api/v1", key, "OpenRouter")
  }
  if (provider === "custom") {
    if (!customBaseUrl) return fail("Set a base URL first (Settings → Model Brain).")
    const key = (await resolveKey("openrouter")) || ""
    return listOpenAICompatible(customBaseUrl, key, "Custom endpoint")
  }
  return fail("Unknown provider")
}
