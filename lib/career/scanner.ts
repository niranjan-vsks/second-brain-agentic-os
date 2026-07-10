// Zero-token ATS scanner — Level 2 of the 3-level discovery strategy (doc 09 §scan.md).
// Direct API polling: no LLM, no browser. Endpoint patterns ported verbatim from
// career-ops scan.md §Nivel 2. Dedup via scan_history + job_applications (doc 09).

import { db } from "@/lib/db"
import { scanHistory, jobApplications, careerSettings } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { randomUUID } from "crypto"

export interface TrackedCompany {
  name: string
  provider: "greenhouse" | "ashby" | "lever" | "bamboohr" | "teamtailor" | "workday"
  slug: string // ATS company identifier
  careersUrl?: string // preferred over raw ATS URL when present (careers-URL preference rule)
  shard?: string // workday only, e.g. "wd1"
  site?: string // workday only
}

export interface TitleFilters {
  positive: string[]
  negative: string[]
}

// FDE-forward defaults (source portals.yml was AI-PM stale — Task 0.1 correction applies here too).
// Negative list ported verbatim from portals.yml. All editable in Career Settings UI.
export const DEFAULT_TITLE_FILTERS: TitleFilters = {
  positive: [
    "Forward Deployed",
    "FDE",
    "AI Engineer",
    "Solutions Engineer",
    "AI Solutions Architect",
    "Solutions Architect AI",
    "AI Product Manager",
    "GenAI",
    "Agentic",
    "LLM",
    "Applied AI",
  ],
  negative: ["iOS", "Android", "Hardware", "Embedded", "Game", "Marketing Manager", "Project Manager"],
}

export interface ScannedJob {
  title: string
  url: string
  portalSource: string
  company: string
}

function titlePasses(title: string, filters: TitleFilters): boolean {
  const t = title.toLowerCase()
  if (filters.negative.some((n) => t.includes(n.toLowerCase()))) return false
  return filters.positive.some((p) => t.includes(p.toLowerCase()))
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

// --- Per-provider parsers (endpoint patterns from doc 09, port verbatim) ----

async function scanGreenhouse(c: TrackedCompany): Promise<ScannedJob[]> {
  const data = (await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs`)) as {
    jobs?: { title: string; absolute_url: string }[]
  }
  return (data.jobs ?? []).map((j) => ({
    title: j.title,
    url: j.absolute_url,
    portalSource: "greenhouse",
    company: c.name,
  }))
}

async function scanAshby(c: TrackedCompany): Promise<ScannedJob[]> {
  const data = (await fetchJson("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "ApiJobBoardWithTeams",
      variables: { organizationHostedJobsPageName: c.slug },
      query:
        "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { jobPostings { id title } } }",
    }),
  })) as { data?: { jobBoard?: { jobPostings?: { id: string; title: string }[] } } }
  return (data.data?.jobBoard?.jobPostings ?? []).map((j) => ({
    title: j.title,
    url: `https://jobs.ashbyhq.com/${c.slug}/${j.id}`,
    portalSource: "ashby",
    company: c.name,
  }))
}

async function scanLever(c: TrackedCompany): Promise<ScannedJob[]> {
  const data = (await fetchJson(`https://api.lever.co/v0/postings/${c.slug}?mode=json`)) as {
    text: string
    hostedUrl: string
  }[]
  return (Array.isArray(data) ? data : []).map((j) => ({
    title: j.text,
    url: j.hostedUrl,
    portalSource: "lever",
    company: c.name,
  }))
}

async function scanBambooHR(c: TrackedCompany): Promise<ScannedJob[]> {
  const data = (await fetchJson(`https://${c.slug}.bamboohr.com/careers/list`)) as {
    result?: { id: string; jobOpeningName: string }[]
  }
  return (data.result ?? []).map((j) => ({
    title: j.jobOpeningName,
    url: `https://${c.slug}.bamboohr.com/careers/${j.id}`,
    portalSource: "bamboohr",
    company: c.name,
  }))
}

async function scanTeamtailor(c: TrackedCompany): Promise<ScannedJob[]> {
  const res = await fetch(`https://${c.slug}.teamtailor.com/jobs.rss`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`${res.status} teamtailor ${c.slug}`)
  const xml = await res.text()
  const items: ScannedJob[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null = itemRegex.exec(xml)
  while (m !== null) {
    const block = m[1]
    const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1]?.trim()
    const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1]?.trim()
    if (title && link) items.push({ title, url: link, portalSource: "teamtailor", company: c.name })
    m = itemRegex.exec(xml)
  }
  return items
}

async function scanWorkday(c: TrackedCompany): Promise<ScannedJob[]> {
  const shard = c.shard ?? "wd1"
  const site = c.site ?? c.slug
  const base = `https://${c.slug}.${shard}.myworkdayjobs.com`
  const jobs: ScannedJob[] = []
  let offset = 0
  // paginate by offset (doc 09); cap pages defensively
  for (let page = 0; page < 10; page++) {
    const data = (await fetchJson(`${base}/wday/cxs/${c.slug}/${site}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: "" }),
    })) as { jobPostings?: { title: string; externalPath: string }[]; total?: number }
    const batch = data.jobPostings ?? []
    jobs.push(
      ...batch.map((j) => ({
        title: j.title,
        url: `${base}/en-US/${site}${j.externalPath}`,
        portalSource: "workday",
        company: c.name,
      })),
    )
    offset += batch.length
    if (batch.length < 20 || (data.total !== undefined && offset >= data.total)) break
  }
  return jobs
}

const PROVIDERS: Record<TrackedCompany["provider"], (c: TrackedCompany) => Promise<ScannedJob[]>> = {
  greenhouse: scanGreenhouse,
  ashby: scanAshby,
  lever: scanLever,
  bamboohr: scanBambooHR,
  teamtailor: scanTeamtailor,
  workday: scanWorkday,
}

export interface ScanResult {
  added: number
  skippedTitle: number
  skippedDup: number
  errors: string[]
}

// Reads trackedCompanies + titleFilters from career_settings.extra (JSON escape hatch).
export async function getScannerConfig(userId: string): Promise<{
  companies: TrackedCompany[]
  filters: TitleFilters
}> {
  const [settings] = await db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1)
  let extra: Record<string, unknown> = {}
  try {
    extra = settings ? JSON.parse(settings.extra) : {}
  } catch {
    extra = {}
  }
  const companies = Array.isArray(extra.trackedCompanies) ? (extra.trackedCompanies as TrackedCompany[]) : []
  const filters =
    extra.titleFilters && typeof extra.titleFilters === "object"
      ? (extra.titleFilters as TitleFilters)
      : DEFAULT_TITLE_FILTERS
  return { companies, filters }
}

// 3-source dedup ported from scan.md: exact URL in scan_history, exact URL in
// job_applications, company+normalized-role already present (doc 09 §dedup).
export async function runZeroTokenScan(userId: string): Promise<ScanResult> {
  const { companies, filters } = await getScannerConfig(userId)
  const result: ScanResult = { added: 0, skippedTitle: 0, skippedDup: 0, errors: [] }

  for (const company of companies) {
    let jobs: ScannedJob[] = []
    try {
      jobs = await PROVIDERS[company.provider](company)
    } catch (e) {
      result.errors.push(`${company.name} (${company.provider}): ${e instanceof Error ? e.message : "failed"}`)
      continue
    }

    for (const job of jobs) {
      if (!titlePasses(job.title, filters)) {
        result.skippedTitle++
        continue
      }
      // Dedup 1: exact URL seen before
      const [seen] = await db
        .select({ id: scanHistory.id })
        .from(scanHistory)
        .where(and(eq(scanHistory.userId, userId), eq(scanHistory.url, job.url)))
        .limit(1)
      if (seen) {
        result.skippedDup++
        continue
      }
      // Dedup 2+3: company + normalized role already in pipeline
      const normalized = job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
      const existing = await db
        .select({ id: jobApplications.id, roleTitle: jobApplications.roleTitle })
        .from(jobApplications)
        .where(and(eq(jobApplications.userId, userId), eq(jobApplications.company, job.company)))
      const dupRole = existing.some(
        (r) => r.roleTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalized,
      )

      await db.insert(scanHistory).values({
        id: randomUUID(),
        userId,
        url: job.url,
        portalSource: job.portalSource,
        status: dupRole ? "skipped_dup" : "added",
      })
      if (dupRole) {
        result.skippedDup++
        continue
      }

      await db.insert(jobApplications).values({
        id: randomUUID(),
        userId,
        company: job.company,
        roleTitle: job.title,
        jobUrl: job.url,
        portalSource: job.portalSource,
        status: "discovered",
      })
      result.added++
    }
  }
  return result
}
