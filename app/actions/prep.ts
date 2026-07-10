"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { topics, studySessions, drills, resources } from "@/lib/db/schema"
import { SYLLABUS_SEED, DRILL_SEED } from "@/lib/constants"
import { and, asc, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// --- Topics (syllabus) ----------------------------------------------------------

export async function getTopics() {
  const userId = await getUserId()
  return db
    .select()
    .from(topics)
    .where(eq(topics.userId, userId))
    .orderBy(asc(topics.priority), asc(topics.sortOrder))
}

export async function seedSyllabus() {
  const userId = await getUserId()
  const existing = await db.select({ id: topics.id }).from(topics).where(eq(topics.userId, userId))
  if (existing.length > 0) return { seeded: false }
  const topicRows = SYLLABUS_SEED.map((t, i) => ({
    userId,
    track: t.track,
    title: t.title,
    description: t.description,
    priority: t.priority,
    sortOrder: i,
  }))
  const inserted = await db.insert(topics).values(topicRows).returning({ id: topics.id, track: topics.track })
  // Seed drills, linking each to the first topic of its track
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
  revalidatePath("/")
  return { seeded: true }
}

export async function createTopic(data: { track: string; title: string; description: string; priority: number }) {
  const userId = await getUserId()
  await db.insert(topics).values({ userId, ...data })
  revalidatePath("/")
}

export async function updateTopicStatus(id: number, status: string) {
  const userId = await getUserId()
  await db
    .update(topics)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(topics.id, id), eq(topics.userId, userId)))
  revalidatePath("/")
}

export async function deleteTopic(id: number) {
  const userId = await getUserId()
  await db.delete(topics).where(and(eq(topics.id, id), eq(topics.userId, userId)))
  revalidatePath("/")
}

// --- Study sessions (weekly planner) ----------------------------------------------

export async function getSessions(weekStart: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), eq(studySessions.weekStart, weekStart)))
    .orderBy(asc(studySessions.id))
}

export async function createSession(data: { topicId: number | null; weekStart: string; day: string; plannedMinutes: number; focus: string }) {
  const userId = await getUserId()
  await db.insert(studySessions).values({ userId, ...data })
  revalidatePath("/")
}

export async function updateSession(id: number, data: Partial<{ done: boolean; actualMinutes: number; focus: string; plannedMinutes: number }>) {
  const userId = await getUserId()
  await db
    .update(studySessions)
    .set(data)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
  revalidatePath("/")
}

export async function deleteSession(id: number) {
  const userId = await getUserId()
  await db.delete(studySessions).where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
  revalidatePath("/")
}

// --- Drills (question bank) ---------------------------------------------------------

export async function getDrills() {
  const userId = await getUserId()
  return db.select().from(drills).where(eq(drills.userId, userId)).orderBy(desc(drills.updatedAt))
}

export async function createDrill(data: { topicId: number | null; question: string; difficulty: string }) {
  const userId = await getUserId()
  await db.insert(drills).values({ userId, ...data })
  revalidatePath("/")
}

export async function updateDrill(id: number, data: Partial<{ answer: string; status: string; question: string; difficulty: string }>) {
  const userId = await getUserId()
  await db
    .update(drills)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(drills.id, id), eq(drills.userId, userId)))
  revalidatePath("/")
}

export async function deleteDrill(id: number) {
  const userId = await getUserId()
  await db.delete(drills).where(and(eq(drills.id, id), eq(drills.userId, userId)))
  revalidatePath("/")
}

// --- Resources (vault) ------------------------------------------------------------

export async function getResources() {
  const userId = await getUserId()
  return db.select().from(resources).where(eq(resources.userId, userId)).orderBy(desc(resources.createdAt))
}

export async function createResource(data: { topicId: number | null; title: string; url: string; kind: string; notes: string }) {
  const userId = await getUserId()
  await db.insert(resources).values({ userId, ...data })
  revalidatePath("/")
}

export async function deleteResource(id: number) {
  const userId = await getUserId()
  await db.delete(resources).where(and(eq(resources.id, id), eq(resources.userId, userId)))
  revalidatePath("/")
}
