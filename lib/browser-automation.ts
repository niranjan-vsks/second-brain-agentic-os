import "server-only"
// Browser automation engine — agent-browser (vercel-labs) running inside an
// ephemeral Vercel Sandbox microVM. Serverless-native: no local daemon, no
// separate worker to host. Used by the career browser functions and Jarvis's
// browse_page tool.
//
// Resolution chain for anything needing a real browser (see career/browser-worker.ts):
//   1. Custom BROWSER_WORKER_URL (operator-hosted service) — most control
//   2. agent-browser in Vercel Sandbox (this file) — zero-hosting default
//   3. Honest stub error
//
// Activation: works automatically on Vercel deployments (OIDC token present)
// or locally with VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID env.
// Each call boots a sandbox (~15-40s incl. Chrome install on cold start), so
// callers batch everything into ONE session. Playwright MCP is an IDE-side
// tool, not app-runtime — in-app fallback below this is plain fetch.

export function isAgentBrowserAvailable(): boolean {
  return Boolean(
    process.env.VERCEL_OIDC_TOKEN ||
      (process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID),
  )
}

export interface BrowsePageResult {
  url: string
  title: string
  snapshot: string
  pageText: string
}

/**
 * Navigate to a URL in a sandboxed browser and return title + accessibility
 * snapshot (interactive elements) + readable page text. Read-only — no clicks,
 * no form fills. One sandbox per call, always cleaned up.
 */
export async function browsePage(url: string): Promise<BrowsePageResult> {
  if (!isAgentBrowserAvailable()) {
    throw new Error(
      "Browser automation not available — deploy on Vercel (sandbox uses the deployment's OIDC token) or set VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID.",
    )
  }
  const { withAgentBrowserSandbox, runAgentBrowserCommand } = await import("@agent-browser/sandbox/vercel")

  return withAgentBrowserSandbox(async (sandbox) => {
    await runAgentBrowserCommand(sandbox, ["open", url])
    await runAgentBrowserCommand(sandbox, ["wait", "--load", "networkidle"]).catch(() => {
      // some pages never reach networkidle; proceed with what rendered
    })
    const [titleRes, urlRes, snapRes, textRes] = [
      await runAgentBrowserCommand<{ title?: string }>(sandbox, ["get", "title", "--json"]),
      await runAgentBrowserCommand<{ url?: string }>(sandbox, ["get", "url", "--json"]),
      await runAgentBrowserCommand(sandbox, ["snapshot", "-i", "-c"]),
      await runAgentBrowserCommand(sandbox, ["read"]),
    ]
    await runAgentBrowserCommand(sandbox, ["close"]).catch(() => {})
    return {
      url: (urlRes.json as { url?: string })?.url ?? url,
      title: (titleRes.json as { title?: string })?.title ?? "",
      snapshot: (snapRes.stdout ?? "").slice(0, 8000),
      pageText: (textRes.stdout ?? "").slice(0, 15000),
    }
  })
}

/**
 * Level-3 posting liveness check via sandboxed browser (career scanner
 * contract): Active = title + description + visible apply control; Expired =
 * error redirect / "no longer available" / near-empty content.
 */
export async function verifyPostingWithAgentBrowser(url: string): Promise<{ active: boolean; reason: string }> {
  const page = await browsePage(url)
  const text = `${page.title}\n${page.pageText}`.toLowerCase()
  const expiredMarkers = [
    "no longer available",
    "no longer accepting",
    "position has been filled",
    "job has been filled",
    "posting has expired",
    "job expired",
    "this job is closed",
    "404",
  ]
  const marker = expiredMarkers.find((m) => text.includes(m))
  if (marker) return { active: false, reason: `expired marker: "${marker}"` }
  if (page.pageText.replace(/\s+/g, " ").trim().length < 300) {
    return { active: false, reason: "under 300 chars of real content" }
  }
  const hasApply = /apply/i.test(page.snapshot) || /apply/i.test(text)
  return hasApply
    ? { active: true, reason: "title + content + apply control present" }
    : { active: true, reason: "content present, no explicit apply control found (verify manually)" }
}

/** Block G snapshot: page text + apply-button state, via sandboxed browser. */
export async function snapshotPostingWithAgentBrowser(
  url: string,
): Promise<{ snapshotText: string; applyButtonState: string }> {
  const page = await browsePage(url)
  const applyLine =
    page.snapshot
      .split("\n")
      .find((l) => /apply/i.test(l)) ?? ""
  return {
    snapshotText: `${page.title}\n\n${page.pageText.slice(0, 5000)}`,
    applyButtonState: applyLine ? `found: ${applyLine.trim()}` : "no apply control detected",
  }
}
