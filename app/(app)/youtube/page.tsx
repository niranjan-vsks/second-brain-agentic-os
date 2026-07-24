import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { youtubeChannels, videoProjects, pipelineSettings, youtubeVideos } from "@/lib/db/schema"
import { desc, eq, inArray } from "drizzle-orm"
import { YoutubeTab } from "@/components/youtube/youtube-tab"

export default async function YoutubePage() {
  const user = await requireUser()
  const userId = user.id
  const [ytChannelRows, ytProjectRows, ytSettingsRows, ytVideoRows] = await Promise.all([
    db.select().from(youtubeChannels).where(eq(youtubeChannels.userId, userId)).orderBy(desc(youtubeChannels.createdAt)),
    db.select().from(videoProjects).where(eq(videoProjects.userId, userId)).orderBy(desc(videoProjects.updatedAt)),
    db.select().from(pipelineSettings).where(eq(pipelineSettings.userId, userId)).limit(1),
    db
      .select()
      .from(youtubeVideos)
      .where(
        inArray(
          youtubeVideos.channelId,
          db.select({ id: youtubeChannels.id }).from(youtubeChannels).where(eq(youtubeChannels.userId, userId)),
        ),
      ),
  ])
  return (
    <YoutubeTab channels={ytChannelRows} projects={ytProjectRows} settings={ytSettingsRows[0] ?? null} videos={ytVideoRows} />
  )
}
