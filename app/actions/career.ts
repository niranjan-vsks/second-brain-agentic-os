"use server"

// Career Intelligence CRUD + tracker (docs 02/07 of the PRD pack).
// Every query is userId-scoped. State machine transitions validated here.

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  careerSettings,
  jobApplications,
  evaluationReports,
  interviewStories,
  careerContacts,
  outreachMessages,
  resumes,
  resumeVersions,
  coverLetters,
  coverLetterVersions,
  scanHistory,
} from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { runZeroTokenScan, DEFAULT_TITLE_FILTERS, type TrackedCompany, type TitleFilters } from "@/lib/career/scanner"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// --- Settings ---------------------------------------------------------------

export async function saveCareerSettings(input: {
  enabledRoleFamilies: string
  enabledGeographies: string
  remotePreferences: string
  compFloorDomesticINR: number
  compStretchDomesticINR: number
  compFloorIntlMonthly: number
  compStretchIntlMonthly: number
  compIntlCurrency: string
  companyAllowlist: string
  companyDenylist: string
  portfolioUrl: string
  portfolioLive: boolean
  autoTailorOnMatch: boolean
  autoShortlistThreshold: string
  batchSizeLimit: number
  redFlagTerms: string
  toneVoiceNotes: string
}) {
  const userId = await getUserId()
  const [existing] = await db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1)
  if (existing) {
    await db.update(careerSettings).set({ ...input, updatedAt: new Date() }).where(eq(careerSettings.id, existing.id))
  } else {
    await db.insert(careerSettings).values({ id: randomUUID(), userId, ...input })
  }
  revalidatePath("/")
  return { ok: true as const }
}

export async function saveScannerConfig(input: { trackedCompanies: TrackedCompany[]; titleFilters: TitleFilters }) {
  const userId = await getUserId()
  const [existing] = await db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1)
  let extra: Record<string, unknown> = {}
  try {
    extra = existing ? JSON.parse(existing.extra) : {}
  } catch {
    extra = {}
  }
  extra.trackedCompanies = input.trackedCompanies
  extra.titleFilters = input.titleFilters
  if (existing) {
    await db.update(careerSettings).set({ extra: JSON.stringify(extra), updatedAt: new Date() }).where(eq(careerSettings.id, existing.id))
  } else {
    await db.insert(careerSettings).values({ id: randomUUID(), userId, extra: JSON.stringify(extra) })
  }
  revalidatePath("/")
  return { ok: true as const }
}

export async function getScannerConfigAction() {
  const userId = await getUserId()
  const [settings] = await db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1)
  let extra: Record<string, unknown> = {}
  try {
    extra = settings ? JSON.parse(settings.extra) : {}
  } catch {
    extra = {}
  }
  return {
    trackedCompanies: (Array.isArray(extra.trackedCompanies) ? extra.trackedCompanies : []) as TrackedCompany[],
    titleFilters: (extra.titleFilters ?? DEFAULT_TITLE_FILTERS) as TitleFilters,
  }
}

// --- Manual scan trigger ------------------------------------------------------

export async function triggerScan() {
  const userId = await getUserId()
  const result = await runZeroTokenScan(userId)
  revalidatePath("/")
  return result
}

export async function getScanHistory(limit = 50) {
  const userId = await getUserId()
  return db.select().from(scanHistory).where(eq(scanHistory.userId, userId)).orderBy(desc(scanHistory.createdAt)).limit(limit)
}

// --- Job applications: create / tracker transitions ---------------------------

// Valid transitions per docs 01 §4 + 09 §states.yml (8 canonical + pipeline states)
const VALID_TRANSITIONS: Record<string, string[]> = {
  discovered: ["evaluating", "discarded", "skip"],
  evaluating: ["evaluated", "discovered"],
  evaluated: ["shortlisted", "discarded", "skip", "applied"],
  shortlisted: ["tailored", "discarded", "skip"],
  tailored: ["outreach_prepared", "pending_approval", "applied", "discarded"],
  outreach_prepared: ["pending_approval", "applied", "discarded"],
  pending_approval: ["auto_approved", "applied", "discarded", "skip"],
  auto_approved: ["applied", "discarded"],
  applied: ["responded", "rejected", "discarded"],
  responded: ["interview", "rejected", "discarded"],
  interview: ["offer", "rejected", "discarded"],
  offer: ["rejected", "discarded"],
  rejected: [],
  discarded: ["discovered"],
  skip: ["discovered"],
}

export async function addJobManually(input: {
  company: string
  roleTitle: string
  jobUrl: string
  jobDescription: string
  geography: string
  portalSource: string
}) {
  const userId = await getUserId()
  const id = randomUUID()
  await db.insert(jobApplications).values({
    id,
    userId,
    company: input.company.trim(),
    roleTitle: input.roleTitle.trim(),
    jobUrl: input.jobUrl.trim(),
    jobDescription: input.jobDescription,
    geography: input.geography,
    portalSource: input.portalSource || "manual",
    status: "discovered",
  })
  revalidatePath("/")
  return { ok: true as const, id }
}

export async function transitionJob(jobId: string, toStatus: string) {
  const userId = await getUserId()
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")
  const allowed = VALID_TRANSITIONS[job.status] ?? []
  if (!allowed.includes(toStatus)) {
    throw new Error(`Invalid transition ${job.status} -> ${toStatus}`)
  }
  await db.update(jobApplications).set({ status: toStatus, updatedAt: new Date() }).where(eq(jobApplications.id, jobId))
  revalidatePath("/")
  return { ok: true as const }
}

// "Mark applied" is manual confirmation only — the system never submits (doc 09 apply.md hard rule)
export async function confirmApplied(jobId: string) {
  return transitionJob(jobId, "applied")
}

export async function updateJobDescription(jobId: string, jobDescription: string) {
  const userId = await getUserId()
  await db
    .update(jobApplications)
    .set({ jobDescription, updatedAt: new Date() })
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
  revalidatePath("/")
  return { ok: true as const }
}

// --- Reads for UI -------------------------------------------------------------

export async function getEvaluationReport(jobId: string) {
  const userId = await getUserId()
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) throw new Error("Job not found")
  const [report] = await db
    .select()
    .from(evaluationReports)
    .where(eq(evaluationReports.jobApplicationId, jobId))
    .orderBy(desc(evaluationReports.createdAt))
    .limit(1)
  return report ?? null
}

export async function getResumeVersionsForJob(jobId: string) {
  const userId = await getUserId()
  const [job] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) return []
  return db
    .select()
    .from(resumeVersions)
    .where(eq(resumeVersions.jobApplicationId, jobId))
    .orderBy(desc(resumeVersions.versionNumber))
}

export async function getCoverLetterForJob(jobId: string) {
  const userId = await getUserId()
  const [cl] = await db
    .select()
    .from(coverLetters)
    .where(and(eq(coverLetters.jobApplicationId, jobId), eq(coverLetters.userId, userId)))
    .limit(1)
  if (!cl) return null
  const versions = await db
    .select()
    .from(coverLetterVersions)
    .where(eq(coverLetterVersions.coverLetterId, cl.id))
    .orderBy(desc(coverLetterVersions.versionNumber))
  return { coverLetter: cl, versions }
}

export async function getContactsForJob(jobId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(careerContacts)
    .where(and(eq(careerContacts.jobApplicationId, jobId), eq(careerContacts.userId, userId)))
}

export async function getOutreachForJob(jobId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(outreachMessages)
    .where(and(eq(outreachMessages.jobApplicationId, jobId), eq(outreachMessages.userId, userId)))
    .orderBy(desc(outreachMessages.createdAt))
}

// --- Master resume -------------------------------------------------------------

export async function saveMasterResume(label: string, content: string) {
  const userId = await getUserId()
  const [existing] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.label, label)))
    .limit(1)
  if (existing) {
    await db.update(resumes).set({ baseContent: content }).where(eq(resumes.id, existing.id))
    revalidatePath("/")
    return { ok: true as const, id: existing.id }
  }
  const id = randomUUID()
  await db.insert(resumes).values({ id, userId, label, baseContent: content })
  revalidatePath("/")
  return { ok: true as const, id }
}

export async function getMasterResumes() {
  const userId = await getUserId()
  return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.createdAt))
}

// --- Story bank -----------------------------------------------------------------

export async function addInterviewStory(input: {
  situation: string
  task: string
  action: string
  result: string
  reflection: string
  relatedRequirementTags: string
}) {
  const userId = await getUserId()
  await db.insert(interviewStories).values({ id: randomUUID(), userId, ...input })
  revalidatePath("/")
  return { ok: true as const }
}

export async function deleteInterviewStory(storyId: string) {
  const userId = await getUserId()
  await db.delete(interviewStories).where(and(eq(interviewStories.id, storyId), eq(interviewStories.userId, userId)))
  revalidatePath("/")
  return { ok: true as const }
}

export async function getInterviewStories() {
  const userId = await getUserId()
  return db.select().from(interviewStories).where(eq(interviewStories.userId, userId)).orderBy(desc(interviewStories.createdAt))
}

// --- Outreach approval ------------------------------------------------------------

export async function approveOutreach(messageId: string) {
  const userId = await getUserId()
  await db
    .update(outreachMessages)
    .set({ status: "approved" })
    .where(and(eq(outreachMessages.id, messageId), eq(outreachMessages.userId, userId)))
  revalidatePath("/")
  return { ok: true as const }
}

export async function markOutreachSent(messageId: string) {
  const userId = await getUserId()
  await db
    .update(outreachMessages)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(outreachMessages.id, messageId), eq(outreachMessages.userId, userId)))
  revalidatePath("/")
  return { ok: true as const }
}
