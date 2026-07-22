import "server-only"
// Job-Hunt Engine · Node 4 · EMISSARY (agent key jobhunt.emissary, standard)
// Synchronized humanized outreach after apply: a cold email (portfolio 2-3
// liner + tracking id + screenshot-as-proof) and a LinkedIn DM draft.
//
// REVIEW GATE is on the FINAL DRAFT (per operator's model): drafts are always
// produced + saved; the email SENDS only when jobhunt.emissary autonomy = auto
// AND an email provider is configured AND a manager email exists. LinkedIn has
// no send API — always draft-only (HITL), consistent with the app constitution.

import { randomUUID } from "crypto"
import { generateText } from "ai"
import { db } from "@/lib/db"
import { jobApplications, jobHuntRuns } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getModel } from "@/lib/llm"
import { getAutonomy } from "@/lib/agent-graph"
import { getAgentOverride, directiveBlock } from "@/lib/config"
import { skillsBlockFor } from "@/lib/skills"
import { isEmailConfigured, sendEmail } from "@/lib/email"
import { readPacket, type JobHuntPacket } from "@/lib/jobhunt/types"
import { PORTFOLIO_CONTEXT } from "@/lib/jobhunt/portfolio-context"

interface EmailDraft {
  subject: string
  body: string
}

/** Explicit operator approval: send the already-drafted email now. */
export async function sendDraftedOutreach(
  userId: string,
  jobId: string,
): Promise<{ ok: boolean; message: string }> {
  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) return { ok: false, message: "Job not found" }
  const packet = readPacket(job.jobhunt)
  const to = packet.hiringManager?.email
  const draft = packet.emailDraft
  if (!draft?.subject || !draft?.body) return { ok: false, message: "No email draft — run Emissary first." }
  if (!to) return { ok: false, message: "No manager email — run Enricher first." }
  if (!(await isEmailConfigured(userId))) return { ok: false, message: "Email not configured (Resend key + EMAIL_FROM)." }

  const sent = await sendEmail(userId, {
    to,
    subject: draft.subject,
    text: `${draft.body}\n\n${packet.confirmationScreenshotUrl ? `Application confirmation: ${packet.confirmationScreenshotUrl}` : ""}`,
  })
  if (!sent.ok) return { ok: false, message: sent.error }
  await db
    .update(jobApplications)
    .set({ jobhunt: { ...packet, emailStatus: "sent", outreachAt: new Date().toISOString() } as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(jobApplications.id, jobId))
  return { ok: true, message: `Sent to ${to}` }
}

export async function runEmissary(
  userId: string,
  jobId: string,
  trigger: "manual" | "cron" | "jarvis" = "manual",
): Promise<{ ok: boolean; message: string; emailStatus: "draft" | "sent" | "skipped" }> {
  const runId = randomUUID()
  await db.insert(jobHuntRuns).values({ id: runId, userId, node: "emissary", trigger, status: "running" })

  const [job] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, jobId), eq(jobApplications.userId, userId)))
    .limit(1)
  if (!job) {
    await db.update(jobHuntRuns).set({ status: "failed", detail: "job not found" }).where(eq(jobHuntRuns.id, runId))
    return { ok: false, message: "Job not found", emailStatus: "skipped" }
  }

  const packet = readPacket(job.jobhunt)
  const manager = packet.hiringManager
  const override = await getAgentOverride(userId, "career_outreach")
  const skills = await skillsBlockFor(userId, "career_outreach") // humanize skill lands here

  try {
    // Compose email + LinkedIn DM in one call (JSON), humanized, portfolio-aware.
    const { text } = await generateText({
      model: getModel("standard"), // jobhunt.emissary — outreach drafting
      system: `You write high-intent, HUMAN-sounding job-application outreach for a Senior Agentic AI / Forward Deployed Engineer. No AI-tells, no rigid structure, no "I hope this finds you well", no em-dash walls. Warm, specific, confident, concise.

${PORTFOLIO_CONTEXT}

Output STRICT JSON:
{
 "subject": "<6-9 word email subject, specific to the role/company>",
 "emailBody": "<short cold email. Reference the specific role + company. State the application is already submitted (proof: tracking id + confirmation screenshot attached). Include a 2-3 line 'how to use my portfolio' with 2-3 deep links matching THIS role. One clear CTA. Sign off as the candidate. Plain text.>",
 "linkedin": "<crisp <=400-char LinkedIn DM to the manager: reference something specific, mention the application, one soft ask. No pitch-dump.>"
}
JSON only, no fences.${directiveBlock(override)}${skills}`,
      prompt: `ROLE: ${job.roleTitle} @ ${job.company}
JD EXCERPT: ${(job.jobDescription || "").slice(0, 1500)}
HIRING MANAGER: ${manager ? `${manager.name} (${manager.title})` : "unknown — address generically to the hiring team"}
APPLICATION TRACKING ID: ${packet.trackingId ?? "(none)"}
CONFIRMATION SCREENSHOT: ${packet.confirmationScreenshotUrl ? "attached/available" : "not available"}`,
    })

    const cleaned = text.replace(/```json?|```/g, "").trim()
    const parsed = JSON.parse(cleaned) as { subject?: string; emailBody?: string; linkedin?: string }
    const emailDraft: EmailDraft = { subject: (parsed.subject ?? "").slice(0, 200), body: (parsed.emailBody ?? "").slice(0, 4000) }
    const linkedinDraft = (parsed.linkedin ?? "").slice(0, 700)

    // Review gate on the final draft: send only when graduated to auto + configured.
    const autonomy = await getAutonomy(userId, "jobhunt.emissary")
    let emailStatus: "draft" | "sent" | "skipped" = "draft"
    let sendNote = "saved as draft for your review"
    if (autonomy === "auto" && manager?.email && (await isEmailConfigured(userId))) {
      const sent = await sendEmail(userId, {
        to: manager.email,
        subject: emailDraft.subject,
        text: `${emailDraft.body}\n\n${packet.confirmationScreenshotUrl ? `Application confirmation: ${packet.confirmationScreenshotUrl}` : ""}`,
      })
      if (sent.ok) {
        emailStatus = "sent"
        sendNote = `email sent to ${manager.email}`
      } else {
        sendNote = `send failed (${sent.error}) — kept as draft`
      }
    } else if (autonomy === "auto" && !manager?.email) {
      sendNote = "auto mode but no manager email — run Enricher first; kept as draft"
    }

    const nextPacket: JobHuntPacket = {
      ...packet,
      emailDraft,
      linkedinDraft,
      emailStatus,
      outreachAt: new Date().toISOString(),
    }
    await db
      .update(jobApplications)
      .set({
        jobhunt: nextPacket as unknown as Record<string, unknown>,
        status: job.status === "applied" ? "responded" : job.status, // nudge forward only post-apply
        updatedAt: new Date(),
      })
      .where(eq(jobApplications.id, jobId))

    await db
      .update(jobHuntRuns)
      .set({ status: "completed", found: emailStatus === "sent" ? 1 : 0, detail: sendNote })
      .where(eq(jobHuntRuns.id, runId))
    return { ok: true, message: sendNote, emailStatus }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "outreach failed"
    await db.update(jobHuntRuns).set({ status: "failed", detail: msg }).where(eq(jobHuntRuns.id, runId))
    return { ok: false, message: msg, emailStatus: "skipped" }
  }
}
