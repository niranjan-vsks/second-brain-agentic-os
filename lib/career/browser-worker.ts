// Browser-automation worker seam (Task 0.5) — one worker covers three needs:
// PDF rendering (Playwright/Chromium, per the real generate-pdf.mjs), Level-3
// scan liveness verification, and Block G posting snapshots.
//
// RESOLUTION CHAIN (per capability):
//   1. Custom worker URL (Settings → Connections / BROWSER_WORKER_URL env)
//   2. agent-browser in Vercel Sandbox (lib/browser-automation.ts) — automatic
//      on Vercel deployments, covers verify + snapshot (not PDF render)
//   3. Honest stub error

import { getConfig, getSecret, CONNECTIONS_DEFAULTS } from "@/lib/config"
import {
  isAgentBrowserAvailable,
  verifyPostingWithAgentBrowser,
  snapshotPostingWithAgentBrowser,
} from "@/lib/browser-automation"

async function resolveWorker(userId: string): Promise<{ base: string; secret: string | null } | null> {
  const conn = await getConfig(userId, "connections", CONNECTIONS_DEFAULTS)
  const base = process.env.BROWSER_WORKER_URL || conn.browserWorkerUrl
  if (!base) return null
  const secret = process.env.BROWSER_WORKER_SECRET || (await getSecret(userId, "browser_worker"))
  return { base, secret }
}

export async function isBrowserWorkerConfigured(userId: string): Promise<boolean> {
  if ((await resolveWorker(userId)) !== null) return true
  return isAgentBrowserAvailable()
}

async function callWorker<T>(userId: string, path: string, body: unknown): Promise<T> {
  const worker = await resolveWorker(userId)
  if (!worker) throw new Error("Browser worker not configured — add its URL in Settings → Connections")
  const res = await fetch(`${worker.base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(worker.secret ? { Authorization: `Bearer ${worker.secret}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`Browser worker ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

// Renders HTML to PDF. Paper format rule from the real pdf mode: US/Canada =
// letter, rest of world = a4. Returns a URL to the rendered PDF (worker is
// expected to upload to Blob or return a data URL). Custom-worker-only for
// now — piping a binary PDF out of the agent-browser sandbox is a follow-up.
export async function renderPdf(userId: string, html: string, format: "letter" | "a4"): Promise<{ pdfUrl: string }> {
  return callWorker(userId, "/render-pdf", { html, format })
}

// Level-3 liveness check: Active (title + description + visible apply control)
// vs Expired (?error=true redirect, "no longer available"/"filled"/"expired",
// or <300 chars of real content). Sequential only — never parallel (doc 09).
export async function verifyPostingLiveness(userId: string, url: string): Promise<{ active: boolean; reason: string }> {
  if (await resolveWorker(userId)) return callWorker(userId, "/verify-posting", { url })
  return verifyPostingWithAgentBrowser(url) // agent-browser sandbox fallback
}

// Block G high-reliability signal: posting age + apply-button state snapshot.
export async function snapshotPosting(userId: string, url: string): Promise<{ snapshotText: string; applyButtonState: string }> {
  if (await resolveWorker(userId)) return callWorker(userId, "/snapshot-posting", { url })
  return snapshotPostingWithAgentBrowser(url) // agent-browser sandbox fallback
}

// ASCII normalization from generate-pdf.mjs — pure utility, ported as-is
// (em-dashes, smart quotes, zero-width chars, nbsp → ATS-safe ASCII).
export function normalizeForAts(text: string): string {
  return text
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u2026/g, "...")
}
