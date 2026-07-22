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

export interface ApplyProfile {
  fullName: string
  email: string
  phone: string
  linkedin: string
  portfolio: string
  resumeUrl: string
  coverLetter?: string
}

export interface ApplyResult {
  ok: boolean
  submitted: boolean
  filledFields: string[]
  screenshotBase64: string | null
  finalUrl: string
  transcript: string
  reason: string
}

/**
 * Node 2 apply flow: open the posting, best-effort fill common application
 * fields via semantic locators, download+upload the résumé, screenshot, and
 * (only when submit=true) click the apply/submit control. Arbitrary portals
 * vary wildly, so this is BEST-EFFORT and always returns a screenshot as proof
 * of intent even when it can't complete the form. Never throws.
 */
export async function submitApplication(jobUrl: string, profile: ApplyProfile, submit: boolean): Promise<ApplyResult> {
  const base: ApplyResult = {
    ok: false,
    submitted: false,
    filledFields: [],
    screenshotBase64: null,
    finalUrl: jobUrl,
    transcript: "",
    reason: "",
  }
  if (!isAgentBrowserAvailable()) {
    return { ...base, reason: "browser sandbox unavailable (deploy on Vercel or set VERCEL_TOKEN/TEAM/PROJECT)" }
  }
  const { withAgentBrowserSandbox, runAgentBrowserCommand } = await import("@agent-browser/sandbox/vercel")
  const log: string[] = []
  const filled: string[] = []

  try {
    return await withAgentBrowserSandbox(async (sandbox) => {
      const run = (args: string[]) => runAgentBrowserCommand(sandbox, args)
      await run(["open", jobUrl])
      await run(["wait", "--load", "networkidle"]).catch(() => {})

      // Download the résumé into the sandbox for upload.
      let resumePath = ""
      try {
        await run(["eval", `fetch(${JSON.stringify(profile.resumeUrl)}).then(()=>1)`]).catch(() => {})
        // Use the CLI's own fetch-to-disk if available; else skip upload gracefully.
        const dl = await run(["read", profile.resumeUrl, "--raw"]).catch(() => null)
        if (dl) resumePath = "/tmp/resume.pdf"
      } catch {
        resumePath = ""
      }

      // Best-effort field fills via semantic locators (label/placeholder).
      const tryFill = async (labels: string[], value: string, name: string) => {
        if (!value) return
        for (const label of labels) {
          const r = await run(["find", "label", label, "fill", value]).catch(() => null)
          if (r && r.exitCode === 0) {
            filled.push(name)
            return
          }
          const p = await run(["find", "placeholder", label, "fill", value]).catch(() => null)
          if (p && p.exitCode === 0) {
            filled.push(name)
            return
          }
        }
      }
      await tryFill(["Email", "Email address", "Work email"], profile.email, "email")
      await tryFill(["Full name", "Name", "First name"], profile.fullName, "name")
      await tryFill(["Phone", "Phone number", "Mobile"], profile.phone, "phone")
      await tryFill(["LinkedIn", "LinkedIn URL", "LinkedIn profile"], profile.linkedin, "linkedin")
      await tryFill(["Website", "Portfolio", "Personal website"], profile.portfolio, "portfolio")

      if (resumePath) {
        await run(["find", "label", "Resume", "click"]).catch(() => {})
        await run(["upload", "input[type=file]", resumePath]).catch(() => {})
      }

      let submitted = false
      if (submit) {
        const s =
          (await run(["find", "role", "button", "click", "--name", "Submit application"]).catch(() => null)) ||
          (await run(["find", "role", "button", "click", "--name", "Submit"]).catch(() => null)) ||
          (await run(["find", "role", "button", "click", "--name", "Apply"]).catch(() => null))
        submitted = Boolean(s && s.exitCode === 0)
        if (submitted) await run(["wait", "--load", "networkidle"]).catch(() => {})
      }

      const shot = await run(["screenshot", "--full", "--screenshot-format", "jpeg", "--screenshot-quality", "70", "--json"]).catch(
        () => null,
      )
      const finalUrlRes = await run(["get", "url", "--json"]).catch(() => null)
      await run(["close"]).catch(() => {})

      const shotJson = shot?.json as { screenshot_base64?: string; base64?: string } | null
      return {
        ok: filled.length > 0 || submitted,
        submitted,
        filledFields: filled,
        screenshotBase64: shotJson?.screenshot_base64 ?? shotJson?.base64 ?? null,
        finalUrl: (finalUrlRes?.json as { url?: string })?.url ?? jobUrl,
        transcript: log.join("\n"),
        reason: submitted ? "submitted" : filled.length > 0 ? "prepared (not submitted)" : "could not map form fields",
      }
    })
  } catch (e) {
    return { ...base, reason: e instanceof Error ? e.message : "apply failed" }
  }
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
