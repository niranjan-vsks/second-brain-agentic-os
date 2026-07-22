import "server-only"
// Job-Hunt Engine orchestrator — the runner Jarvis boots. Per PRD it processes
// freshly sourced roles through Apply → Enrich → Outreach, bounded per cycle.
// Every node self-gates on the per-agent autonomy dial + review gates, so a
// full-autopilot cycle and a review-first cycle share the same code path.

import { db } from "@/lib/db"
import { jobApplications } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { runApplicant } from "@/lib/jobhunt/applicant"
import { runEnricher } from "@/lib/jobhunt/enricher"
import { runEmissary } from "@/lib/jobhunt/emissary"

const MAX_PER_CYCLE = 3 // browser applies are slow; keep cycles bounded

export async function runJobHuntCycle(
  userId: string,
  trigger: "manual" | "cron" | "jarvis" = "manual",
): Promise<{ processed: number; results: { jobId: string; company: string; steps: Record<string, string> }[] }> {
  const fresh = await db
    .select({ id: jobApplications.id, company: jobApplications.company, role: jobApplications.roleTitle })
    .from(jobApplications)
    .where(and(eq(jobApplications.userId, userId), eq(jobApplications.status, "discovered")))
    .limit(MAX_PER_CYCLE)

  const results: { jobId: string; company: string; steps: Record<string, string> }[] = []
  for (const job of fresh) {
    const steps: Record<string, string> = {}
    try {
      steps.apply = (await runApplicant(userId, job.id, trigger)).message
    } catch (e) {
      steps.apply = `error: ${e instanceof Error ? e.message : "failed"}`
    }
    try {
      steps.enrich = (await runEnricher(userId, job.id, trigger)).message
    } catch (e) {
      steps.enrich = `error: ${e instanceof Error ? e.message : "failed"}`
    }
    try {
      steps.outreach = (await runEmissary(userId, job.id, trigger)).message
    } catch (e) {
      steps.outreach = `error: ${e instanceof Error ? e.message : "failed"}`
    }
    results.push({ jobId: job.id, company: job.company, steps })
  }
  return { processed: fresh.length, results }
}
