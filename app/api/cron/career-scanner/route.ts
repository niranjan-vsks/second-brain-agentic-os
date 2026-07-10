/**
 * Career zero-token scanner cron (doc 08 Task 2) — polls ATS APIs directly for
 * every user with tracked companies configured. No LLM, no browser. Level 2 of
 * the 3-level discovery strategy (doc 09 §scan.md).
 */
import { db } from "@/lib/db"
import { careerSettings } from "@/lib/db/schema"
import { runZeroTokenScan } from "@/lib/career/scanner"

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
  return Response.json({ users: allSettings.length, results })
}
