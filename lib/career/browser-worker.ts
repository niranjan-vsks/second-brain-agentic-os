// Browser-automation worker seam (Task 0.5) — one worker covers three needs:
// PDF rendering (Playwright/Chromium, per the real generate-pdf.mjs), Level-3
// scan liveness verification, and Block G posting snapshots. STUB until
// BROWSER_WORKER_URL (+ optional BROWSER_WORKER_SECRET) is set — same
// env-activation pattern as Higgsfield/Remotion.

export function isBrowserWorkerConfigured(): boolean {
  return !!process.env.BROWSER_WORKER_URL
}

async function callWorker<T>(path: string, body: unknown): Promise<T> {
  const base = process.env.BROWSER_WORKER_URL
  if (!base) throw new Error("Browser worker not configured (set BROWSER_WORKER_URL)")
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.BROWSER_WORKER_SECRET ? { Authorization: `Bearer ${process.env.BROWSER_WORKER_SECRET}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`Browser worker ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

// Renders HTML to PDF. Paper format rule from the real pdf mode: US/Canada =
// letter, rest of world = a4. Returns a URL to the rendered PDF (worker is
// expected to upload to Blob or return a data URL).
export async function renderPdf(html: string, format: "letter" | "a4"): Promise<{ pdfUrl: string }> {
  return callWorker("/render-pdf", { html, format })
}

// Level-3 liveness check: Active (title + description + visible apply control)
// vs Expired (?error=true redirect, "no longer available"/"filled"/"expired",
// or <300 chars of real content). Sequential only — never parallel (doc 09).
export async function verifyPostingLiveness(url: string): Promise<{ active: boolean; reason: string }> {
  return callWorker("/verify-posting", { url })
}

// Block G high-reliability signal: posting age + apply-button state snapshot.
export async function snapshotPosting(url: string): Promise<{ snapshotText: string; applyButtonState: string }> {
  return callWorker("/snapshot-posting", { url })
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
