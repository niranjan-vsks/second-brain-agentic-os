import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { topics, drills, resources } from "@/lib/db/schema"
import { asc, desc, eq } from "drizzle-orm"
import { PrepTab } from "@/components/prep/prep-tab"

export default async function PrepPage() {
  const user = await requireUser()
  const userId = user.id
  const [topicRows, drillRows, resourceRows] = await Promise.all([
    db.select().from(topics).where(eq(topics.userId, userId)).orderBy(asc(topics.priority), asc(topics.sortOrder)),
    db.select().from(drills).where(eq(drills.userId, userId)).orderBy(desc(drills.updatedAt)),
    db.select().from(resources).where(eq(resources.userId, userId)).orderBy(desc(resources.createdAt)),
  ])
  return <PrepTab topics={topicRows} drills={drillRows} resources={resourceRows} />
}
