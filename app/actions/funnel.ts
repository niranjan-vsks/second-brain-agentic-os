"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deals, dealChecklist, assets, leads, artifacts } from "@/lib/db/schema"
import { STAGE_PLAYBOOKS, type StageId } from "@/lib/constants"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// --- Deals -------------------------------------------------------------------

export async function getDeals() {
  const userId = await getUserId()
  return db.select().from(deals).where(eq(deals.userId, userId)).orderBy(desc(deals.updatedAt))
}

export async function createDeal(data: { name: string; client: string; buildType: string; value: number; notes: string }) {
  const userId = await getUserId()
  const [deal] = await db
    .insert(deals)
    .values({ userId, name: data.name, client: data.client, buildType: data.buildType, value: data.value, notes: data.notes, stage: "lead" })
    .returning()
  // Seed the lead-stage playbook checklist
  const items = STAGE_PLAYBOOKS.lead.map((item, i) => ({ userId, dealId: deal.id, stage: "lead", item, sortOrder: i }))
  await db.insert(dealChecklist).values(items)
  revalidatePath("/")
  return deal
}

export async function updateDeal(id: number, data: Partial<{ name: string; client: string; buildType: string; value: number; notes: string; nextAction: string }>) {
  const userId = await getUserId()
  await db
    .update(deals)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(deals.id, id), eq(deals.userId, userId)))
  revalidatePath("/")
}

export async function moveDealStage(id: number, stage: StageId) {
  const userId = await getUserId()
  await db
    .update(deals)
    .set({ stage, updatedAt: new Date() })
    .where(and(eq(deals.id, id), eq(deals.userId, userId)))
  // Seed the playbook checklist for the new stage if not already present
  const existing = await db
    .select({ id: dealChecklist.id })
    .from(dealChecklist)
    .where(and(eq(dealChecklist.dealId, id), eq(dealChecklist.userId, userId), eq(dealChecklist.stage, stage)))
  if (existing.length === 0 && STAGE_PLAYBOOKS[stage]) {
    const items = STAGE_PLAYBOOKS[stage].map((item, i) => ({ userId, dealId: id, stage, item, sortOrder: i }))
    await db.insert(dealChecklist).values(items)
  }
  revalidatePath("/")
}

export async function deleteDeal(id: number) {
  const userId = await getUserId()
  await db.delete(dealChecklist).where(and(eq(dealChecklist.dealId, id), eq(dealChecklist.userId, userId)))
  await db.delete(deals).where(and(eq(deals.id, id), eq(deals.userId, userId)))
  revalidatePath("/")
}

// --- Deal checklist ------------------------------------------------------------

export async function getDealChecklist(dealId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(dealChecklist)
    .where(and(eq(dealChecklist.dealId, dealId), eq(dealChecklist.userId, userId)))
    .orderBy(dealChecklist.sortOrder)
}

export async function toggleChecklistItem(id: number, done: boolean) {
  const userId = await getUserId()
  await db
    .update(dealChecklist)
    .set({ done })
    .where(and(eq(dealChecklist.id, id), eq(dealChecklist.userId, userId)))
  revalidatePath("/")
}

// --- Assets (prompt/asset library) ---------------------------------------------

export async function getAssets() {
  const userId = await getUserId()
  return db.select().from(assets).where(eq(assets.userId, userId)).orderBy(desc(assets.updatedAt))
}

export async function createAsset(data: { title: string; category: string; buildType: string; content: string; tags: string }) {
  const userId = await getUserId()
  await db.insert(assets).values({ userId, ...data })
  revalidatePath("/")
}

export async function updateAsset(id: number, data: Partial<{ title: string; category: string; buildType: string; content: string; tags: string }>) {
  const userId = await getUserId()
  await db
    .update(assets)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.userId, userId)))
  revalidatePath("/")
}

export async function deleteAsset(id: number) {
  const userId = await getUserId()
  await db.delete(assets).where(and(eq(assets.id, id), eq(assets.userId, userId)))
  revalidatePath("/")
}

// --- Leads (outreach tracker) ---------------------------------------------------

export async function getLeads() {
  const userId = await getUserId()
  return db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.updatedAt))
}

export async function createLead(data: { name: string; company: string; channel: string; notes: string }) {
  const userId = await getUserId()
  await db.insert(leads).values({ userId, ...data })
  revalidatePath("/")
}

export async function updateLead(
  id: number,
  data: Partial<{ name: string; company: string; channel: string; status: string; notes: string; lastTouch: Date | null; nextFollowUp: Date | null }>,
) {
  const userId = await getUserId()
  await db
    .update(leads)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.userId, userId)))
  revalidatePath("/")
}

export async function deleteLead(id: number) {
  const userId = await getUserId()
  await db.delete(leads).where(and(eq(leads.id, id), eq(leads.userId, userId)))
  revalidatePath("/")
}

// --- Artifacts -------------------------------------------------------------------

export async function getArtifacts() {
  const userId = await getUserId()
  return db.select().from(artifacts).where(eq(artifacts.userId, userId)).orderBy(desc(artifacts.updatedAt))
}

export async function createArtifact(data: { dealId: number | null; type: string; title: string; content: string }) {
  const userId = await getUserId()
  const [artifact] = await db.insert(artifacts).values({ userId, ...data }).returning()
  revalidatePath("/")
  return artifact
}

export async function updateArtifact(id: number, data: Partial<{ title: string; content: string }>) {
  const userId = await getUserId()
  await db
    .update(artifacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
  revalidatePath("/")
}

export async function deleteArtifact(id: number) {
  const userId = await getUserId()
  await db.delete(artifacts).where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
  revalidatePath("/")
}
