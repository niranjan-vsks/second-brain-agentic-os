"use server"

import { generateText } from "ai"
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
import { and, desc, eq, asc } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { getModelForUser } from "@/lib/llm"
import { getAgentOverride, directiveBlock } from "@/lib/config"
import { skillsBlockFor } from "@/lib/skills"

// linkedin.compose_post / linkedin.tweak_post — prose drafting, standard tier.
// (Previously hardcoded to a flagship model; now routed through the tiered seam.)
// per-agent model resolved inline via getModelForUser (vault-aware, user-configurable)

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// Mandatory claim-status guard line, injected into BOTH agent prompts (§4, §5).
function claimStatusGuard(claimStatus: string) {
  return `This post is tagged [${claimStatus}]. Do not imply completed/shipped/live status unless claim_status is 'shipped'. Use 'currently building', 'prototyping', or 'exploring' for 'building'/'concept'/'piloting'. If an instruction would push a non-shipped post toward implying it is shipped, decline that specific instruction and explain why instead of complying.`
}

async function getStyleContext(userId: string) {
  const [samples, prefs] = await Promise.all([
    db
      .select()
      .from(writingSamples)
      .where(eq(writingSamples.userId, userId))
      .orderBy(desc(writingSamples.addedAt))
      .limit(5),
    db
      .select()
      .from(voicePreferences)
      .where(and(eq(voicePreferences.userId, userId), eq(voicePreferences.active, true)))
      .orderBy(desc(voicePreferences.addedAt)),
  ])
  let ctx = ""
  if (samples.length > 0) {
    ctx += `\n\nWriting samples (match this voice):\n${samples.map((s, i) => `--- Sample ${i + 1} ---\n${s.sampleText}`).join("\n")}`
  }
  if (prefs.length > 0) {
    ctx += `\n\nHouse rules (always follow, non-negotiable):\n${prefs.map((p) => `- ${p.preferenceText}`).join("\n")}`
  }
  return ctx
}

// --- Draft Composer (§4) -----------------------------------------------------

export async function composeDraft(input: {
  trendItemId?: number
  manualIdea?: string
  claimStatus: string
  longForm?: boolean
}) {
  const userId = await getUserId()

  let topicContext = ""
  if (input.trendItemId) {
    const [trend] = await db
      .select()
      .from(trendItems)
      .where(and(eq(trendItems.id, input.trendItemId), eq(trendItems.userId, userId)))
    if (!trend) throw new Error("Trend item not found")
    topicContext = `Topic (from trend scout):\nTitle: ${trend.title}\nSource: ${trend.source}\nURL: ${trend.url}\nSummary: ${trend.summary}`
  } else if (input.manualIdea) {
    topicContext = `Topic (owner's idea):\n${input.manualIdea}`
  } else {
    throw new Error("Provide a trend item or a manual idea")
  }

  const styleCtx = await getStyleContext(userId)
  const lengthRule = input.longForm ? "Write long-form (400-600 words)." : "Target 150-220 words."
  const override = await getAgentOverride(userId, "linkedin_post") // Jarvis-set operator directives
  const skillsCtx = await skillsBlockFor(userId, "linkedin_post") // Arsenal skills assigned to this agent

  const { text } = await generateText({
    model: await getModelForUser(userId, "standard"),
    system: `You are a LinkedIn ghost-writer for a senior agentic AI engineer. Write a single LinkedIn post. ${lengthRule} Strong hook in the first line. No hashtag spam (max 3). No client names, employer internals, or proprietary stack details. No fabricated numbers or engagement bait.

${claimStatusGuard(input.claimStatus)}${styleCtx}

Output ONLY the post text, nothing else.${directiveBlock(override)}${skillsCtx}`,
    prompt: topicContext,
  })

  const [post] = await db
    .insert(linkedinPosts)
    .values({
      userId,
      trendItemId: input.trendItemId ?? null,
      claimStatus: input.claimStatus,
      content: text.trim(),
      status: "pending_review",
    })
    .returning()

  await db.insert(draftRevisions).values({
    userId,
    postId: post.id,
    revisionNumber: 1,
    content: text.trim(),
    editedBy: "agent",
  })

  if (input.trendItemId) {
    await db
      .update(trendItems)
      .set({ used: true })
      .where(and(eq(trendItems.id, input.trendItemId), eq(trendItems.userId, userId)))
  }

  await db.insert(notifications).values({
    userId,
    type: "new_draft",
    relatedPostId: post.id,
    message: `New draft ready for review: "${text.trim().slice(0, 60)}..."`,
  })

  revalidatePath("/")
  return { postId: post.id }
}

// --- Tweak Agent (§5) ---------------------------------------------------------
// Full context on every turn: current draft, full chat history, original trend
// item, claim_status, writing samples, and voice preferences.

export async function tweakDraft(postId: number, instruction: string) {
  const userId = await getUserId()

  const [post] = await db
    .select()
    .from(linkedinPosts)
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  if (!post) throw new Error("Post not found")
  if (post.status !== "pending_review") throw new Error("Only pending_review drafts can be tweaked")

  const [history, trend, styleCtx] = await Promise.all([
    db
      .select()
      .from(postChatMessages)
      .where(and(eq(postChatMessages.postId, postId), eq(postChatMessages.userId, userId)))
      .orderBy(asc(postChatMessages.createdAt)),
    post.trendItemId
      ? db
          .select()
          .from(trendItems)
          .where(and(eq(trendItems.id, post.trendItemId), eq(trendItems.userId, userId)))
          .then((r) => r[0])
      : Promise.resolve(undefined),
    getStyleContext(userId),
  ])

  // Persist owner message first
  await db.insert(postChatMessages).values({ userId, postId, role: "owner", content: instruction })

  const trendCtx = trend ? `\n\nOriginal trend item:\nTitle: ${trend.title}\nSummary: ${trend.summary}` : ""

  const { text } = await generateText({
    model: await getModelForUser(userId, "standard"),
    system: `You are the Tweak Agent for a LinkedIn draft-review workflow. The owner gives you tweak instructions; you revise the draft.

${claimStatusGuard(post.claimStatus)}

If the instruction is safe, respond in EXACTLY this format:
REVISED:
<the full revised post text>

If the instruction would violate the claim-status rule, respond in EXACTLY this format (and do NOT revise):
DECLINED:
<one or two sentences explaining why>

Never use any other format. No preamble.${styleCtx}${trendCtx}`,
    messages: [
      ...history.map((m) => ({
        role: (m.role === "owner" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `Current draft:\n---\n${post.content}\n---\n\nInstruction: ${instruction}`,
      },
    ],
  })

  const reply = text.trim()

  if (reply.startsWith("DECLINED:")) {
    const explanation = reply.replace(/^DECLINED:\s*/, "")
    await db.insert(postChatMessages).values({ userId, postId, role: "agent", content: `Declined: ${explanation}` })
    revalidatePath("/")
    return { declined: true, message: explanation }
  }

  const revised = reply.replace(/^REVISED:\s*/, "").trim()
  if (!revised) throw new Error("Agent returned an empty revision")

  // Agent reply becomes a new revision automatically
  const revs = await db
    .select({ n: draftRevisions.revisionNumber })
    .from(draftRevisions)
    .where(and(eq(draftRevisions.postId, postId), eq(draftRevisions.userId, userId)))
    .orderBy(desc(draftRevisions.revisionNumber))
  const nextN = (revs[0]?.n ?? 0) + 1

  await db.insert(draftRevisions).values({ userId, postId, revisionNumber: nextN, content: revised, editedBy: "agent" })
  await db
    .update(linkedinPosts)
    .set({ content: revised, updatedAt: new Date() })
    .where(and(eq(linkedinPosts.id, postId), eq(linkedinPosts.userId, userId)))
  await db
    .insert(postChatMessages)
    .values({ userId, postId, role: "agent", content: `Revised the draft (revision ${nextN}).` })

  revalidatePath("/")
  return { declined: false, revisionNumber: nextN }
}
