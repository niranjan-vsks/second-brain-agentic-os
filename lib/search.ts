// Provider-agnostic web search seam (Task 0.3 decision). Resolution order:
//   1. SEARCH_PROVIDER env (explicit pin) + SEARCH_API_KEY env or the matching
//      stored key from Settings → API Keys
//   2. Auto-detect: first of tavily / brave / serper with a stored key
//      (Settings → API Keys — no env var needed for the common case)
//   3. crawl4ai via CRAWL4AI_URL env (page fetching only, not keyword search)
// No provider configured => isSearchConfigured() false; callers fall back
// (e.g. deep mode falls back to prompt-generator per Task 0.4 decision).

import { getSecret } from "@/lib/config"

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

const AUTO_DETECT_ORDER = ["tavily", "brave", "serper"] as const

/** All configured search providers, in priority order (pinned first, then the rest with a stored/env key). */
async function resolveSearchProviders(userId: string): Promise<{ provider: string; key: string }[]> {
  const out: { provider: string; key: string }[] = []
  const seen = new Set<string>()

  const pinned = process.env.SEARCH_PROVIDER
  if (pinned && pinned !== "crawl4ai") {
    const key = process.env.SEARCH_API_KEY || (await getSecret(userId, pinned)) || ""
    if (key) {
      out.push({ provider: pinned, key })
      seen.add(pinned)
    }
  }
  for (const provider of AUTO_DETECT_ORDER) {
    if (seen.has(provider)) continue
    const key = await getSecret(userId, provider)
    if (key) {
      out.push({ provider, key })
      seen.add(provider)
    }
  }
  return out
}

export async function isSearchConfigured(userId: string): Promise<boolean> {
  if ((await resolveSearchProviders(userId)).length > 0) return true
  return process.env.SEARCH_PROVIDER === "crawl4ai" && !!process.env.CRAWL4AI_URL
}

async function callProvider(provider: string, key: string, query: string, maxResults: number): Promise<SearchResult[]> {
  if (provider === "tavily") {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query, max_results: maxResults }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`Tavily ${res.status}`)
    const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] }
    return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }))
  }

  if (provider === "brave") {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      { headers: { "X-Subscription-Token": key }, signal: AbortSignal.timeout(20000) },
    )
    if (!res.ok) throw new Error(`Brave ${res.status}`)
    const data = (await res.json()) as { web?: { results?: { title: string; url: string; description: string }[] } }
    return (data.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description }))
  }

  if (provider === "serper") {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: maxResults }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`Serper ${res.status}`)
    const data = (await res.json()) as { organic?: { title: string; link: string; snippet: string }[] }
    return (data.organic ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }))
  }

  throw new Error(`Unknown search provider: ${provider}`)
}

/**
 * Web search with automatic fallback: tries every configured provider in
 * priority order (pinned first, then tavily -> brave -> serper) and only
 * throws once all of them have failed. Previously this stopped at the FIRST
 * configured provider and threw immediately on any failure, even when a
 * working fallback key was sitting right there in the vault.
 */
export async function webSearch(userId: string, query: string, maxResults = 8): Promise<SearchResult[]> {
  const providers = await resolveSearchProviders(userId)
  if (providers.length === 0) {
    throw new Error("No search provider configured — add a Tavily, Brave, or Serper key in Settings → API Keys")
  }

  const errors: string[] = []
  for (const { provider, key } of providers) {
    try {
      return await callProvider(provider, key, query, maxResults)
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw new Error(`All configured search providers failed — ${errors.join(" | ")}`)
}

// Page fetch/extraction — prefers crawl4ai when configured (handles SPAs/JS),
// falls back to a plain fetch with HTML stripping. Used for JD extraction.
// crawl4ai base URL: Settings → Connections (per-user) or CRAWL4AI_URL env;
// optional bearer key: vault ("crawl4ai" provider) or CRAWL4AI_API_KEY env.
export async function fetchPage(url: string, userId?: string): Promise<string> {
  let crawl4ai = process.env.CRAWL4AI_URL
  let crawl4aiKey = process.env.CRAWL4AI_API_KEY
  if (userId) {
    const { getConfig, CONNECTIONS_DEFAULTS } = await import("@/lib/config")
    const conn = await getConfig(userId, "connections", CONNECTIONS_DEFAULTS)
    crawl4ai = crawl4ai || conn.crawl4aiBaseUrl
    crawl4aiKey = crawl4aiKey || (await getSecret(userId, "crawl4ai", "search.fetchPage")) || undefined
  }
  if (crawl4ai) {
    try {
      const res = await fetch(`${crawl4ai.replace(/\/$/, "")}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(crawl4aiKey ? { Authorization: `Bearer ${crawl4aiKey}` } : {}),
        },
        body: JSON.stringify({ urls: [url], f: "markdown" }),
        signal: AbortSignal.timeout(60000),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          results?: { markdown?: string | { raw_markdown?: string } }[]
        }
        const first = data.results?.[0]
        const md = typeof first?.markdown === "string" ? first.markdown : first?.markdown?.raw_markdown
        if (md && md.length > 100) return md
      }
    } catch {
      // fall through to plain fetch
    }
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; operator-os-career/1.0)" },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`fetch ${res.status} ${url}`)
  const html = await res.text()
  // crude but dependency-free extraction for static pages
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30000)
}
