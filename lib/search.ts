// Provider-agnostic web search seam (Task 0.3 decision). Activates via env:
//   SEARCH_PROVIDER = tavily | brave | serper | crawl4ai
//   SEARCH_API_KEY  = provider key (not needed for crawl4ai)
//   CRAWL4AI_URL    = base URL of a self-hosted crawl4ai instance (docker deploy)
// No provider configured => isSearchConfigured() false; callers fall back
// (e.g. deep mode falls back to prompt-generator per Task 0.4 decision).

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export function isSearchConfigured(): boolean {
  const p = process.env.SEARCH_PROVIDER
  if (!p) return false
  if (p === "crawl4ai") return !!process.env.CRAWL4AI_URL
  return !!process.env.SEARCH_API_KEY
}

export async function webSearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  const provider = process.env.SEARCH_PROVIDER
  const key = process.env.SEARCH_API_KEY ?? ""

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

  if (provider === "crawl4ai") {
    // Self-hosted crawl4ai (same capability used for LinkedIn OS). Its /crawl
    // endpoint fetches + extracts a URL; for search we crawl a search-engine
    // results page is unreliable, so crawl4ai is primarily used by fetchPage below.
    throw new Error("crawl4ai supports page fetching, not keyword search — set SEARCH_PROVIDER to tavily/brave/serper for search and keep CRAWL4AI_URL for page extraction")
  }

  throw new Error("No search provider configured (set SEARCH_PROVIDER + SEARCH_API_KEY)")
}

// Page fetch/extraction — prefers crawl4ai when configured (handles SPAs/JS),
// falls back to a plain fetch with HTML stripping. Used for JD extraction.
export async function fetchPage(url: string): Promise<string> {
  const crawl4ai = process.env.CRAWL4AI_URL
  if (crawl4ai) {
    try {
      const res = await fetch(`${crawl4ai.replace(/\/$/, "")}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CRAWL4AI_API_KEY ? { Authorization: `Bearer ${process.env.CRAWL4AI_API_KEY}` } : {}),
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
