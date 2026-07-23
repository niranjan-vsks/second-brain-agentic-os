"use server"

// Career Intelligence agents (doc 08 Tasks 3/5/6) — evaluation (Blocks A-H),
// tailoring, contacto, deep research, apply assist, auto-pipeline orchestrator.
// All LLM calls go through getModel() (lib/llm.ts seam). All prompts ported
// from the real career-ops repo via doc 09 — never re-derived.

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  jobApplications,
  evaluationReports,
  interviewStories,
  careerSettings,
  careerContacts,
  outreachMessages,
  resumes,
  resumeVersions,
  coverLetters,
  coverLetterVersions,
  companyResearch,
} from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { generateText } from "ai"
import { getModelForUser } from "@/lib/llm"
import { getAgentOverride, directiveBlock } from "@/lib/config"
import { skillsBlockFor } from "@/lib/skills"
import { randomUUID } from "crypto"
import {
  EVALUATION_PROMPT,
  TAILORING_PROMPT,
  CONTACTO_PROMPT,
  DEEP_RESEARCH_PROMPT_GENERATOR,
  DEEP_RESEARCH_SYNTHESIS_PROMPT,
  APPLY_ASSIST_PROMPT,
  SCORE_APPLY_IMMEDIATELY,
} from "@/lib/career-prompts"
import { isSearchConfigured, webSearch, fetchPage } from "@/lib/search"
import { normalizeForAts } from "@/lib/career/browser-worker"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(json)?/m, "").replace(/```\s*$/m, "").trim()
  return JSON.parse(cleaned) as T
}

async function getCandidateContext(userId: string) {
  const [settings] = await db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1)
  const allResumes = await db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.createdAt))
  const master = allResumes[0]
  const stories = await db.select().from(interviewStories).where(eq(interviewStories.userId, userId)).limit(20)
  const portfolioLine =
    settings?.portfolioUrl && settings.portfolioLive
      ? `Portfolio: ${settings.portfolioUrl}`
      : "" // omit-if-empty rule (Task 0.7): never reference an unset/unlive portfolio
  return {
    settings: settings ?? null,
    masterResume: master ?? null,
    cvBlock: master
      ? `CANDIDATE CV (source of truth, cite exact lines):\n${master.baseContent}\n${portfolioLine}`
      : "CANDIDATE CV: NOT YET UPLOADED — refuse to fabricate; state clearly that the master resume must be added in Career Settings first.",
    storiesBlock:
      stories.length > 0
        ? `STORY BANK (reuse before inventing):\n${stories
            .map((s) => `- [${s.relatedRequirementTags}] S:${s.situation} T:${s.task} A:${s.action} R:${s.result} Reflection:${s.reflection}`)
            .join("\n")}`
        : "STORY BANK: empty.",
  }
}

// --- JD extraction (auto-pipeline entry: URL or pasted text) --------------------

export async function extractJobFromUrl(jobId: string) {
  const userId = await getUserId()
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")
  if (!job.jobUrl) return { ok: false as const, error: "No URL on this job — paste the JD manually." }
  try {
    const text = await fetchPage(job.jobUrl, userId) // crawl4ai preferred, plain fetch fallback
    await db.update(jobApplications).set({ jobDescription: text.slice(0, 25000), updatedAt: new Date() }).where(eq(jobApplications.id, jobId))
    revalidatePath("/")
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "extraction failed" }
  }
}

// --- Evaluation (oferta mode, Blocks A-H) ----------------------------------------

export async function evaluateJob(jobId: string) {
  const userId = await getUserId()
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")
  if (!job.jobDescription || job.jobDescription.length < 100) {
    return { ok: false as const, error: "Job description missing or too short — paste it or run Extract JD first." }
  }

  const ctx = await getCandidateContext(userId)
  if (!ctx.masterResume) {
    return { ok: false as const, error: "Master resume not uploaded — add it in Career Settings first (Task 0.1 gate)." }
  }

  await db.update(jobApplications).set({ status: "evaluating", updatedAt: new Date() }).where(eq(jobApplications.id, jobId))

  // Optional comp research (Block D) — only when a search provider is configured
  let compResearch = ""
  if (await isSearchConfigured(userId)) {
    try {
      const results = await webSearch(userId, `${job.roleTitle} salary ${job.geography || "remote"} ${job.company} glassdoor levels.fyi`, 5)
      compResearch = `COMP RESEARCH RESULTS:\n${results.map((r) => `- ${r.title} (${r.url}): ${r.snippet}`).join("\n")}`
    } catch {
      compResearch = ""
    }
  }

  try {
    const { text } = await generateText({
      model: await getModelForUser(userId, "heavy", "career.evaluate"), // career.evaluate — multi-constraint rubric reasoning
      system: EVALUATION_PROMPT,
      prompt: `${ctx.cvBlock}\n\n${ctx.storiesBlock}\n\nCANDIDATE SETTINGS: role families: ${ctx.settings?.enabledRoleFamilies || "not set"} · geographies: ${ctx.settings?.enabledGeographies || "not set"} · comp floor domestic: INR ${ctx.settings?.compFloorDomesticINR} · comp floor intl: ${ctx.settings?.compFloorIntlMonthly} ${ctx.settings?.compIntlCurrency}/month\n\n${compResearch}\n\nJOB: ${job.roleTitle} @ ${job.company}\nURL: ${job.jobUrl}\nGEOGRAPHY: ${job.geography}\n\nJOB DESCRIPTION:\n${job.jobDescription}`,
    })

    const parsed = parseJson<{
      archetype: string
      blockA_roleSummary: string
      blockB_cvMatch: string
      blockC_levelStrategy: string
      blockD_compDemand: string
      blockE_personalizationPlan: string
      blockF_interviewPlan: string
      legitimacyTier: string
      legitimacySignals: string
      scores: { global: number }
      extractedKeywords: string
      blockH_draftAnswers: string
    }>(text)

    const reportId = randomUUID()
    await db.insert(evaluationReports).values({
      id: reportId,
      jobApplicationId: jobId,
      blockA_roleSummary: parsed.blockA_roleSummary,
      blockB_cvMatch: parsed.blockB_cvMatch,
      blockC_levelStrategy: parsed.blockC_levelStrategy,
      blockD_compDemand: parsed.blockD_compDemand,
      blockE_personalizationPlan: parsed.blockE_personalizationPlan,
      blockF_interviewPlan: parsed.blockF_interviewPlan,
      blockH_draftAnswers: parsed.blockH_draftAnswers || null,
    })

    const score = Math.max(1, Math.min(5, parsed.scores.global))
    await db
      .update(jobApplications)
      .set({
        status: "evaluated",
        archetype: parsed.archetype,
        evaluationScore: score.toFixed(1),
        legitimacyTier: parsed.legitimacyTier,
        legitimacySignals: parsed.legitimacySignals,
        extractedKeywords: parsed.extractedKeywords,
        evaluationReportId: reportId,
        updatedAt: new Date(),
      })
      .where(eq(jobApplications.id, jobId))

    // Auto-shortlist per settings threshold
    const threshold = Number(ctx.settings?.autoShortlistThreshold ?? 3.5)
    if (score >= threshold) {
      await db.update(jobApplications).set({ status: "shortlisted", updatedAt: new Date() }).where(eq(jobApplications.id, jobId))
    }

    revalidatePath("/")
    return { ok: true as const, score, reportId }
  } catch (e) {
    await db.update(jobApplications).set({ status: "discovered", updatedAt: new Date() }).where(eq(jobApplications.id, jobId))
    revalidatePath("/")
    return { ok: false as const, error: e instanceof Error ? e.message : "Evaluation failed" }
  }
}

// --- Tailoring (pdf mode content pipeline; PDF render via browser worker) ---------

export async function tailorResume(jobId: string) {
  const userId = await getUserId()
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")
  const ctx = await getCandidateContext(userId)
  if (!ctx.masterResume) return { ok: false as const, error: "Master resume not uploaded." }
  if (!job.jobDescription) return { ok: false as const, error: "No JD on this job." }

  const [report] = await db
    .select()
    .from(evaluationReports)
    .where(eq(evaluationReports.jobApplicationId, jobId))
    .orderBy(desc(evaluationReports.createdAt))
    .limit(1)

  try {
    const { text } = await generateText({
      model: await getModelForUser(userId, "heavy", "career.tailor_resume"), // career.tailor_resume — never-fabricate constitution
      system: TAILORING_PROMPT,
      prompt: `${ctx.cvBlock}\n\nEXTRACTED ATS KEYWORDS: ${job.extractedKeywords ?? "none — extract from JD"}\n\nPERSONALIZATION PLAN (from evaluation): ${report?.blockE_personalizationPlan ?? "none"}\n\nJOB: ${job.roleTitle} @ ${job.company}\n\nJOB DESCRIPTION:\n${job.jobDescription}`,
    })
    const parsed = parseJson<{
      tailoredResume: string
      changeExplanation: string
      coverLetter: string
      coverLetterExplanation: string
    }>(text)

    // Deterministic ATS keyword coverage check (doc 04): literal matching, zero tokens
    const keywords = (job.extractedKeywords ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
    const resumeLower = parsed.tailoredResume.toLowerCase()
    const matched = keywords.filter((k) => resumeLower.includes(k.toLowerCase()))
    const missing = keywords.filter((k) => !resumeLower.includes(k.toLowerCase()))
    const atsScore = keywords.length > 0 ? Math.round((matched.length / keywords.length) * 100) : null

    const [latestVersion] = await db
      .select({ versionNumber: resumeVersions.versionNumber })
      .from(resumeVersions)
      .where(eq(resumeVersions.jobApplicationId, jobId))
      .orderBy(desc(resumeVersions.versionNumber))
      .limit(1)

    await db
      .update(resumeVersions)
      .set({ isCurrent: false })
      .where(and(eq(resumeVersions.jobApplicationId, jobId), eq(resumeVersions.isCurrent, true)))

    await db.insert(resumeVersions).values({
      id: randomUUID(),
      resumeId: ctx.masterResume.id,
      jobApplicationId: jobId,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      content: normalizeForAts(parsed.tailoredResume),
      changeExplanation: parsed.changeExplanation,
      atsKeywordScore: atsScore,
      atsKeywordsMatched: matched.join(", "),
      atsKeywordsMissing: missing.join(", "),
      createdBy: "ai",
    })

    // Cover letter (ALWAYS rule from _shared.md)
    let [cl] = await db
      .select()
      .from(coverLetters)
      .where(and(eq(coverLetters.jobApplicationId, jobId), eq(coverLetters.userId, userId)))
      .limit(1)
    if (!cl) {
      const clId = randomUUID()
      await db.insert(coverLetters).values({ id: clId, userId, jobApplicationId: jobId })
      cl = { id: clId, userId, jobApplicationId: jobId, createdAt: new Date() }
    }
    const [latestClv] = await db
      .select({ versionNumber: coverLetterVersions.versionNumber })
      .from(coverLetterVersions)
      .where(eq(coverLetterVersions.coverLetterId, cl.id))
      .orderBy(desc(coverLetterVersions.versionNumber))
      .limit(1)
    await db
      .update(coverLetterVersions)
      .set({ isCurrent: false })
      .where(and(eq(coverLetterVersions.coverLetterId, cl.id), eq(coverLetterVersions.isCurrent, true)))
    await db.insert(coverLetterVersions).values({
      id: randomUUID(),
      coverLetterId: cl.id,
      versionNumber: (latestClv?.versionNumber ?? 0) + 1,
      content: normalizeForAts(parsed.coverLetter),
      changeExplanation: parsed.coverLetterExplanation,
      createdBy: "ai",
    })

    if (job.status === "shortlisted" || job.status === "evaluated") {
      await db.update(jobApplications).set({ status: "tailored", updatedAt: new Date() }).where(eq(jobApplications.id, jobId))
    }
    revalidatePath("/")
    return { ok: true as const, atsScore, missing }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Tailoring failed" }
  }
}

// --- Contacto (4-type outreach) -----------------------------------------------------

export async function generateOutreach(input: {
  jobId: string
  contactName: string
  contactRole: "recruiter" | "hiring_manager" | "peer" | "interviewer"
  contactContext: string
}) {
  const userId = await getUserId()
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, input.jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")
  const ctx = await getCandidateContext(userId)
  const outreachOverride = await getAgentOverride(userId, "career_outreach") // Jarvis-set operator directives
  const outreachSkills = await skillsBlockFor(userId, "career_outreach") // Arsenal skills

  try {
    const { text } = await generateText({
      model: await getModelForUser(userId, "standard", "career.outreach"), // career.outreach — prose drafting
      system: CONTACTO_PROMPT + directiveBlock(outreachOverride) + outreachSkills,
      prompt: `${ctx.cvBlock}\n\nJOB: ${job.roleTitle} @ ${job.company}\nJD EXCERPT: ${job.jobDescription.slice(0, 3000)}\n\nCONTACT: ${input.contactName} — type: ${input.contactRole}\nCONTEXT ABOUT THIS CONTACT: ${input.contactContext || "none provided"}`,
    })
    const parsed = parseJson<{ message: string; alternativeTargets: string }>(text)

    // Enforce the 300-char LinkedIn limit at generation time (doc 09 rule)
    const message = parsed.message.length > 300 ? parsed.message.slice(0, 297) + "..." : parsed.message

    const contactId = randomUUID()
    await db.insert(careerContacts).values({
      id: contactId,
      userId,
      jobApplicationId: input.jobId,
      company: job.company,
      name: input.contactName,
      role: input.contactRole,
      source: "manual",
    })
    await db.insert(outreachMessages).values({
      id: randomUUID(),
      userId,
      contactId,
      jobApplicationId: input.jobId,
      messageType: "linkedin_message",
      content: message,
      status: "draft",
    })
    if (job.status === "tailored") {
      await db.update(jobApplications).set({ status: "outreach_prepared", updatedAt: new Date() }).where(eq(jobApplications.id, input.jobId))
    }
    revalidatePath("/")
    return { ok: true as const, message, alternativeTargets: parsed.alternativeTargets }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Outreach generation failed" }
  }
}

// --- Deep research (auto-execute with prompt-generator fallback, Task 0.4) -----------

export async function deepResearch(company: string, jobId?: string) {
  const userId = await getUserId()
  const ctx = await getCandidateContext(userId)
  const candidateAngle = ctx.masterResume ? ctx.cvBlock.slice(0, 4000) : "Candidate profile not yet uploaded."

  if (!(await isSearchConfigured(userId))) {
    // Fallback: generate the paste-into-Perplexity prompt (original deep mode behavior)
    try {
      const { text } = await generateText({
        model: await getModelForUser(userId, "standard", "career.deep_research"), // career.deep_research (prompt-generator fallback)
        system: DEEP_RESEARCH_PROMPT_GENERATOR,
        prompt: `COMPANY: ${company}\n\nCANDIDATE PROFILE:\n${candidateAngle}`,
      })
      const id = randomUUID()
      await db.insert(companyResearch).values({
        id,
        userId,
        company,
        researchNotes: `[PROMPT-GENERATOR MODE — no search provider configured. Paste the prompt below into Perplexity/ChatGPT, then save the results here.]\n\n${text}`,
      })
      revalidatePath("/")
      return { ok: true as const, mode: "prompt_generated" as const, id }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Prompt generation failed" }
    }
  }

  // Auto-execute: 6-axis search + synthesis
  try {
    const queries = [
      `${company} AI strategy`,
      `${company} funding layoffs news ${new Date().getFullYear()}`,
      `${company} engineering blog culture tech stack`,
      `${company} competitors differentiation`,
    ]
    const allResults = (await Promise.all(queries.map((q) => webSearch(userId, q, 4).catch(() => [])))).flat()
    const { text } = await generateText({
      model: await getModelForUser(userId, "heavy", "career.deep_research"), // career.deep_research — multi-source synthesis
      system: DEEP_RESEARCH_SYNTHESIS_PROMPT,
      prompt: `COMPANY: ${company}\n\nCANDIDATE PROFILE:\n${candidateAngle}\n\nSEARCH RESULTS:\n${allResults.map((r) => `- ${r.title} (${r.url}): ${r.snippet}`).join("\n")}`,
    })
    const id = randomUUID()
    await db.insert(companyResearch).values({ id, userId, company, researchNotes: text })
    revalidatePath("/")
    return { ok: true as const, mode: "executed" as const, id }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Research failed" }
  }
}

export async function getCompanyResearch() {
  const userId = await getUserId()
  return db.select().from(companyResearch).where(eq(companyResearch.userId, userId)).orderBy(desc(companyResearch.createdAt)).limit(30)
}

// --- Apply assist (paste-based, never submits) ----------------------------------------

export async function applyAssist(jobId: string, formQuestions: string) {
  const userId = await getUserId()
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")
  const ctx = await getCandidateContext(userId)
  const [report] = await db
    .select()
    .from(evaluationReports)
    .where(eq(evaluationReports.jobApplicationId, jobId))
    .orderBy(desc(evaluationReports.createdAt))
    .limit(1)

  try {
    const { text } = await generateText({
      model: await getModelForUser(userId, "standard", "career.apply_assist"), // career.apply_assist — grounded drafting
      system: APPLY_ASSIST_PROMPT,
      prompt: `${ctx.cvBlock}\n\nEVALUATION REPORT:\n${report ? `Block B: ${report.blockB_cvMatch}\nBlock H (pre-drafted answers): ${report.blockH_draftAnswers ?? "none"}` : "No evaluation report exists for this job."}\n\nJOB: ${job.roleTitle} @ ${job.company}\nJD: ${job.jobDescription.slice(0, 5000)}\n\nFORM QUESTIONS (pasted by candidate):\n${formQuestions}`,
    })
    const parsed = parseJson<{ answers: { question: string; answer: string }[]; roleMismatchWarning: string }>(text)
    return { ok: true as const, answers: parsed.answers, warning: parsed.roleMismatchWarning }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Apply assist failed" }
  }
}

// --- Auto-pipeline orchestrator (paste a JD, get everything — doc 09 auto-pipeline.md)
// If any step fails, continue with the rest and mark the failed step pending.

export async function runAutoPipeline(jobId: string) {
  const userId = await getUserId()
  const steps: Record<string, string> = {}

  // Agent Playground pause guard — Conductor is the auto-pipeline orchestrator.
  const { isAgentPaused } = await import("@/lib/agent-graph")
  if (await isAgentPaused(userId, "career.auto_pipeline")) {
    return { ok: false as const, error: "Conductor (auto-pipeline) is paused in the Agent Playground — resume it to run.", steps }
  }

  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")

  // Step 1: JD extraction if needed
  if ((!job.jobDescription || job.jobDescription.length < 100) && job.jobUrl) {
    const r = await extractJobFromUrl(jobId)
    steps.extract = r.ok ? "done" : `pending: ${r.error}`
  } else {
    steps.extract = job.jobDescription ? "done (already present)" : "pending: no JD and no URL"
  }

  // Step 2: Evaluation
  const evalResult = await evaluateJob(jobId)
  steps.evaluate = evalResult.ok ? `done (score ${evalResult.score})` : `pending: ${evalResult.error}`

  // Step 3: Tailoring — only if evaluation succeeded and score clears the settings threshold
  if (evalResult.ok) {
    const [settings] = await db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1)
    const threshold = Number(settings?.autoShortlistThreshold ?? 3.5)
    if (evalResult.score >= threshold) {
      const t = await tailorResume(jobId)
      steps.tailor = t.ok ? `done (ATS ${t.atsScore ?? "n/a"}%)` : `pending: ${t.error}`
    } else {
      steps.tailor = `skipped (score ${evalResult.score} below threshold ${threshold})`
    }
    steps.blockH = evalResult.score >= SCORE_APPLY_IMMEDIATELY ? "generated in evaluation" : "not generated (score < 4.5)"
  } else {
    steps.tailor = "skipped (evaluation pending)"
  }

  revalidatePath("/")
  return { ok: true as const, steps }
}
