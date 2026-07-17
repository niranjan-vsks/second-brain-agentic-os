/**
 * Lead-Gen Agent cron (daily) — for each user whose leadgen config is enabled,
 * runs one discover+qualify cycle. Category/location rotate deterministically
 * per day so the configured space is covered over time. Opt-in only: users
 * without `leadgen.enabled = true` in app_config are skipped inside the agent.
 */
import { db } from "@/lib/db"
import { appConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runLeadgenAgent } from "@/lib/leadgen"

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only users who have saved a leadgen config are candidates
  const rows = await db.select().from(appConfig).where(eq(appConfig.key, "leadgen"))
  const results: Array<{ userId: string; message: string }> = []

  for (const row of rows) {
    const value = row.value as { enabled?: boolean }
    if (!value?.enabled) continue
    try {
      const result = await runLeadgenAgent(row.userId, "cron")
      results.push({ userId: row.userId, message: result.message })
    } catch (e) {
      results.push({ userId: row.userId, message: e instanceof Error ? e.message : "failed" })
    }
  }

  return Response.json({ ran: results.length, results })
}
