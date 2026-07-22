import "server-only"
// Job-Hunt Engine · Node 2 · APPLICANT (agent key jobhunt.applicant, heavy)
// Drives a real browser (agent-browser sandbox) to apply on the native posting,
// screenshots the result as proof, mints a tracking id. AUTONOMY-GATED:
//   review → prepare + screenshot, DO NOT submit, park at pending_approval.
//   auto    → submit for real, mark applied.
// Always fails safe (never throws; never silently submits under 'review').

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { jobApplications, jobHuntRuns, user as userTable } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getAutonomy } from "@/lib/agent-graph"
import { getConfig, GENERAL_DEFAULTS } from "@/lib/config"
import { submitApplication, type ApplyProfile } from "@/lib/browser-automation"
import { saveVideo, isStorageConfigured } from "@/lib/storage"
import { readPacket, type JobHuntPacket } from "@/lib/jobhunt/types"
import { PORTFOLIO_SITE, PORTFOLIO_RESUME } from "@/lib/jobhunt/portfolio-context"

async function ownerProfile(userId: string): Promise<ApplyProfile> {
  const [u] = await db.select({ email: userTable.email, name: userTable.name }).from(userTable).where(eq(userTable.id, userId)).limit(1)
  const general = await getConfig(userId, "general", GENERAL_DEFAULTS)
  return {
    fullName: general.displayName || u?.name || "",
    email: u?.email || "",
    phone: "",
    linkedin: "",
    portfolio: PORTFOLIO_SITE,
    resumeUrl: PORTFOLIO_RESUME,
  }
}

export async function runApplicant(
  userId: string,
  jobId: string,
  trigger: "manual" | "cron" | "jarvis" = "manual",
  forceSubmit = false, // explicit operator approval of a review-gated application
): Promise<{ ok: boolean; message: string; submitted: boolean; trackingId?: string }> {
  const runId = randomUUID()
  await db.insert(jobHuntRuns).values({ id: runId, userId, node: "applicant", trigger, status: "running" })

  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) {
    await db.update(jobHuntRuns).set({ status: "failed", detail: "job not found" }).where(eq(jobHuntRuns.id, runId))
    return { ok: false, message: "Job not found", submitted: false }
  }
  if (!job.jobUrl) {
    await db.update(jobHuntRuns).set({ status: "failed", detail: "no job URL to apply on" }).where(eq(jobHuntRuns.id, runId))
    return { ok: false, message: "This job has no URL to apply on.", submitted: false }
  }

  const autonomy = await getAutonomy(userId, "jobhunt.applicant") // review | auto
  const doSubmit = forceSubmit || autonomy === "auto"
  const profile = await ownerProfile(userId)

  try {
    const res = await submitApplication(job.jobUrl, profile, doSubmit)
    const trackingId = `JH-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`

    let screenshotUrl = ""
    if (res.screenshotBase64 && isStorageConfigured()) {
      try {
        screenshotUrl = await saveVideo(Buffer.from(res.screenshotBase64, "base64"), `jobhunt/${userId}/${jobId}/${trackingId}.jpg`)
      } catch {
        screenshotUrl = ""
      }
    }

    const packet: JobHuntPacket = {
      ...readPacket(job.jobhunt),
      trackingId,
      appliedAt: new Date().toISOString(),
      confirmationScreenshotUrl: screenshotUrl,
      applyMethod: res.submitted ? "auto_browser" : "staged",
    }
    // review OR couldn't-submit → park for approval; real submit → applied.
    const nextStatus = res.submitted ? "applied" : "pending_approval"
    await db
      .update(jobApplications)
      .set({
        jobhunt: packet as unknown as Record<string, unknown>,
        status: nextStatus,
        autoSubmitted: res.submitted,
        updatedAt: new Date(),
      })
      .where(eq(jobApplications.id, jobId))

    const detail = res.submitted
      ? `submitted (${res.filledFields.join(",") || "form"}), tracking ${trackingId}`
      : `${autonomy === "review" ? "prepared for your approval" : "could not auto-submit"} — ${res.reason}${
          screenshotUrl ? " · screenshot saved" : ""
        }`
    await db.update(jobHuntRuns).set({ status: "completed", found: res.submitted ? 1 : 0, detail }).where(eq(jobHuntRuns.id, runId))
    return { ok: res.ok, message: detail, submitted: res.submitted, trackingId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "apply failed"
    await db.update(jobHuntRuns).set({ status: "failed", detail: msg }).where(eq(jobHuntRuns.id, runId))
    return { ok: false, message: msg, submitted: false }
  }
}
