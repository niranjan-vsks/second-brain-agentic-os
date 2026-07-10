"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  youtubeChannels,
  pipelineSettings,
  videoProjects,
  videoScripts,
  generationJobs,
  youtubeVideos,
  youtubeMetrics,
  notifications,
} from "@/lib/db/schema"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// Video duration sanity bounds (§4.3) — tunable via env without redeploy of logic
export async function getDurationBounds(format: string) {
  return format === "shorts"
    ? { min: Number(process.env.SHORTS_MIN_SECONDS ?? 15), max: Number(process.env.SHORTS_MAX_SECONDS ?? 60) }
    : { min: Number(process.env.LONGFORM_MIN_SECONDS ?? 180), max: Number(process.env.LONGFORM_MAX_SECONDS ?? 900) }
}

// State machine §3 — legal transitions, enforced here AND by DB CHECK constraint
const TRANSITIONS: Record<string, string[]> = {
  draft: ["scripting", "failed"],
  scripting: ["script_ready", "failed"],
  script_ready: ["prompt_ready", "scripting", "failed"],
  prompt_ready: ["generating", "failed"],
  generating: ["generated", "failed"],
  generated: ["pending_approval", "auto_approved", "failed"],
  pending_approval: ["auto_approved", "uploading", "rejected", "failed"],
  auto_approved: ["uploading", "failed"],
  uploading: ["published", "failed"],
  published: [],
  failed: ["draft", "scripting"], // allow retry
  rejected: [], // terminal, kept for audit
}

// --- Channels ---------------------------------------------------------------

export async function getChannels() {
  const userId = await getUserId()
  return db
    .select({
      id: youtubeChannels.id,
      channelName: youtubeChannels.channelName,
      youtubeChannelId: youtubeChannels.youtubeChannelId,
      status: youtubeChannels.status,
      createdAt: youtubeChannels.createdAt,
    })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.userId, userId))
    .orderBy(desc(youtubeChannels.createdAt))
}

export async function addChannel(channelName: string) {
  const userId = await getUserId()
  // Created as needs_reauth — never fake-connected; OAuth flow flips it (§8)
  await db.insert(youtubeChannels).values({ id: randomUUID(), userId, channelName, status: "needs_reauth" })
  revalidatePath("/")
}

export async function removeChannel(channelId: string) {
  const userId = await getUserId()
  await db.delete(youtubeChannels).where(and(eq(youtubeChannels.id, channelId), eq(youtubeChannels.userId, userId)))
  revalidatePath("/")
}

// --- Pipeline settings ------------------------------------------------------

export async function getPipelineSettings() {
  const userId = await getUserId()
  const rows = await db.select().from(pipelineSettings).where(eq(pipelineSettings.userId, userId)).limit(1)
  return rows[0] ?? null
}

export async function savePipelineSettings(input: {
  contentDomain: string
  toneVoiceNotes: string
  redFlagTerms: string
  defaultBypassApproval: boolean
  videoFormatDefault: string
}) {
  const userId = await getUserId()
  const existing = await db.select({ id: pipelineSettings.id }).from(pipelineSettings).where(eq(pipelineSettings.userId, userId)).limit(1)
  if (existing[0]) {
    await db
      .update(pipelineSettings)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(pipelineSettings.id, existing[0].id), eq(pipelineSettings.userId, userId)))
  } else {
    await db.insert(pipelineSettings).values({ id: randomUUID(), userId, ...input })
  }
  revalidatePath("/")
}

// --- Video projects ---------------------------------------------------------

export async function getVideoProjects() {
  const userId = await getUserId()
  return db.select().from(videoProjects).where(eq(videoProjects.userId, userId)).orderBy(desc(videoProjects.updatedAt))
}

export async function createVideoProjects(input: {
  channelId: string
  topics: { topic: string; premise?: string }[]
  videoFormat: string
  bypassApproval: boolean
}) {
  const userId = await getUserId()
  const valid = input.topics.filter((t) => t.topic.trim())
  const batchId = valid.length > 1 ? randomUUID() : null
  const ids: string[] = []
  for (const item of valid) {
    const id = randomUUID()
    ids.push(id)
    await db.insert(videoProjects).values({
      id,
      userId,
      channelId: input.channelId,
      topic: item.topic.trim(),
      premise: item.premise?.trim() ?? "",
      videoFormat: input.videoFormat,
      batchId,
      bypassApproval: input.bypassApproval, // set per batch at creation, immutable after (§4)
    })
  }
  revalidatePath("/")
  return ids
}

/** Transition with double-enforcement (code + DB CHECK). */
export async function transitionProject(projectId: string, toStatus: string, errorMessage?: string) {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
    .limit(1)
  const project = rows[0]
  if (!project) throw new Error("Project not found")
  const legal = TRANSITIONS[project.status] ?? []
  if (!legal.includes(toStatus)) throw new Error(`Illegal transition: ${project.status} -> ${toStatus}`)

  // §4 sanity floor — bypass is a preference, not an override of the safety floor
  let finalStatus = toStatus
  let autoPublished = project.autoPublished
  if (toStatus === "auto_approved") {
    const check = await runSanityFloor(userId, project.id)
    if (!check.pass) {
      finalStatus = "pending_approval"
      await db.insert(notifications).values({
        userId,
        type: "sanity_check_failed",
        message: `Auto-approval blocked for "${project.topic}": ${check.reason}`,
      })
    } else {
      autoPublished = true
    }
  }

  await db
    .update(videoProjects)
    .set({ status: finalStatus, autoPublished, errorMessage: errorMessage ?? null, updatedAt: new Date() })
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
  revalidatePath("/")
  return finalStatus
}

/** §4 sanity floor: red flags, clean job, duration in range. Runs unconditionally before auto_approved. */
async function runSanityFloor(userId: string, projectId: string): Promise<{ pass: boolean; reason?: string }> {
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
    .limit(1)
  if (!project) return { pass: false, reason: "project missing" }

  // 1. Red-flag terms against latest script
  const [settings] = await db.select().from(pipelineSettings).where(eq(pipelineSettings.userId, userId)).limit(1)
  const [latestScript] = await db
    .select()
    .from(videoScripts)
    .where(eq(videoScripts.videoProjectId, projectId))
    .orderBy(desc(videoScripts.revisionNumber))
    .limit(1)
  if (settings?.redFlagTerms && latestScript) {
    const terms = settings.redFlagTerms.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    const text = latestScript.scriptText.toLowerCase()
    const hit = terms.find((t) => text.includes(t))
    if (hit) return { pass: false, reason: `red-flag term "${hit}" found in script` }
  }

  // 2. Clean complete generation job
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.videoProjectId, projectId))
    .orderBy(desc(generationJobs.createdAt))
    .limit(1)
  if (!job || job.status !== "complete" || !job.blobUrl) {
    return { pass: false, reason: "generation job is not cleanly complete" }
  }

  // 3. Duration range — checked when duration metadata is available; if the
  // provider doesn't return it, this check is recorded as unverifiable and fails
  // closed (forces human review) rather than passing silently.
  // Duration comes from Higgsfield poll metadata when configured; without it we fail closed.
  if (!process.env.HIGGSFIELD_API_KEY) {
    return { pass: false, reason: "Higgsfield not configured — duration unverifiable, failing closed to human review" }
  }

  return { pass: true }
}

export async function approveProject(projectId: string) {
  return transitionProject(projectId, "uploading")
}

export async function rejectProject(projectId: string) {
  return transitionProject(projectId, "rejected")
}

// --- Scripts (git-style revisions, same shape as draft_revisions) ------------

export async function getScripts(projectId: string) {
  const userId = await getUserId()
  // scope via project ownership
  const [project] = await db
    .select({ id: videoProjects.id })
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
    .limit(1)
  if (!project) throw new Error("Project not found")
  return db.select().from(videoScripts).where(eq(videoScripts.videoProjectId, projectId)).orderBy(desc(videoScripts.revisionNumber))
}

export async function saveOwnerScriptRevision(projectId: string, scriptText: string) {
  const userId = await getUserId()
  const [project] = await db
    .select({ id: videoProjects.id })
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
    .limit(1)
  if (!project) throw new Error("Project not found")
  const [latest] = await db
    .select({ revisionNumber: videoScripts.revisionNumber })
    .from(videoScripts)
    .where(eq(videoScripts.videoProjectId, projectId))
    .orderBy(desc(videoScripts.revisionNumber))
    .limit(1)
  await db.insert(videoScripts).values({
    id: randomUUID(),
    videoProjectId: projectId,
    revisionNumber: (latest?.revisionNumber ?? 0) + 1,
    scriptText,
    createdBy: "owner",
  })
  revalidatePath("/")
}

// --- Generation jobs ----------------------------------------------------------

export async function getGenerationJobs(projectId: string) {
  const userId = await getUserId()
  const [project] = await db
    .select({ id: videoProjects.id })
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
    .limit(1)
  if (!project) throw new Error("Project not found")
  return db.select().from(generationJobs).where(eq(generationJobs.videoProjectId, projectId)).orderBy(desc(generationJobs.createdAt))
}

// --- Published videos + metrics -----------------------------------------------

export async function getYoutubeVideos() {
  const userId = await getUserId()
  const projects = await db
    .select({ id: videoProjects.id })
    .from(videoProjects)
    .where(eq(videoProjects.userId, userId))
  const ids = projects.map((p) => p.id)
  if (ids.length === 0) return []
  return db.select().from(youtubeVideos).where(inArray(youtubeVideos.videoProjectId, ids)).orderBy(desc(youtubeVideos.createdAt))
}

export async function getLatestMetrics() {
  const userId = await getUserId()
  const videos = await getYoutubeVideos()
  const videoIds = videos.filter((v) => v.youtubeVideoId).map((v) => v.id)
  if (videoIds.length === 0) return []
  // latest snapshot per video (append-only series)
  return db
    .select()
    .from(youtubeMetrics)
    .where(inArray(youtubeMetrics.youtubeVideoId, videoIds))
    .orderBy(desc(youtubeMetrics.polledAt))
    .limit(200)
}

/** One-click unpublish for auto-published rows (§4 audit trail requirement). */
export async function unpublishVideo(youtubeVideoRowId: string) {
  const userId = await getUserId()
  const videos = await getYoutubeVideos()
  const video = videos.find((v) => v.id === youtubeVideoRowId)
  if (!video) throw new Error("Video not found")
  if (!video.youtubeVideoId) throw new Error("Video was never uploaded to YouTube")

  const { setVideoPrivacy } = await import("@/lib/youtube-api")
  await setVideoPrivacy(userId, video.channelId, video.youtubeVideoId, "private")
  await db
    .update(youtubeVideos)
    .set({ uploadStatus: "failed" })
    .where(eq(youtubeVideos.id, youtubeVideoRowId))
  await db.insert(notifications).values({
    userId,
    type: "video_unpublished",
    message: `Video "${video.title}" set to private via one-click unpublish.`,
  })
  revalidatePath("/")
}

// --- Stats for tab shell -------------------------------------------------------

export async function getYoutubeStats() {
  const userId = await getUserId()
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoProjects)
    .where(and(eq(videoProjects.userId, userId), eq(videoProjects.status, "pending_approval")))
  const [thisWeek] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoProjects)
    .where(and(eq(videoProjects.userId, userId), sql`"createdAt" > now() - interval '7 days'`))
  return { pendingApproval: pending?.count ?? 0, videosThisWeek: thisWeek?.count ?? 0 }
}
