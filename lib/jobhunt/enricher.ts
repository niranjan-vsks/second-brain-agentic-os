import "server-only"
// Job-Hunt Engine · Node 3 · ENRICHER (agent key jobhunt.enricher, standard)
// Apollo → Hunter waterfall to find the hiring manager, written into the shared
// job_applications.jobhunt packet. Read-only enrichment; no state-machine change.

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { jobApplications, jobHuntRuns } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { findHiringManager, domainFromUrl } from "@/lib/apollo-hunter"
import { readPacket, type JobHuntPacket } from "@/lib/jobhunt/types"

export async function runEnricher(
  userId: string,
  jobId: string,
  trigger: "manual" | "cron" | "jarvis" = "manual",
): Promise<{ ok: boolean; message: string; manager?: { name: string; email: string; source: string } }> {
  const runId = randomUUID()
  await db.insert(jobHuntRuns).values({ id: runId, userId, node: "enricher", trigger, status: "running" })

  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) {
    await db.update(jobHuntRuns).set({ status: "failed", detail: "job not found" }).where(eq(jobHuntRuns.id, runId))
    return { ok: false, message: "Job not found" }
  }

  try {
    const manager = await findHiringManager(userId, {
      company: job.company,
      jobUrl: job.jobUrl,
      roleTitle: job.roleTitle,
    })
    const packet: JobHuntPacket = {
      ...readPacket(job.jobhunt),
      domain: domainFromUrl(job.jobUrl) ?? readPacket(job.jobhunt).domain,
      ...(manager ? { hiringManager: manager } : {}),
    }
    await db
      .update(jobApplications)
      .set({ jobhunt: packet as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(jobApplications.id, jobId))

    const detail = manager
      ? `${manager.name || "manager"} (${manager.email || "no email"}) via ${manager.source} [${manager.confidence}]`
      : "no hiring manager found — add Apollo/Hunter keys or enrich manually"
    await db.update(jobHuntRuns).set({ status: "completed", found: manager ? 1 : 0, detail }).where(eq(jobHuntRuns.id, runId))
    return {
      ok: Boolean(manager),
      message: detail,
      ...(manager ? { manager: { name: manager.name, email: manager.email, source: manager.source } } : {}),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "enrichment failed"
    await db.update(jobHuntRuns).set({ status: "failed", detail: msg }).where(eq(jobHuntRuns.id, runId))
    return { ok: false, message: msg }
  }
}
