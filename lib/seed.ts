import "server-only"

import { db } from "@/lib/db"
import { topics, drills } from "@/lib/db/schema"
import { SYLLABUS_SEED, DRILL_SEED } from "@/lib/constants"
import { eq } from "drizzle-orm"

/**
 * Seeds the FDE syllabus + starter drills for a user if they have no topics yet.
 * Called from the page during render (no revalidatePath — this is not an action).
 */
export async function ensureSyllabusSeeded(userId: string) {
  const existing = await db.select({ id: topics.id }).from(topics).where(eq(topics.userId, userId)).limit(1)
  if (existing.length > 0) return

  const topicRows = SYLLABUS_SEED.map((t, i) => ({
    userId,
    track: t.track,
    title: t.title,
    description: t.description,
    priority: t.priority,
    sortOrder: i,
  }))
  const inserted = await db.insert(topics).values(topicRows).returning({ id: topics.id, track: topics.track })

  const trackToTopic = new Map<string, number>()
  for (const row of inserted) {
    if (!trackToTopic.has(row.track)) trackToTopic.set(row.track, row.id)
  }
  const drillRows = DRILL_SEED.map((d) => ({
    userId,
    topicId: trackToTopic.get(d.track) ?? null,
    question: d.question,
    difficulty: d.difficulty,
  }))
  await db.insert(drills).values(drillRows)
}
