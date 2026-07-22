import "server-only"
// Apollo → Hunter waterfall — finds the hiring manager for a target company.
// Node 3 (Enricher) core. Keys resolve via the vault (apollo/hunter providers)
// then env (APOLLO_API_KEY / HUNTER_API_KEY). All read-only lookups.
//
// Strategy (PRD Rule 4):
//   1. Apollo people-search by domain (or org name) + role-adjacent titles →
//      best match (name, title, linkedin, email if present, org primary domain).
//   2. If no verified email: Hunter email-finder(domain, first, last).
//   3. If still none: Hunter domain-search → email pattern → reconstruct
//      {first}.{last}@domain.

import { getSecret } from "@/lib/config"
import type { HiringManager } from "@/lib/jobhunt/types"

const ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "myworkdayjobs.com",
  "bamboohr.com",
  "teamtailor.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "wellfound.com",
]

const HIRING_TITLES = [
  "Talent Acquisition",
  "Recruiter",
  "Technical Recruiter",
  "Head of Talent",
  "Engineering Manager",
  "Hiring Manager",
  "Director of Engineering",
  "VP Engineering",
]

export function domainFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    if (ATS_HOSTS.some((a) => host.endsWith(a))) return null // ATS host ≠ company domain
    return host
  } catch {
    return null
  }
}

interface ApolloPerson {
  name?: string
  first_name?: string
  last_name?: string
  title?: string
  linkedin_url?: string
  email?: string
  organization?: { primary_domain?: string; website_url?: string }
}

async function apolloSearch(key: string, opts: { domain?: string; org?: string }): Promise<ApolloPerson | null> {
  const body: Record<string, unknown> = {
    person_titles: HIRING_TITLES,
    page: 1,
    per_page: 5,
  }
  if (opts.domain) body.q_organization_domains = opts.domain
  else if (opts.org) body.q_organization_name = opts.org
  const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Apollo ${res.status}`)
  const data = (await res.json()) as { people?: ApolloPerson[] }
  return data.people?.[0] ?? null
}

interface HunterFind {
  data?: { email?: string; first_name?: string; last_name?: string }
}
interface HunterDomain {
  data?: { pattern?: string; emails?: { value: string }[] }
}

async function hunterEmailFinder(key: string, domain: string, first: string, last: string): Promise<string | null> {
  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(
    first,
  )}&last_name=${encodeURIComponent(last)}&api_key=${key}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) return null
  const data = (await res.json()) as HunterFind
  return data.data?.email ?? null
}

async function hunterDomainPattern(key: string, domain: string): Promise<string | null> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${key}&limit=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) return null
  const data = (await res.json()) as HunterDomain
  return data.data?.pattern ?? null
}

function applyPattern(pattern: string, first: string, last: string, domain: string): string {
  // Hunter patterns use {first}/{last}/{f}/{l} tokens.
  const f = first.toLowerCase()
  const l = last.toLowerCase()
  const local = pattern
    .replace(/\{first\}/g, f)
    .replace(/\{last\}/g, l)
    .replace(/\{f\}/g, f.charAt(0))
    .replace(/\{l\}/g, l.charAt(0))
  return `${local}@${domain}`
}

export interface EnrichInput {
  company: string
  jobUrl: string
  roleTitle: string
}

export async function findHiringManager(userId: string, input: EnrichInput): Promise<HiringManager | null> {
  const apolloKey = await getSecret(userId, "apollo", "jobhunt.enricher")
  const hunterKey = await getSecret(userId, "hunter", "jobhunt.enricher")
  if (!apolloKey && !hunterKey) return null

  let person: ApolloPerson | null = null
  let domain = domainFromUrl(input.jobUrl)

  // Step 1: Apollo (by domain, else org name)
  if (apolloKey) {
    try {
      person = await apolloSearch(apolloKey, domain ? { domain } : { org: input.company })
      const orgDomain = person?.organization?.primary_domain
      if (!domain && orgDomain) domain = orgDomain
    } catch {
      person = null
    }
  }

  const first = person?.first_name ?? person?.name?.split(" ")[0] ?? ""
  const last = person?.last_name ?? person?.name?.split(" ").slice(-1)[0] ?? ""
  let email = person?.email && !person.email.includes("email_not_unlocked") ? person.email : ""
  let confidence: HiringManager["confidence"] = email ? "verified" : "unknown"
  let source: HiringManager["source"] = email ? "apollo" : ""

  // Step 2/3: Hunter fallback for the email
  if (!email && hunterKey && domain) {
    if (first && last) {
      const found = await hunterEmailFinder(hunterKey, domain, first, last).catch(() => null)
      if (found) {
        email = found
        confidence = "verified"
        source = "hunter"
      }
    }
    if (!email && first && last) {
      const pattern = await hunterDomainPattern(hunterKey, domain).catch(() => null)
      if (pattern) {
        email = applyPattern(pattern, first, last, domain)
        confidence = "pattern"
        source = "hunter"
      }
    }
  }

  if (!person && !email) return null

  return {
    name: person?.name ?? [first, last].filter(Boolean).join(" "),
    email,
    linkedin: person?.linkedin_url ?? "",
    title: person?.title ?? "",
    source: source || "apollo",
    confidence,
  }
}
