/**
 * Analytics poller cron (§5.2) — for every published youtube_videos row, fetch
 * stats and INSERT a new youtube_metrics snapshot (append-only, never update).
 */
import { db } from "@/lib/db"
import { youtubeVideos, youtubeMetrics, videoProjects } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { fetchVideoStats, isYoutubeOAuthConfigured } from "@/lib/youtube-api"
import { randomUUID } from "crypto"

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isYoutubeOAuthConfigured()) {
    return Response.json({ skipped: true, reason: "YouTube OAuth not configured" })
  }

  const published = await db.select().from(youtubeVideos).where(eq(youtubeVideos.uploadStatus, "published")).limit(50)
  let inserted = 0
  const errors: string[] = []
  for (const video of published) {
    if (!video.youtubeVideoId) continue
    try {
      const [project] = await db.select().from(videoProjects).where(eq(videoProjects.id, video.videoProjectId)).limit(1)
      if (!project) continue
      const stats = await fetchVideoStats(project.userId, video.channelId, video.youtubeVideoId)
      await db.insert(youtubeMetrics).values({ id: randomUUID(), youtubeVideoId: video.id, ...stats })
      inserted++
    } catch (e) {
      errors.push(`${video.id}: ${e instanceof Error ? e.message : "unknown"}`)
    }
  }
  return Response.json({ published: published.length, inserted, errors })
}
