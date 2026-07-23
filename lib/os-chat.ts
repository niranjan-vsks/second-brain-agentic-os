/**
 * Chat-with-your-OS engine (§7) — text-to-SQL, NOT RAG. Shared by the web chat
 * action and the Telegram webhook. Read-only, userId-scoped, audited.
 *
 * Hard constraints enforced IN CODE, not just the prompt:
 *  - single SELECT statement only (no writes, no DDL, no multiple statements)
 *  - only allowlisted tables
 *  - must be parameterized on $1 (userId injected server-side, never from the model)
 */
import { pool, db } from "@/lib/db"
import { osChatMessages } from "@/lib/db/schema"
import { generateText } from "ai"
import { getModelForUser } from "@/lib/llm"
import { randomUUID } from "crypto"

// Compact schema description — column names/types only, no data.
// Exported for the Jarvis tool-loop (lib/jarvis.ts), which reuses the same
// hardened text-to-SQL path as one of its tools.
export const SCHEMA_DESCRIPTION = `
Tables (Postgres, quoted camelCase columns — always double-quote column names):
topics(id int, "userId" text, track, title, description, priority int, status, "createdAt")
study_sessions(id int, "userId" text, "topicId" int, day, "plannedMinutes" int, "actualMinutes" int, focus, done bool, "createdAt")
leads(id int, "userId" text, name, company, channel, status, "lastTouch", "nextFollowUp", notes, "createdAt")
deals(id int, "userId" text, "clientName", platform, status, "valueUsd" numeric, notes, "createdAt", "updatedAt")
artifacts(id int, "userId" text, "dealId" int, "artifactType", title, content, "createdAt")
trend_items(id int, "userId" text, source, title, url, summary, "discoveredAt")
linkedin_posts(id int, "userId" text, "trendItemId" int, status, "currentText", "scheduledFor", "postedAt", "createdAt")
draft_revisions(id int, "postId" int, "revisionNumber" int, "textContent", "createdBy", "createdAt")
notifications(id int, "userId" text, type, message, read bool, "createdAt")
youtube_channels(id text, "userId" text, "channelName", "youtubeChannelId", status, "createdAt")
pipeline_settings(id text, "userId" text, "contentDomain", "toneVoiceNotes", "redFlagTerms", "defaultBypassApproval" bool, "videoFormatDefault")
video_projects(id text, "userId" text, "channelId" text, topic, premise, status, "videoFormat", "batchId", "bypassApproval" bool, "autoPublished" bool, "createdAt", "updatedAt")
video_scripts(id text, "videoProjectId" text, "revisionNumber" int, "scriptText", "shotBreakdown", "createdBy", "createdAt")
generation_jobs(id text, "videoProjectId" text, "higgsfieldJobId", "promptSent", status, "blobUrl", "createdAt")
youtube_videos(id text, "videoProjectId" text, "channelId" text, "youtubeVideoId", title, "uploadStatus", "publishedAt", "createdAt")
youtube_metrics(id text, "youtubeVideoId" text, views int, likes int, comments int, "watchTimeMinutes" int, "polledAt")
ad_creatives(id text, "userId" text, "dealId" text, "creativeType", premise, script, status, "createdAt")
edit_requests(id text, "userId" text, "videoProjectId" text, "editPrompt", status, "createdAt")
edit_versions(id text, "userId" text, "videoProjectId" text, "versionNumber" int, "isCurrent" bool, "createdAt")
job_applications(id text, "userId" text, company, "roleTitle", "roleFamily", "jobUrl", "portalSource", geography, "compensationRange", status, "evaluationScore" numeric, "legitimacyTier", "createdAt", "updatedAt")
evaluation_reports(id text, "jobApplicationId" text, "blockA_roleSummary", "blockB_cvMatch", "blockC_levelStrategy", "blockD_compDemand", "createdAt")
interview_stories(id text, "userId" text, situation, task, action, result, reflection, "relatedRequirementTags", "createdAt")
scan_history(id text, "userId" text, url, "portalSource", status, "firstSeen", "createdAt")
company_research(id text, "userId" text, company, "researchNotes", "createdAt")
contacts(id text, "userId" text, "jobApplicationId" text, company, name, role, source, "createdAt")
outreach_messages(id text, "userId" text, "contactId" text, "jobApplicationId" text, "messageType", content, status, "sentAt", "createdAt")
resumes(id text, "userId" text, label, "createdAt")
resume_versions(id text, "resumeId" text, "jobApplicationId" text, "versionNumber" int, "changeExplanation", "atsKeywordScore" int, "isCurrent" bool, "createdAt")
cover_letters(id text, "userId" text, "jobApplicationId" text, "createdAt")
cover_letter_versions(id text, "coverLetterId" text, "versionNumber" int, "isCurrent" bool, "createdAt")
payment_instruments(id text, "userId" text, label, "instrumentType", issuer, network, "lastFour", "upiHandle", notes, "isActive" bool, "createdAt")
autopays(id text, "userId" text, "instrumentId" text, merchant, description, rail, "amountINR" numeric, cadence, "nextChargeDate" date, status, "reminderDaysBefore" int, "createdAt")
Tables WITHOUT a "userId" column (video_scripts, generation_jobs, youtube_videos, youtube_metrics, draft_revisions, evaluation_reports, resume_versions, cover_letter_versions) must be JOINed through their parent table which is filtered by "userId" = $1.
`

const ALLOWED_TABLES = new Set([
  "topics", "study_sessions", "leads", "deal_checklist", "assets", "deals", "artifacts", "trend_items", "linkedin_posts",
  "draft_revisions", "notifications", "youtube_channels", "pipeline_settings", "video_projects",
  "video_scripts", "generation_jobs", "youtube_videos", "youtube_metrics", "ad_creatives",
  "edit_requests", "edit_versions",
  "job_applications", "evaluation_reports", "interview_stories", "scan_history", "company_research",
  "contacts", "outreach_messages", "resumes", "resume_versions", "cover_letters", "cover_letter_versions",
  "payment_instruments", "autopays",
])

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute|merge|vacuum|set|comment)\b/i

export function validateSql(sqlText: string): { ok: true; sql: string } | { ok: false; reason: string } {
  const sql = sqlText.trim().replace(/;+\s*$/, "")
  if (sql.includes(";")) return { ok: false, reason: "multiple statements" }
  if (!/^select\b/i.test(sql)) return { ok: false, reason: "not a SELECT" }
  if (FORBIDDEN.test(sql)) return { ok: false, reason: "forbidden keyword" }
  if (!sql.includes("$1")) return { ok: false, reason: "missing userId parameter ($1)" }
  const tables = [...sql.matchAll(/\b(?:from|join)\s+"?([a-z_]+)"?/gi)].map((m) => m[1].toLowerCase())
  for (const t of tables) {
    if (!ALLOWED_TABLES.has(t)) return { ok: false, reason: `table not allowed: ${t}` }
  }
  if (tables.length === 0) return { ok: false, reason: "no tables referenced" }
  return { ok: true, sql }
}

export async function answerOsQuestion(userId: string, question: string, channel: "web" | "telegram"): Promise<string> {
  await db.insert(osChatMessages).values({ id: randomUUID(), userId, channel, role: "user", content: question })

  let answer: string
  let sqlExecuted: string | null = null
  try {
    const { text: rawSql } = await generateText({
      model: await getModelForUser(userId, "standard"), // os_chat.text_to_sql — SQL generation
      system: `You translate questions about a personal operator OS into a single read-only Postgres SELECT query.
${SCHEMA_DESCRIPTION}
Rules: output ONLY the SQL, no fences, no explanation. Exactly one SELECT. Every table with a "userId" column MUST be filtered with "userId" = $1. LIMIT results to 50 rows max. Use double quotes around camelCase identifiers.`,
      prompt: question,
    })

    const candidate = rawSql.replace(/^```(sql)?/m, "").replace(/```$/m, "").trim()
    const validation = validateSql(candidate)
    if (!validation.ok) {
      answer = `I couldn't answer that safely (query rejected: ${validation.reason}). Try rephrasing as a question about your data.`
    } else {
      sqlExecuted = validation.sql
      const result = await pool.query(validation.sql, [userId])
      const rows = result.rows.slice(0, 50)
      const { text } = await generateText({
        model: await getModelForUser(userId, "light"), // os_chat.summarize_rows — formatting task
        system: "Turn this SQL result into a concise plain-English answer to the user's question. If empty, say so plainly. No markdown tables unless helpful.",
        prompt: `Question: ${question}\nRows (JSON): ${JSON.stringify(rows).slice(0, 8000)}`,
      })
      answer = text
    }
  } catch (e) {
    answer = `Something went wrong answering that: ${e instanceof Error ? e.message : "unknown error"}`
  }

  await db.insert(osChatMessages).values({ id: randomUUID(), userId, channel, role: "assistant", content: answer, sqlExecuted })
  return answer
}
