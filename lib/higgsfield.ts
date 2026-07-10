/**
 * Higgsfield video generation client — CONFIGURABLE STUB (§8, Task 0 of the PRD).
 *
 * Honest-status rule: never fake "connected". isHiggsfieldConfigured() gates every
 * call; the UI shows "needs configuration" until HIGGSFIELD_API_KEY is set.
 *
 * When configured, submitGeneration/pollJob hit the Higgsfield API. The exact
 * endpoint shape is behind this one file — when the owner finalizes access
 * (API key vs MCP endpoint), only this file changes. Callers (cron poller,
 * server actions) are already wired and will work unchanged.
 */

const API_BASE = process.env.HIGGSFIELD_API_BASE || "https://platform.higgsfield.ai/v1"

export function isHiggsfieldConfigured(): boolean {
  return Boolean(process.env.HIGGSFIELD_API_KEY)
}

export interface HiggsfieldJobStatus {
  jobId: string
  status: "queued" | "processing" | "complete" | "failed"
  outputUrl?: string
  error?: string
}

/** Submit a text-to-video generation. Returns the provider job ID. */
export async function submitGeneration(prompt: string, format: "shorts" | "long_form"): Promise<string> {
  if (!isHiggsfieldConfigured()) {
    throw new Error("Higgsfield not configured: set HIGGSFIELD_API_KEY (and optionally HIGGSFIELD_API_BASE).")
  }
  const res = await fetch(`${API_BASE}/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
    body: JSON.stringify({ prompt, aspect_ratio: format === "shorts" ? "9:16" : "16:9" }),
  })
  if (!res.ok) throw new Error(`Higgsfield submit failed (${res.status}): ${await res.text()}`)
  const json = (await res.json()) as { id?: string; job_id?: string }
  const jobId = json.id || json.job_id
  if (!jobId) throw new Error("Higgsfield response missing job id")
  return jobId
}

/** Poll a generation job's status. */
export async function pollJob(jobId: string): Promise<HiggsfieldJobStatus> {
  if (!isHiggsfieldConfigured()) {
    throw new Error("Higgsfield not configured: set HIGGSFIELD_API_KEY.")
  }
  const res = await fetch(`${API_BASE}/generations/${jobId}`, {
    headers: { Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
  })
  if (!res.ok) throw new Error(`Higgsfield poll failed (${res.status}): ${await res.text()}`)
  const json = (await res.json()) as { status?: string; output_url?: string; result?: { url?: string }; error?: string }
  const raw = (json.status || "").toLowerCase()
  const status: HiggsfieldJobStatus["status"] =
    raw === "completed" || raw === "complete" || raw === "succeeded"
      ? "complete"
      : raw === "failed" || raw === "error"
        ? "failed"
        : raw === "queued" || raw === "pending"
          ? "queued"
          : "processing"
  return { jobId, status, outputUrl: json.output_url || json.result?.url, error: json.error }
}
