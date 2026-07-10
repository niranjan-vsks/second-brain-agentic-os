"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { editRequests, editVersions, videoProjects, generationJobs } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { generateText } from "ai"
import { getModel } from "@/lib/llm"
import { randomUUID } from "crypto"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export async function isRemotionConfigured() {
  return Boolean(process.env.REMOTION_LAMBDA_FUNCTION_NAME && process.env.REMOTION_LAMBDA_REGION && process.env.REMOTION_LAMBDA_BUCKET)
}

export async function getEditVersions(videoProjectId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(editVersions)
    .where(and(eq(editVersions.videoProjectId, videoProjectId), eq(editVersions.userId, userId)))
    .orderBy(desc(editVersions.versionNumber))
}

export async function getEditRequests(videoProjectId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(editRequests)
    .where(and(eq(editRequests.videoProjectId, videoProjectId), eq(editRequests.userId, userId)))
    .orderBy(desc(editRequests.createdAt))
}

/**
 * Prompt-based edit (§12): plain-English instruction -> constrained remotionSpec
 * (fixed vocabulary: trim, captionOverlay, speedChange, crossfade, textCard —
 * NOT arbitrary generated code). Render runs via the render poller cron when
 * Remotion Lambda is configured; otherwise the request sits in an honest
 * "submitted" state marked as awaiting configuration.
 */
export async function requestEdit(videoProjectId: string, editPrompt: string) {
  const userId = await getUserId()
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(and(eq(videoProjects.id, videoProjectId), eq(videoProjects.userId, userId)))
    .limit(1)
  if (!project) throw new Error("Project not found")
  // §12.2.6: editing after approval but before upload forces re-review
  if (["uploading", "published"].includes(project.status)) {
    throw new Error("Cannot edit after approval/upload. Video is locked.")
  }

  // Source video: current edit version, else latest completed generation job
  const [currentVersion] = await db
    .select()
    .from(editVersions)
    .where(and(eq(editVersions.videoProjectId, videoProjectId), eq(editVersions.userId, userId), eq(editVersions.isCurrent, true)))
    .limit(1)
  let sourceBlobUrl = currentVersion?.blobUrl ?? ""
  if (!sourceBlobUrl) {
    const [job] = await db
      .select()
      .from(generationJobs)
      .where(and(eq(generationJobs.videoProjectId, videoProjectId), eq(generationJobs.status, "complete")))
      .orderBy(desc(generationJobs.createdAt))
      .limit(1)
    sourceBlobUrl = job?.blobUrl ?? ""
  }
  if (!sourceBlobUrl) throw new Error("No source video available to edit yet.")

  const { text } = await generateText({
    model: getModel("heavy"), // edits.edit_spec — constrained-vocabulary spec generation
    system: `Convert the edit instruction into a JSON edit spec with this EXACT constrained vocabulary — an array "operations" of objects, each one of:
{"op":"trim","startSeconds":n,"endSeconds":n}
{"op":"captionOverlay","text":"...","startSeconds":n,"endSeconds":n,"position":"top|center|bottom"}
{"op":"speedChange","factor":n,"startSeconds":n,"endSeconds":n}
{"op":"crossfade","atSeconds":n,"durationSeconds":n}
{"op":"textCard","text":"...","atSeconds":n,"durationSeconds":n}
Output {"operations":[...]} only. JSON, no fences. If the instruction can't map to these ops, output {"operations":[],"unsupported":"reason"}.`,
    prompt: editPrompt,
  })
  const cleaned = text.replace(/^```(json)?/m, "").replace(/```$/m, "").trim()
  const spec = JSON.parse(cleaned) as { operations: unknown[]; unsupported?: string }
  if (spec.unsupported || !Array.isArray(spec.operations) || spec.operations.length === 0) {
    return { ok: false as const, error: spec.unsupported || "Edit instruction could not be mapped to supported operations." }
  }

  await db.insert(editRequests).values({
    id: randomUUID(),
    userId,
    videoProjectId,
    sourceType: "generation_job",
    sourceBlobUrl,
    editPrompt,
    remotionSpec: JSON.stringify(spec),
    status: "submitted",
    errorMessage: (await isRemotionConfigured())
      ? null
      : "STUB: Remotion Lambda not configured (REMOTION_LAMBDA_FUNCTION_NAME/REGION/BUCKET). Spec saved; render will run once configured.",
  })

  // If project was pending_approval, keep it there — approval always approves the current version
  revalidatePath("/")
  return { ok: true as const, stubbed: !(await isRemotionConfigured()) }
}
