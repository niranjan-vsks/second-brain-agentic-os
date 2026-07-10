/**
 * Autopay reminder cron (daily) — for each active autopay whose nextChargeDate
 * is within reminderDaysBefore days, create an in-app notification (once per
 * charge cycle, deduped via lastRemindedAt). After a reminder fires for a
 * recurring autopay, rolls nextChargeDate forward by one cadence period.
 */
import { db } from "@/lib/db"
import { autopays, notifications } from "@/lib/db/schema"
import { eq, and, isNotNull } from "drizzle-orm"

export const maxDuration = 60

function addCadence(date: Date, cadence: string): Date {
  const d = new Date(date)
  if (cadence === "weekly") d.setDate(d.getDate() + 7)
  else if (cadence === "monthly") d.setMonth(d.getMonth() + 1)
  else if (cadence === "quarterly") d.setMonth(d.getMonth() + 3)
  else if (cadence === "yearly") d.setFullYear(d.getFullYear() + 1)
  return d
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(autopays)
    .where(and(eq(autopays.status, "active"), isNotNull(autopays.nextChargeDate)))

  const now = new Date()
  let reminded = 0

  for (const row of rows) {
    if (!row.nextChargeDate) continue
    const chargeDate = new Date(row.nextChargeDate)
    const windowStart = new Date(chargeDate)
    windowStart.setDate(windowStart.getDate() - row.reminderDaysBefore)

    // Not yet inside the reminder window.
    if (now < windowStart) continue
    // Already reminded for this cycle.
    if (row.lastRemindedAt && new Date(row.lastRemindedAt) >= windowStart) continue

    const days = Math.max(0, Math.ceil((chargeDate.getTime() - now.getTime()) / 86400_000))
    const amount = row.amountINR ? ` (₹${row.amountINR})` : ""
    await db.insert(notifications).values({
      userId: row.userId,
      type: "autopay_reminder",
      message:
        days === 0
          ? `Autopay charging today: ${row.merchant}${amount}. Cancel now if you don't want it — ask Jarvis for the playbook.`
          : `Autopay in ${days} day${days === 1 ? "" : "s"}: ${row.merchant}${amount} on ${row.nextChargeDate}. Cancel before it charges — ask Jarvis for the playbook.`,
    })
    reminded++

    // If the charge date has passed, roll forward for recurring cadences.
    const updates: { lastRemindedAt: Date; updatedAt: Date; nextChargeDate?: string } = {
      lastRemindedAt: now,
      updatedAt: now,
    }
    if (now >= chargeDate && row.cadence !== "adhoc") {
      updates.nextChargeDate = addCadence(chargeDate, row.cadence).toISOString().slice(0, 10)
    }
    await db.update(autopays).set(updates).where(eq(autopays.id, row.id))
  }

  return Response.json({ scanned: rows.length, reminded })
}
