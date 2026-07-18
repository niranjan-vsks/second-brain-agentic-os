"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { adCreatives, generationJobs } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { generateText } from "ai"
import { getModel } from "@/lib/llm"
import { getAgentOverride, directiveBlock } from "@/lib/config"
import { isHiggsfieldConfigured, submitGeneration } from "@/lib/higgsfield"
import { randomUUID } from "crypto"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export async function getAdCreatives() {
  const userId = await getUserId()
  return db.select().from(adCreatives).where(eq(adCreatives.userId, userId)).orderBy(desc(adCreatives.createdAt))
}

/**
 * Generate Ad Creative (§10.2) — same Script Composer / Prompt Builder / Higgsfield
 * pipeline underneath, different consumer. Attaches to an existing deal if given.
 */
export async function generateAdCreative(input: {
  dealId: string | null
  creativeType: "ad_video" | "ugc_style" | "testimonial_style"
  brief: string
}) {
  const userId = await getUserId()
  const id = randomUUID()

  // Copywriting frameworks from the Meta Ads Hook Engine skill (HeyOz):
  // PAS = Problem/Agitate/Solution; BAB = Before/After/Bridge; pattern interrupts open with "Stop." / "Wait." / bold numbers.
  const typeGuidance = {
    ad_video:
      "a direct-response paid ad video using PAS (name the problem, make it emotionally painful, introduce the solution): pattern-interrupt hook in first 2 seconds, hard CTA with urgency",
    ugc_style:
      "a UGC-style video using BAB (painful before state, aspirational after state, product as bridge): casual, handheld feel, first-person energy, native to the feed",
    testimonial_style:
      "a customer testimonial video using social proof (credibility lead, transformation arc): before state, discovery, transformation, recommendation",
  }[input.creativeType]

  const override = await getAgentOverride(userId, "ads_creative") // Jarvis-set operator directives

  try {
    const { text } = await generateText({
      model: getModel("standard"), // ads.creative — structured drafting
      system: `You are an ad creative script composer. Write ${typeGuidance}. Output STRICT JSON: {"premise": "...", "script": "...", "videoPrompt": "single text-to-video generation prompt, max 900 chars"}. JSON only, no fences.${directiveBlock(override)}`,
      prompt: `Client brief: ${input.brief}`,
    })
    const cleaned = text.replace(/^```(json)?/m, "").replace(/```$/m, "").trim()
    const parsed = JSON.parse(cleaned) as { premise: string; script: string; videoPrompt: string }

    let generationJobId: string | null = null
    let status: "draft" | "generated" = "draft"
    let stubNote: string | null = null

    if (isHiggsfieldConfigured()) {
      const higgsfieldJobId = await submitGeneration(parsed.videoPrompt, "shorts")
      generationJobId = randomUUID()
      await db.insert(generationJobs).values({
        id: generationJobId,
        videoProjectId: id, // ad creatives reuse generation_jobs; videoProjectId carries the creative id
        higgsfieldJobId,
        promptSent: parsed.videoPrompt,
        status: "submitted",
      })
    } else {
      stubNote = "STUB: Higgsfield not configured — script generated, video generation pending HIGGSFIELD_API_KEY."
    }

    await db.insert(adCreatives).values({
      id,
      userId,
      dealId: input.dealId,
      creativeType: input.creativeType,
      premise: parsed.premise,
      script: stubNote ? `${parsed.script}\n\n[${stubNote}]` : parsed.script,
      generationJobId,
      status,
    })
    revalidatePath("/")
    return { ok: true as const, id, stubbed: Boolean(stubNote) }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Ad creative generation failed" }
  }
}

export async function markCreativeDelivered(creativeId: string) {
  const userId = await getUserId()
  await db
    .update(adCreatives)
    .set({ status: "delivered" })
    .where(and(eq(adCreatives.id, creativeId), eq(adCreatives.userId, userId)))
  revalidatePath("/")
}
