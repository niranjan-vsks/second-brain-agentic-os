/**
 * Upload worker — processes video_projects in `uploading` status: generates
 * title/description/tags, uploads the current video version to YouTube via
 * the channel's OAuth tokens, records youtube_videos, advances to `published`.
 * Runs on the same cron cadence as the generation poller.
 */
import { db } from "@/lib/db"
import { videoProjects, generationJobs, editVersions, youtubeVideos, youtubeChannels, notifications } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { uploadVideo, isYoutubeOAuthConfigured } from "@/lib/youtube-api"
import { generateText } from "ai"
import { getModelForUser } from "@/lib/llm"
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

  const queue = await db.select().from(videoProjects).where(eq(videoProjects.status, "uploading")).limit(5)
  const results: Record<string, string> = {}

  for (const project of queue) {
    try {
      const [channel] = await db
        .select()
        .from(youtubeChannels)
        .where(and(eq(youtubeChannels.id, project.channelId), eq(youtubeChannels.userId, project.userId)))
        .limit(1)
      if (!channel || channel.status !== "connected") throw new Error("Channel not connected")

      // Current version: latest edit version if any, else generation job output
      const [currentVersion] = await db
        .select()
        .from(editVersions)
        .where(and(eq(editVersions.videoProjectId, project.id), eq(editVersions.isCurrent, true)))
        .limit(1)
      let videoUrl: string | null | undefined = currentVersion?.blobUrl
      if (!videoUrl) {
        const [job] = await db
          .select()
          .from(generationJobs)
          .where(and(eq(generationJobs.videoProjectId, project.id), eq(generationJobs.status, "complete")))
          .orderBy(desc(generationJobs.createdAt))
          .limit(1)
        videoUrl = job?.blobUrl ?? undefined
      }
      if (!videoUrl) throw new Error("No completed video available")

      const { text } = await generateText({
        model: await getModelForUser(project.userId, "light"), // youtube.title_variants — metadata formatting
        system: `Write YouTube metadata. Output STRICT JSON: {"title": "max 90 chars, high-CTR", "description": "2-4 sentences + relevant hashtags", "tags": ["tag1","tag2",...max 10]}. JSON only.`,
        prompt: `Topic: ${project.topic}\nPremise: ${project.premise}\nFormat: ${project.videoFormat}`,
      })
      const meta = JSON.parse(text.replace(/^```(json)?/m, "").replace(/```$/m, "").trim()) as {
        title: string
        description: string
        tags: string[]
      }

      const fileRes = await fetch(videoUrl)
      if (!fileRes.ok) throw new Error(`Failed to fetch video from storage (${fileRes.status})`)
      const buffer = await fileRes.arrayBuffer()

      const rowId = randomUUID()
      await db.insert(youtubeVideos).values({
        id: rowId,
        videoProjectId: project.id,
        channelId: project.channelId,
        title: meta.title,
        description: meta.description,
        tags: meta.tags.join(","),
        uploadStatus: "uploading",
      })

      const youtubeVideoId = await uploadVideo(project.userId, project.channelId, {
        buffer,
        title: meta.title,
        description: meta.description,
        tags: meta.tags,
      })

      await db
        .update(youtubeVideos)
        .set({ youtubeVideoId, uploadStatus: "published", publishedAt: new Date() })
        .where(eq(youtubeVideos.id, rowId))
      await db.update(videoProjects).set({ status: "published", updatedAt: new Date() }).where(eq(videoProjects.id, project.id))
      await db.insert(notifications).values({
        userId: project.userId,
        type: project.autoPublished ? "batch_auto_published" : "video_published",
        message: `${project.autoPublished ? "AUTO-PUBLISHED (bypass batch)" : "Published"}: "${meta.title}" on ${channel.channelName}.`,
      })
      results[project.id] = "published"
    } catch (e) {
      const msg = e instanceof Error ? e.message : "upload failed"
      await db
        .update(videoProjects)
        .set({ status: "failed", errorMessage: msg, updatedAt: new Date() })
        .where(eq(videoProjects.id, project.id))
      await db.insert(notifications).values({ userId: project.userId, type: "job_failed", message: `Upload failed for "${project.topic}": ${msg}` })
      results[project.id] = `failed: ${msg}`
    }
  }
  return Response.json({ queued: queue.length, results })
}
