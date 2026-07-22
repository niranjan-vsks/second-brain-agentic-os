import "server-only"
// Job-Hunt Engine · Node 1 · SOURCER (agent key jobhunt.sourcer, deterministic)
//
// Extends the zero-token ATS scanner (lib/career/scanner.ts) beyond structured
// ATS JSON APIs: crawls arbitrary CAREER PAGES + JOB BOARDS + remote boards
// (operator's curation list) via the crawl4ai seam, extracts job links whose
// anchor text matches the role keywords, dedups the SAME 3-way as the scanner,
// and stages matches into job_applications as `discovered` — the exact entry
// point the rest of the Career pipeline (Assessor → Tailor → Herald) already
// consumes. Result: sourced roles flow straight into the existing funnel.
//
// COST: crawl4ai returns markdown; link extraction is pure regex — ZERO LLM
// tokens, consistent with the app's observational-cost rule. Sourcing is
// read-only (only fills the discovered list), so it is always safe to run; the
// autonomy dial governs the DOWNSTREAM consequential nodes (apply, outreach).

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { jobApplications, scanHistory, jobHuntRuns } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { fetchPage } from "@/lib/search"
import { getConfig, JOBHUNT_DEFAULTS, type JobHuntConfig } from "@/lib/config"
import { getScannerConfig, DEFAULT_TITLE_FILTERS, type TitleFilters } from "@/lib/career/scanner"

export interface SourcerResult {
  runId: string
  boards: number
  found: number
  staged: number
  skipped: number
  errors: string[]
}

interface Candidate {
  title: string
  url: string
  board: string
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

function titlePasses(title: string, keywords: string[], filters: TitleFilters): boolean {
  const t = title.toLowerCase()
  if (filters.negative.some((n) => t.includes(n.toLowerCase()))) return false
  const positives = keywords.length > 0 ? keywords : filters.positive
  return positives.some((p) => t.includes(p.toLowerCase()))
}

/**
 * Extract candidate {title,url} pairs from a crawled page's markdown. Markdown
 * links look like `[anchor text](https://…)`. We keep links whose anchor reads
 * like a job title AND passes the keyword filter, resolving relative URLs
 * against the board origin.
 */
function extractJobLinks(markdown: string, boardUrl: string, boardName: string, keywords: string[], filters: TitleFilters): Candidate[] {
  const out: Candidate[] = []
  const seen = new Set<string>()
  let origin = ""
  try {
    origin = new URL(boardUrl).origin
  } catch {
    origin = ""
  }
  const linkRe = /\[([^\]]{4,120})\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g
  let m: RegExpExecArray | null = linkRe.exec(markdown)
  while (m !== null) {
    const anchor = m[1].replace(/\s+/g, " ").trim()
    let href = m[2]
    if (href.startsWith("/") && origin) href = origin + href
    const looksJobbish = /(job|career|position|role|opening|apply|gh_jid|lever|greenhouse|ashby|workday)/i.test(href) || titlePasses(anchor, keywords, filters)
    if (looksJobbish && titlePasses(anchor, keywords, filters) && href.startsWith("http") && !seen.has(href)) {
      seen.add(href)
      out.push({ title: anchor, url: href, board: boardName })
    }
    m = linkRe.exec(markdown)
  }
  return out
}

export async function runSourcer(userId: string, trigger: "manual" | "cron" | "jarvis" = "manual"): Promise<SourcerResult> {
  const cfg = await getConfig<JobHuntConfig>(userId, "jobhunt", JOBHUNT_DEFAULTS)
  const runId = randomUUID()
  await db.insert(jobHuntRuns).values({ id: runId, userId, node: "sourcer", trigger, status: "running" })

  const result: SourcerResult = { runId, boards: 0, found: 0, staged: 0, skipped: 0, errors: [] }

  if (trigger === "cron" && !cfg.enabled) {
    await db.update(jobHuntRuns).set({ status: "completed", detail: "disabled" }).where(eq(jobHuntRuns.id, runId))
    return result
  }
  if (cfg.boards.length === 0) {
    await db
      .update(jobHuntRuns)
      .set({ status: "completed", detail: "no boards configured — add career pages/boards to jobhunt config" })
      .where(eq(jobHuntRuns.id, runId))
    return result
  }

  const keywords = cfg.roleKeywords.split(",").map((k) => k.trim()).filter(Boolean)
  // Reuse the career scanner's negative filters (and positives as fallback).
  let filters: TitleFilters = DEFAULT_TITLE_FILTERS
  try {
    filters = (await getScannerConfig(userId)).filters
  } catch {
    filters = DEFAULT_TITLE_FILTERS
  }

  for (const board of cfg.boards.slice(0, 20)) {
    result.boards++
    let markdown = ""
    try {
      markdown = await fetchPage(board.url, userId) // crawl4ai preferred, plain-fetch fallback
    } catch (e) {
      result.errors.push(`${board.name}: ${e instanceof Error ? e.message : "crawl failed"}`)
      continue
    }
    const candidates = extractJobLinks(markdown, board.url, board.name, keywords, filters).slice(0, cfg.maxPerBoard)
    result.found += candidates.length

    for (const c of candidates) {
      // Dedup 1: URL seen before (scan_history shared with the ATS scanner)
      const [seen] = await db
        .select({ id: scanHistory.id })
        .from(scanHistory)
        .where(and(eq(scanHistory.userId, userId), eq(scanHistory.url, c.url)))
        .limit(1)
      if (seen) {
        result.skipped++
        continue
      }
      // Dedup 2: same board(company) + normalized role already in pipeline
      const existing = await db
        .select({ roleTitle: jobApplications.roleTitle })
        .from(jobApplications)
        .where(and(eq(jobApplications.userId, userId), eq(jobApplications.company, c.board)))
      const dup = existing.some((r) => norm(r.roleTitle) === norm(c.title))

      await db.insert(scanHistory).values({
        id: randomUUID(),
        userId,
        url: c.url,
        portalSource: `sourcer:${c.board}`,
        status: dup ? "skipped_dup" : "added",
      })
      if (dup) {
        result.skipped++
        continue
      }

      await db.insert(jobApplications).values({
        id: randomUUID(),
        userId,
        company: c.board,
        roleTitle: c.title.slice(0, 200),
        jobUrl: c.url,
        portalSource: `sourcer:${c.board}`,
        status: "discovered",
      })
      result.staged++
    }
  }

  await db
    .update(jobHuntRuns)
    .set({
      status: result.errors.length > 0 && result.staged === 0 ? "failed" : "completed",
      found: result.staged,
      detail: `${result.staged} staged from ${result.boards} board(s)${result.errors.length ? ` · ${result.errors.length} error(s)` : ""}`,
    })
    .where(eq(jobHuntRuns.id, runId))

  return result
}
