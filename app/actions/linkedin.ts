"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  trendItems,
  writingSamples,
  voicePreferences,
  linkedinPosts,
  draftRevisions,
  postChatMessages,
  notifications,
} from "@/lib/db/schema"
import { and, desc, eq, asc, lte, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { getSecret, getConfig, CONNECTIONS_DEFAULTS } from "@/lib/config"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

async function notify(userId: string, type: string, message: string, relatedPostId?: number) {
  await db.insert(notifications).values({ userId, type, message, relatedPostId: relatedPostId ?? null })
}

// --- Trend items -----------------------------------------------------------

export async function getTrendItems() {
  const userId = await getUserId()
  return db.select().from(trendItems).where(eq(trendItems.userId, userId)).orderBy(desc(trendItems.discoveredAt))
}

export async function addManualTrend(title: string, url: string, summary: string) {
  const userId = await getUserId()
  await db.insert(trendItems).values({ userId, source: "manual", title, url, summary })
  revalidatePath("/")
}

export async function deleteTrendItem(id: number) {
  const userId = await getUserId()
  await db.delete(trendItems).where(and(eq(trendItems.id, id), eq(trendItems.userId, userId)))
  revalidatePath("/")
}

// Trend Scout: official APIs only (HN, arXiv, GitHub). Never LinkedIn/X/login-walled platforms.
export async function runTrendScout() {
  const userId = await getUserId()
  const found: { source: string; url: string; title: string; summary: string }[] = []

  // Hacker News official API
  try {
    const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json")
    const ids: number[] = (await idsRes.json()).slice(0, 30)
    const stories = await Promise.all(
      ids.slice(0, 20).map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        return r.json()
      }),
    )
    const aiKeywords = /\b(ai|llm|agent|gpt|claude|rag|model|ml|inference|fine-?tun)/i
    for (const s of stories) {
      if (s?.title && aiKeywords.test(s.title)) {
        found.push({
          source: "hackernews",
          url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
          title: s.title,
          summary: `HN score ${s.score ?? 0}, ${s.descendants ?? 0} comments`,
        })
      }
    }
  } catch {
    // skip source on failure
  }

  // arXiv official API (cs.AI recent)
  try {
    const r = await fetch(
      "https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=5",
    )
    const xml = await r.text()
    const entries = xml.split("<entry>").slice(1)
    for (const e of entries) {
      const title = e.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim()
      const url = e.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim()
      const summary = e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 280)
      if (title && url) found.push({ source: "arxiv", url, title, summary: summary || "" })
    }
  } catch {
    // skip source on failure
  }

  // GitHub REST API: recently created AI repos by stars
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const r = await fetch(
      `https://api.github.com/search/repositories?q=ai+agent+created:%3E${since}&sort=stars&order=desc&per_page=5`,
      { headers: { Accept: "application/vnd.github+json" } },
    )
    const data = await r.json()
    for (const repo of data.items ?? []) {
      found.push({
        source: "github",
        url: repo.html_url,
        title: `${repo.full_name} — ${repo.stargazers_count} stars`,
        summary: repo.description || "",
      })
    }
  } catch {
    // skip source on failure
  }

  // De-dupe against existing URLs
  const existing = await db
    .select({ url: trendItems.url })
    .from(trendItems)
    .where(eq(trendItems.userId, userId))
  const known = new Set(existing.map((e) => e.url))
  const fresh = found.filter((f) => f.url && !known.has(f.url))

  if (fresh.length > 0) {
    await db.insert(trendItems).values(fresh.map((f) => ({ userId, ...f })))
  }
  revalidatePath("/")
  return { added: fresh.length, scanned: found.length }
}

// --- Style vault -----------------------------------------------------------

export async function getWritingSamples() {
  const userId = await getUserId()
  return db.select().from(writingSamples).where(eq(writingSamples.userId, userId)).orderBy(desc(writingSamples.addedAt))
}

export async function addWritingSample(sampleText: string, tag: string) {
  const userId = await getUserId()
  await db.insert(writingSamples).values({ userId, sampleText, tag })
  revalidatePath("/")
}

export async function deleteWritingSample(id: number) {
  const userId = await getUserId()
  await db.delete(writingSamples).where(and(eq(writingSamples.id, id), eq(writingSamples.userId, userId)))
  revalidatePath("/")
}

export async function getVoicePreferences() {
  const userId = await getUserId()
  return db
    .select()
    .from(voicePreferences)
    .where(eq(voicePreferences.userId, userId))
    .orderBy(desc(voicePreferences.addedAt))
}

export async function addVoicePreference(preferenceText: string, source: "chat_feedback" | "manual") {
  const userId = await getUserId()
  await db.insert(voicePreferences).values({ userId, preferenceText, source })
  revalidatePath("/")
}

export async function toggleVoicePreference(id: number, active: boolean) {
  const userId = await getUserId()
  await db
    .update(voicePreferences)
    .set({ active })
    .where(and(eq(voicePreferences.id, id), eq(voicePreferences.userId, userId)))
  revalidatePath("/")
}

export async function deleteVoicePreference(id: number) {
  const userId = await getUserId()
  await db.delete(voicePreferences).where(and(eq(voicePreferences.id, id), eq(voicePreferences.userId, userId)))
  revalidatePath("/")
}

// --- Posts pipeline ----------------------------------------------------------

export async function getPosts() {
  const userId = await getUserId()
  return db.select().from(linkedinPosts).where(eq(linkedinPosts.userId, userId)).orderBy(desc(linkedinPosts.createdAt))
}

export async function getRevisions(postId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(draftRevisions)
    .where(and(eq(draftRevisions.postId, postId), eq(draftRevisions.userId, userId)))
    .orderBy(asc(draftRevisions.revisionNumber))
}

export async function getChatMessages(postId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(postChatMessages)
    .where(and(eq(postChatMessages.postId, postId), eq(postChatMessages.userId, userId)))
    .orderBy(asc(postChatMessages.createdAt))
}

async function nextRevisionNumber(userId: string, postId: number) {
  const revs = await db
    .select({ n: draftRevisions.revisionNumber })
    .from(draftRevisions)
    .where(and(eq(draftRevisions.postId, postId), eq(draftRevisions.userId, userId)))
    .orderBy(desc(draftRevisions.revisionNumber))
  return (revs[0]?.n ?? 0) + 1
}

// Manual owner edit: creates a new revision
export async function saveManualEdit(postId: number, content: string) {
  const userId = await getUserId()
  const [post] = await db
    .select()
    .from(linkedinPosts)
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  if (!post) throw new Error("Post not found")
  if (post.status !== "pending_review") throw new Error("Only pending_review drafts can be edited")

  const n = await nextRevisionNumber(userId, postId)
  await db.insert(draftRevisions).values({ userId, postId, revisionNumber: n, content, editedBy: "owner" })
  await db
    .update(linkedinPosts)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  revalidatePath("/")
}

export async function rejectPost(postId: number) {
  const userId = await getUserId()
  await db
    .update(linkedinPosts)
    .set({ status: "rejected", reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId), eq(linkedinPosts.status, "pending_review")))
  revalidatePath("/")
}

// Individual approval only. Never callable in bulk on pending_review drafts.
export async function approvePost(postId: number, mode: "now" | "schedule", scheduledFor?: string) {
  const userId = await getUserId()
  const [post] = await db
    .select()
    .from(linkedinPosts)
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  if (!post) throw new Error("Post not found")
  if (post.status !== "pending_review") throw new Error("Only pending_review posts can be approved")

  if (mode === "now") {
    const result = await publishToLinkedIn(userId, post.id, post.content)
    revalidatePath("/")
    return result
  }

  await db
    .update(linkedinPosts)
    .set({
      status: scheduledFor ? "scheduled" : "approved",
      reviewedAt: new Date(),
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  revalidatePath("/")
  return { ok: true }
}

// Calendar: reassign scheduledFor on already-approved/scheduled rows ONLY.
// This action has no write access to pending_review -> approved transitions.
export async function reschedulePost(postId: number, scheduledFor: string | null) {
  const userId = await getUserId()
  const [post] = await db
    .select()
    .from(linkedinPosts)
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  if (!post) throw new Error("Post not found")
  if (post.status !== "approved" && post.status !== "scheduled") {
    throw new Error("Only approved posts can be scheduled. Review it first.")
  }
  await db
    .update(linkedinPosts)
    .set({
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      status: scheduledFor ? "scheduled" : "approved",
      updatedAt: new Date(),
    })
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  revalidatePath("/")
}

// Bulk scheduling convenience: spread ALREADY-APPROVED posts across slots.
export async function bulkSchedule(postIds: number[], startDate: string, gapDays: number) {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(linkedinPosts)
    .where(and(eq(linkedinPosts.userId, userId), inArray(linkedinPosts.id, postIds)))
  const eligible = rows.filter((r) => r.status === "approved" || r.status === "scheduled")
  if (eligible.length !== postIds.length) {
    throw new Error("Bulk scheduling only works on already-approved posts")
  }
  const start = new Date(startDate)
  for (let i = 0; i < eligible.length; i++) {
    const slot = new Date(start.getTime() + i * gapDays * 24 * 3600 * 1000)
    slot.setHours(9, 0, 0, 0)
    await db
      .update(linkedinPosts)
      .set({ scheduledFor: slot, status: "scheduled", updatedAt: new Date() })
      .where(and(eq(linkedinPosts.id, eligible[i].id), eq(linkedinPosts.userId, userId)))
  }
  revalidatePath("/")
}

export async function updateMetrics(
  postId: number,
  metrics: { likeCount: number; commentCount: number; shareCount: number; impressionCount: number },
) {
  const userId = await getUserId()
  await db
    .update(linkedinPosts)
    .set({ ...metrics, metricsUpdatedAt: new Date(), metricsSource: "manual", updatedAt: new Date() })
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  revalidatePath("/")
}

export async function deletePost(postId: number) {
  const userId = await getUserId()
  await db.delete(linkedinPosts).where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  await db.delete(draftRevisions).where(and(eq(draftRevisions.postId, postId), eq(draftRevisions.userId, userId)))
  await db
    .delete(postChatMessages)
    .where(and(eq(postChatMessages.postId, postId), eq(postChatMessages.userId, userId)))
  revalidatePath("/")
}

// --- Publisher ----------------------------------------------------------------
// The ONLY code path that hits the LinkedIn UGC Posts API.
// Official API only (w_member_social). No cookie/session automation, ever.

async function publishToLinkedIn(userId: string, postId: number, content: string) {
  // Vault key / Settings → Connections first, env fallback (same order as every provider)
  const token = await getSecret(userId, "linkedin_access_token", "linkedin.publish")
  const connections = await getConfig(userId, "connections", CONNECTIONS_DEFAULTS)
  const personUrn = connections.linkedinPersonUrn || process.env.LINKEDIN_PERSON_URN

  if (!token || !personUrn) {
    await notify(
      userId,
      "error",
      "LinkedIn credentials missing. Add a LinkedIn Access Token in Settings → API Keys and your person URN in Settings → Connections (official OAuth, w_member_social scope). Post kept as approved.",
      postId,
    )
    await db
      .update(linkedinPosts)
      .set({ status: "approved", reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
    return { ok: false, error: "missing_credentials" }
  }

  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: content },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      await notify(userId, "error", `LinkedIn API error (${res.status}): ${errText.slice(0, 200)}`, postId)
      return { ok: false, error: `api_${res.status}` }
    }
    const linkedinId = res.headers.get("x-restli-id") || ""
    await db
      .update(linkedinPosts)
      .set({
        status: "posted",
        postedAt: new Date(),
        reviewedAt: new Date(),
        linkedinPostId: linkedinId,
        updatedAt: new Date(),
      })
      .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
    await notify(userId, "posted", "Post published to LinkedIn.", postId)
    return { ok: true }
  } catch (e) {
    await notify(userId, "error", `Publish failed: ${e instanceof Error ? e.message : "unknown"}`, postId)
    return { ok: false, error: "network" }
  }
}

// Scheduler: publishes due scheduled posts. Fired on app load (V1) — wire to
// Vercel Cron in production. Same publisher logic, no separate mechanism.
export async function processDuePosts() {
  const userId = await getUserId()
  const due = await db
    .select()
    .from(linkedinPosts)
    .where(
      and(eq(linkedinPosts.userId, userId), eq(linkedinPosts.status, "scheduled"), lte(linkedinPosts.scheduledFor, new Date())),
    )
  for (const post of due) {
    await publishToLinkedIn(userId, post.id, post.content)
  }
  if (due.length > 0) revalidatePath("/")
  return { processed: due.length }
}

// --- Notifications --------------------------------------------------------------

export async function getNotifications() {
  const userId = await getUserId()
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
}

export async function markNotificationRead(id: number) {
  const userId = await getUserId()
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
  revalidatePath("/")
}

export async function markAllNotificationsRead() {
  const userId = await getUserId()
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId))
  revalidatePath("/")
}
