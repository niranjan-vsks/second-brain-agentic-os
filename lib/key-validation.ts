import "server-only"

// Live credential validation. Given a provider + raw key (+ optional connection
// context like a self-hosted base URL), performs a REAL handshake against the
// provider and reports whether the key actually works — so the operator never
// stores a wrong/expired key silently.
//
// Contract: never throws. Always resolves a KeyValidation. Network/timeout
// failures come back as status "error" (couldn't reach), distinct from
// "invalid" (reached, rejected the key). "unverified" = no cheap probe exists
// for this provider, so we accept the key without a live check.

export type KeyValidationStatus = "valid" | "invalid" | "unverified" | "error"

export interface KeyValidation {
  status: KeyValidationStatus
  /** short human message for the UI */
  message: string
  /** optional extra detail (account email, plan, error body snippet) */
  detail?: string
}

export interface ValidationContext {
  /** self-hosted n8n base URL (for the n8n provider) */
  n8nBaseUrl?: string
  /** self-hosted crawl4ai base URL */
  crawl4aiBaseUrl?: string
  /** self-hosted browser-worker base URL */
  browserWorkerUrl?: string
}

const TIMEOUT_MS = 9000

/** fetch with a hard timeout — resolves to Response or throws AbortError/network. */
async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" })
  } finally {
    clearTimeout(t)
  }
}

/** Wrap a probe so any thrown error becomes a clean "error" result (unreachable). */
async function probe(fn: () => Promise<KeyValidation>): Promise<KeyValidation> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const timedOut = /abort/i.test(msg)
    return {
      status: "error",
      message: timedOut ? "Timed out reaching the provider (9s)" : "Couldn't reach the provider",
      detail: msg.slice(0, 200),
    }
  }
}

/** Trim a response body to a short, safe snippet for the UI. */
function snippet(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 200)
}

type Validator = (key: string, ctx: ValidationContext) => Promise<KeyValidation>

const VALIDATORS: Record<string, Validator> = {
  // --- LLM providers ---------------------------------------------------------
  openrouter: (key) =>
    probe(async () => {
      const r = await timedFetch("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (r.ok) {
        const j = (await r.json().catch(() => null)) as { data?: { label?: string; usage?: number; limit?: number } } | null
        const d = j?.data
        return {
          status: "valid",
          message: "Valid OpenRouter key",
          detail: d ? `${d.label ?? "key"} · usage ${d.usage ?? 0}${d.limit != null ? `/${d.limit}` : ""}` : undefined,
        }
      }
      if (r.status === 401) return { status: "invalid", message: "OpenRouter rejected the key (401 unauthorized)" }
      return { status: "error", message: `OpenRouter returned ${r.status}`, detail: snippet(await r.text().catch(() => "")) }
    }),

  google_ai: (key) =>
    probe(async () => {
      const r = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`)
      if (r.ok) {
        const j = (await r.json().catch(() => null)) as { models?: unknown[] } | null
        return { status: "valid", message: "Valid Gemini key", detail: `${j?.models?.length ?? 0} models available` }
      }
      if (r.status === 400 || r.status === 403) {
        const body = snippet(await r.text().catch(() => ""))
        return { status: "invalid", message: `Google rejected the key (${r.status})`, detail: body }
      }
      return { status: "error", message: `Google returned ${r.status}` }
    }),

  moonshot: (key) =>
    probe(async () => {
      const r = await timedFetch("https://api.moonshot.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (r.ok) return { status: "valid", message: "Valid Moonshot (Kimi) key" }
      if (r.status === 401) return { status: "invalid", message: "Moonshot rejected the key (401 unauthorized)" }
      return { status: "error", message: `Moonshot returned ${r.status}` }
    }),

  // --- Search providers ------------------------------------------------------
  tavily: (key) =>
    probe(async () => {
      const r = await timedFetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: "ping", max_results: 1, search_depth: "basic" }),
      })
      if (r.ok) return { status: "valid", message: "Valid Tavily key (test search succeeded)" }
      if (r.status === 401 || r.status === 403) return { status: "invalid", message: "Tavily rejected the key (unauthorized)" }
      return { status: "error", message: `Tavily returned ${r.status}`, detail: snippet(await r.text().catch(() => "")) }
    }),

  brave: (key) =>
    probe(async () => {
      const r = await timedFetch("https://api.search.brave.com/res/v1/web/search?q=ping&count=1", {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
      })
      if (r.ok) return { status: "valid", message: "Valid Brave Search key" }
      if (r.status === 401 || r.status === 403) return { status: "invalid", message: "Brave rejected the key (unauthorized)" }
      return { status: "error", message: `Brave returned ${r.status}` }
    }),

  serper: (key) =>
    probe(async () => {
      const r = await timedFetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: "ping", num: 1 }),
      })
      if (r.ok) return { status: "valid", message: "Valid Serper key" }
      if (r.status === 401 || r.status === 403) return { status: "invalid", message: "Serper rejected the key (unauthorized)" }
      return { status: "error", message: `Serper returned ${r.status}` }
    }),

  google_maps: (key) =>
    probe(async () => {
      const r = await timedFetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=coffee&inputtype=textquery&fields=place_id&key=${encodeURIComponent(key)}`,
      )
      const j = (await r.json().catch(() => null)) as { status?: string; error_message?: string } | null
      const s = j?.status
      if (s === "OK" || s === "ZERO_RESULTS") return { status: "valid", message: "Valid Google Maps Places key" }
      if (s === "REQUEST_DENIED" || s === "INVALID_REQUEST")
        return { status: "invalid", message: `Places API denied: ${s}`, detail: j?.error_message }
      return { status: "error", message: `Places API status: ${s ?? "unknown"}`, detail: j?.error_message }
    }),

  // --- Messaging / social ----------------------------------------------------
  telegram_bot: (key) =>
    probe(async () => {
      const r = await timedFetch(`https://api.telegram.org/bot${encodeURIComponent(key)}/getMe`)
      const j = (await r.json().catch(() => null)) as { ok?: boolean; result?: { username?: string }; description?: string } | null
      if (j?.ok && j.result) return { status: "valid", message: "Valid bot token", detail: `@${j.result.username}` }
      return { status: "invalid", message: "Telegram rejected the token", detail: j?.description }
    }),

  meta_ads: (key) =>
    probe(async () => {
      const r = await timedFetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(key)}`)
      const j = (await r.json().catch(() => null)) as { id?: string; name?: string; error?: { message?: string } } | null
      if (r.ok && j?.id) return { status: "valid", message: "Valid Meta access token", detail: j.name }
      return { status: "invalid", message: "Meta rejected the token", detail: j?.error?.message }
    }),

  linkedin_access_token: (key) =>
    probe(async () => {
      const r = await timedFetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (r.ok) {
        const j = (await r.json().catch(() => null)) as { name?: string } | null
        return { status: "valid", message: "Valid LinkedIn token", detail: j?.name }
      }
      if (r.status === 401) return { status: "invalid", message: "LinkedIn rejected the token (401)" }
      // token may lack openid scope but still post — don't hard-fail
      return { status: "unverified", message: `LinkedIn returned ${r.status} — token may still post; couldn't verify via userinfo` }
    }),

  // --- Enrichment / email ----------------------------------------------------
  apollo: (key) =>
    probe(async () => {
      const r = await timedFetch(`https://api.apollo.io/v1/auth/health?api_key=${encodeURIComponent(key)}`)
      const j = (await r.json().catch(() => null)) as { is_logged_in?: boolean } | null
      if (r.ok && j?.is_logged_in) return { status: "valid", message: "Valid Apollo key" }
      if (r.status === 401 || r.status === 403) return { status: "invalid", message: "Apollo rejected the key" }
      return { status: "error", message: `Apollo returned ${r.status}` }
    }),

  hunter: (key) =>
    probe(async () => {
      const r = await timedFetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`)
      if (r.ok) {
        const j = (await r.json().catch(() => null)) as { data?: { email?: string; plan_name?: string } } | null
        return { status: "valid", message: "Valid Hunter key", detail: j?.data ? `${j.data.email ?? ""} · ${j.data.plan_name ?? ""}`.trim() : undefined }
      }
      if (r.status === 401) return { status: "invalid", message: "Hunter rejected the key (401)" }
      return { status: "error", message: `Hunter returned ${r.status}` }
    }),

  resend: (key) =>
    probe(async () => {
      const r = await timedFetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (r.ok) return { status: "valid", message: "Valid Resend key" }
      if (r.status === 401 || r.status === 403) return { status: "invalid", message: "Resend rejected the key (unauthorized)" }
      return { status: "error", message: `Resend returned ${r.status}` }
    }),

  // --- Self-hosted (need a companion base URL) --------------------------------
  n8n: (key, ctx) =>
    probe(async () => {
      const base = (ctx.n8nBaseUrl || "").replace(/\/+$/, "")
      if (!base)
        return { status: "unverified", message: "Set your n8n instance URL in Connections first, then re-test." }
      const r = await timedFetch(`${base}/api/v1/workflows?limit=1`, { headers: { "X-N8N-API-KEY": key } })
      if (r.ok) return { status: "valid", message: "Connected to n8n (key + URL handshake OK)" }
      if (r.status === 401) return { status: "invalid", message: "n8n rejected the API key (401)" }
      return { status: "error", message: `n8n returned ${r.status} — check the instance URL` }
    }),

  crawl4ai: (key, ctx) =>
    probe(async () => {
      const base = (ctx.crawl4aiBaseUrl || "").replace(/\/+$/, "")
      if (!base) return { status: "unverified", message: "Set your crawl4ai base URL in Connections first, then re-test." }
      const r = await timedFetch(`${base}/health`, { headers: key ? { Authorization: `Bearer ${key}` } : undefined })
      if (r.ok) return { status: "valid", message: "crawl4ai instance reachable + authorized" }
      if (r.status === 401 || r.status === 403) return { status: "invalid", message: "crawl4ai rejected the bearer key" }
      return { status: "error", message: `crawl4ai returned ${r.status}` }
    }),

  browser_worker: (key, ctx) =>
    probe(async () => {
      const base = (ctx.browserWorkerUrl || "").replace(/\/+$/, "")
      if (!base) return { status: "unverified", message: "Set your browser-worker URL in Connections first, then re-test." }
      const r = await timedFetch(`${base}/health`, { headers: { Authorization: `Bearer ${key}` } })
      if (r.ok) return { status: "valid", message: "Browser worker reachable + authorized" }
      if (r.status === 401 || r.status === 403) return { status: "invalid", message: "Browser worker rejected the secret" }
      return { status: "error", message: `Browser worker returned ${r.status}` }
    }),

  // setu: OAuth client-credentials + FIU onboarding — no cheap probe. Unverified.
}

/** Providers we can live-check. UI uses this to label the rest as "not verifiable". */
export function isValidatable(provider: string): boolean {
  return provider in VALIDATORS
}

/**
 * Validate a raw key against its provider. Unknown/unprobeable providers return
 * "unverified" (stored without a live check) rather than blocking the operator.
 */
export async function validateKey(
  provider: string,
  key: string,
  ctx: ValidationContext = {},
): Promise<KeyValidation> {
  const trimmed = key.trim()
  if (!trimmed) return { status: "invalid", message: "Empty key" }
  const validator = VALIDATORS[provider]
  if (!validator) return { status: "unverified", message: "No live check for this provider — stored as-is." }
  return validator(trimmed, ctx)
}
