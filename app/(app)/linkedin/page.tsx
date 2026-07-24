import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { trendItems, linkedinPosts, writingSamples, voicePreferences } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { LinkedinTab } from "@/components/linkedin/linkedin-tab"

export default async function LinkedinPage() {
  const user = await requireUser()
  const userId = user.id
  const [trendRows, postRows, sampleRows, preferenceRows] = await Promise.all([
    db.select().from(trendItems).where(eq(trendItems.userId, userId)).orderBy(desc(trendItems.discoveredAt)),
    db.select().from(linkedinPosts).where(eq(linkedinPosts.userId, userId)).orderBy(desc(linkedinPosts.updatedAt)),
    db.select().from(writingSamples).where(eq(writingSamples.userId, userId)).orderBy(desc(writingSamples.addedAt)),
    db.select().from(voicePreferences).where(eq(voicePreferences.userId, userId)).orderBy(desc(voicePreferences.addedAt)),
  ])
  return <LinkedinTab trends={trendRows} posts={postRows} samples={sampleRows} preferences={preferenceRows} />
}
