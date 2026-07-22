"use server"

// Job-Hunt Engine server actions — config, per-node runs, the pipeline cycle,
// the review-gate approvals, and the data feed for the Career → Job-Hunt UI.
// All getUserId()-scoped. Consequential nodes self-gate on the autonomy dial.

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { jobApplications, jobHuntRuns, appConfig } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getConfig, JOBHUNT_DEFAULTS, type JobHuntConfig } from "@/lib/config"
import { getOverlay } from "@/lib/agent-graph"
import { runSourcer } from "@/lib/jobhunt/sourcer"
import { runEnricher } from "@/lib/jobhunt/enricher"
import { runApplicant } from "@/lib/jobhunt/applicant"
import { runEmissary, sendDraftedOutreach } from "@/lib/jobhunt/emissary"
import { runJobHuntCycle } from "@/lib/jobhunt/orchestrator"
import { readPacket } from "@/lib/jobhunt/types"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user.id
}

const NODE_KEYS = ["jobhunt.sourcer", "jobhunt.applicant", "jobhunt.enricher", "jobhunt.emissary"] as const

export async function getJobHuntData() {
  const userId = await getUserId()
  const [cfg, overlay, jobs, runs] = await Promise.all([
    getConfig<JobHuntConfig>(userId, "jobhunt", JOBHUNT_DEFAULTS),
    getOverlay(userId),
    db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.userId, userId))
      .orderBy(desc(jobApplications.updatedAt))
      .limit(60),
    db.select().from(jobHuntRuns).where(eq(jobHuntRuns.userId, userId)).orderBy(desc(jobHuntRuns.createdAt)).limit(12),
  ])

  const autonomy = Object.fromEntries(
    NODE_KEYS.map((k) => [k, overlay.autonomy?.[k] ?? "review"]),
  ) as Record<(typeof NODE_KEYS)[number], "review" | "auto">

  const mapped = jobs.map((j) => {
    const p = readPacket(j.jobhunt)
    return {
      id: j.id,
      company: j.company,
      roleTitle: j.roleTitle,
      jobUrl: j.jobUrl,
      status: j.status,
      portalSource: j.portalSource,
      trackingId: p.trackingId ?? "",
      screenshotUrl: p.confirmationScreenshotUrl ?? "",
      manager: p.hiringManager ?? null,
      emailStatus: p.emailStatus ?? "",
      emailDraft: p.emailDraft ?? null,
      linkedinDraft: p.linkedinDraft ?? "",
      updatedAt: j.updatedAt.toISOString(),
    }
  })

  return {
    config: cfg,
    autonomy,
    jobs: mapped,
    approvalQueue: mapped.filter((j) => j.status === "pending_approval" || (j.emailDraft && j.emailStatus === "draft")),
    runs: runs.map((r) => ({ node: r.node, status: r.status, detail: r.detail, at: r.createdAt.toISOString() })),
  }
}

export async function saveJobHuntConfigAction(cfg: Partial<JobHuntConfig>) {
  const userId = await getUserId()
  const current = await getConfig<JobHuntConfig>(userId, "jobhunt", JOBHUNT_DEFAULTS)
  const merged = { ...current, ...cfg }
  const existing = await db
    .select({ id: appConfig.id })
    .from(appConfig)
    .where(and(eq(appConfig.userId, userId), eq(appConfig.key, "jobhunt")))
    .limit(1)
  if (existing.length > 0) {
    await db.update(appConfig).set({ value: merged as unknown as Record<string, unknown>, updatedAt: new Date() }).where(and(eq(appConfig.userId, userId), eq(appConfig.key, "jobhunt")))
  } else {
    await db.insert(appConfig).values({ id: randomUUID(), userId, key: "jobhunt", value: merged as unknown as Record<string, unknown> })
  }
  revalidatePath("/")
  return { ok: true }
}

export async function runSourcerAction() {
  return runSourcer(await getUserId(), "manual")
}

export async function runNodeAction(node: "enricher" | "applicant" | "emissary", jobId: string) {
  const userId = await getUserId()
  const r =
    node === "enricher"
      ? await runEnricher(userId, jobId, "manual")
      : node === "applicant"
        ? await runApplicant(userId, jobId, "manual")
        : await runEmissary(userId, jobId, "manual")
  revalidatePath("/")
  return r
}

export async function runCycleAction() {
  const r = await runJobHuntCycle(await getUserId(), "manual")
  revalidatePath("/")
  return r
}

/** Review-gate approval: actually submit a prepared application now. */
export async function approveApplicationAction(jobId: string) {
  const r = await runApplicant(await getUserId(), jobId, "manual", true)
  revalidatePath("/")
  return r
}

/** Review-gate approval: send the drafted cold email now. */
export async function approveOutreachAction(jobId: string) {
  const r = await sendDraftedOutreach(await getUserId(), jobId)
  revalidatePath("/")
  return r
}

export async function discardJobAction(jobId: string) {
  const userId = await getUserId()
  await db.update(jobApplications).set({ status: "discarded", updatedAt: new Date() }).where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
  revalidatePath("/")
  return { ok: true }
}
