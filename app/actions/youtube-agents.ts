"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { videoProjects, videoScripts, pipelineSettings, generationJobs, notifications } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { generateText } from "ai"
import { getModel } from "@/lib/llm"
import { isHiggsfieldConfigured, submitGeneration } from "@/lib/higgsfield"
import { randomUUID } from "crypto"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/**
 * Script Composer (Task 3) — topic -> premise + script + shot breakdown.
 * System prompt parameterized from pipeline_settings, never hardcoded.
 */
export async function composeScript(projectId: string) {
  const userId = await getUserId()
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
    .limit(1)
  if (!project) throw new Error("Project not found")

  await db.update(videoProjects).set({ status: "scripting", updatedAt: new Date() }).where(eq(videoProjects.id, projectId))

  const [settings] = await db.select().from(pipelineSettings).where(eq(pipelineSettings.userId, userId)).limit(1)

  try {
    const { text } = await generateText({
      model: getModel("heavy"), // youtube.script_compose — long-form creative structure
      system: `You are a YouTube script composer for: ${settings?.contentDomain || "general content"}.
Tone/voice notes: ${settings?.toneVoiceNotes || "engaging, punchy, hook-first"}.
Video format: ${project.videoFormat} (${project.videoFormat === "shorts" ? "15-60 seconds, vertical" : "3-15 minutes"}).
Output STRICT JSON with keys: "premise" (one-sentence hook premise), "script" (full narration script), "shotBreakdown" (array of {shot, visualDescription, durationSeconds}). No markdown fences, JSON only.`,
      prompt: `Topic: ${project.topic}`,
    })

    const cleaned = text.replace(/^```(json)?/m, "").replace(/```$/m, "").trim()
    const parsed = JSON.parse(cleaned) as { premise: string; script: string; shotBreakdown: unknown }

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
      scriptText: parsed.script,
      shotBreakdown: JSON.stringify(parsed.shotBreakdown ?? []),
      createdBy: "ai",
    })
    await db
      .update(videoProjects)
      .set({ premise: parsed.premise, status: "script_ready", updatedAt: new Date() })
      .where(eq(videoProjects.id, projectId))
    revalidatePath("/")
    return { ok: true as const }
  } catch (e) {
    await db
      .update(videoProjects)
      .set({ status: "failed", errorMessage: e instanceof Error ? e.message : "Script composition failed", updatedAt: new Date() })
      .where(eq(videoProjects.id, projectId))
    revalidatePath("/")
    return { ok: false as const, error: e instanceof Error ? e.message : "failed" }
  }
}

/**
 * Prompt Builder (Task 3) — shot breakdown -> Higgsfield generation prompt,
 * then submits the generation job (Task 4). If Higgsfield isn't configured,
 * the job is created in a clearly-stubbed failed state with an honest message.
 */
export async function buildPromptAndGenerate(projectId: string) {
  const userId = await getUserId()
  const [project] = await db
    .select()
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, userId)))
    .limit(1)
  if (!project) throw new Error("Project not found")
  if (project.status !== "script_ready") throw new Error(`Project must be script_ready (is: ${project.status})`)

  const [script] = await db
    .select()
    .from(videoScripts)
    .where(eq(videoScripts.videoProjectId, projectId))
    .orderBy(desc(videoScripts.revisionNumber))
    .limit(1)
  if (!script) throw new Error("No script revision found")

  const { text: videoPrompt } = await generateText({
    model: getModel("standard"), // youtube.prompt_builder — condensing, not deep reasoning
    system: `You are a video-generation prompt engineer. Convert the shot breakdown into ONE cohesive text-to-video prompt (max 900 chars) describing visuals, motion, pacing, and style for a ${project.videoFormat === "shorts" ? "vertical 9:16 short" : "16:9 long-form"} video. Output prompt text only.`,
    prompt: `Premise: ${project.premise}\nShot breakdown: ${script.shotBreakdown}`,
  })

  await db.update(videoProjects).set({ status: "prompt_ready", updatedAt: new Date() }).where(eq(videoProjects.id, projectId))

  const jobId = randomUUID()
  if (!isHiggsfieldConfigured()) {
    // Honest stub — never a fake green checkmark (§8)
    await db.insert(generationJobs).values({
      id: jobId,
      videoProjectId: projectId,
      promptSent: videoPrompt,
      status: "failed",
      errorMessage: "STUB: Higgsfield not configured (set HIGGSFIELD_API_KEY). Prompt built and saved; generation will run once configured.",
    })
    await db
      .update(videoProjects)
      .set({ status: "failed", errorMessage: "Higgsfield needs configuration", updatedAt: new Date() })
      .where(eq(videoProjects.id, projectId))
    revalidatePath("/")
    return { ok: false as const, error: "Higgsfield needs configuration — prompt saved, job stubbed." }
  }

  try {
    const higgsfieldJobId = await submitGeneration(videoPrompt, project.videoFormat as "shorts" | "long_form")
    await db.insert(generationJobs).values({
      id: jobId,
      videoProjectId: projectId,
      higgsfieldJobId,
      promptSent: videoPrompt,
      status: "submitted",
    })
    await db.update(videoProjects).set({ status: "generating", updatedAt: new Date() }).where(eq(videoProjects.id, projectId))
    revalidatePath("/")
    return { ok: true as const }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation submit failed"
    await db.insert(generationJobs).values({ id: jobId, videoProjectId: projectId, promptSent: videoPrompt, status: "failed", errorMessage: msg })
    await db.update(videoProjects).set({ status: "failed", errorMessage: msg, updatedAt: new Date() }).where(eq(videoProjects.id, projectId))
    await db.insert(notifications).values({ userId, type: "job_failed", message: `Generation failed for "${project.topic}": ${msg}` })
    revalidatePath("/")
    return { ok: false as const, error: msg }
  }
}
