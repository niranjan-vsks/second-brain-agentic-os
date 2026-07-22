/**
 * Career discovery cron — two zero-token passes per user:
 *   1. ATS scanner (runZeroTokenScan): direct ATS JSON APIs (doc 09 §scan.md).
 *   2. Job-Hunt Sourcer (Node 1): crawls the configured career pages/job boards
 *      via crawl4ai and stages matches into the same Career pipeline. No-ops
 *      unless the user set jobhunt.enabled. Folded here to avoid a new Hobby
 *      cron slot.
 * No LLM, no cost. Level 2 of the 3-level discovery strategy.
 */
import { db } from "@/lib/db"
import { careerSettings, appConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runZeroTokenScan } from "@/lib/career/scanner"
import { runSourcer } from "@/lib/jobhunt/sourcer"

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allSettings = await db.select({ userId: careerSettings.userId }).from(careerSettings)
  const results: Record<string, unknown> = {}
  for (const { userId } of allSettings) {
    try {
      results[userId] = await runZeroTokenScan(userId)
    } catch (e) {
      results[userId] = { error: e instanceof Error ? e.message : "scan failed" }
    }
  }

  // Sourcer pass — every user who saved a jobhunt config (runSourcer self-gates on enabled).
  const jobhuntUsers = await db.select({ userId: appConfig.userId }).from(appConfig).where(eq(appConfig.key, "jobhunt"))
  const sourced: Record<string, unknown> = {}
  for (const { userId } of jobhuntUsers) {
    try {
      sourced[userId] = await runSourcer(userId, "cron")
    } catch (e) {
      sourced[userId] = { error: e instanceof Error ? e.message : "sourcer failed" }
    }
  }

  return Response.json({ users: allSettings.length, results, sourcer: sourced })
}
