"use server"

// Lead-Gen Agent server actions. All queries userId-scoped.

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { leadgenProspects, leadgenRuns } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { runLeadgenAgent, promoteProspectToLead } from "@/lib/leadgen"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user.id
}

export async function runLeadgenNowAction(overrides?: {
  category?: string
  location?: string
  source?: "maps_no_website" | "ai_upgrade"
}) {
  const userId = await getUserId()
  try {
    const result = await runLeadgenAgent(userId, "manual", overrides)
    revalidatePath("/")
    return { ok: true as const, ...result }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Run failed" }
  }
}

export async function getLeadgenStateAction() {
  const userId = await getUserId()
  const [prospects, runs] = await Promise.all([
    db
      .select()
      .from(leadgenProspects)
      .where(eq(leadgenProspects.userId, userId))
      .orderBy(desc(leadgenProspects.createdAt))
      .limit(100),
    db
      .select()
      .from(leadgenRuns)
      .where(eq(leadgenRuns.userId, userId))
      .orderBy(desc(leadgenRuns.createdAt))
      .limit(10),
  ])
  return {
    prospects: prospects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    runs: runs.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  }
}

export async function promoteProspectAction(prospectId: string) {
  const userId = await getUserId()
  try {
    const leadId = await promoteProspectToLead(userId, prospectId)
    revalidatePath("/")
    return { ok: true as const, leadId }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Promotion failed" }
  }
}

export async function rejectProspectAction(prospectId: string) {
  const userId = await getUserId()
  await db
    .update(leadgenProspects)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(leadgenProspects.userId, userId), eq(leadgenProspects.id, prospectId)))
  revalidatePath("/")
  return { ok: true }
}
