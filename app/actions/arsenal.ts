"use server"

// Arsenal server actions — Skills (capability modules) + Automations (n8n).
// Same invariants as everything else: getUserId() on every action, every query
// userId-scoped, additive-only (no existing agent behavior changes unless a
// skill is explicitly assigned to it).

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { unzipSync, strFromU8 } from "fflate"
import { generateText } from "ai"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { skills, automations, automationRuns } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getModelForUser } from "@/lib/llm"
import { AGENT_KEYS } from "@/lib/config"
import { parseSkillMarkdown, upsertSkill, isAgentKey, type ParsedSkill } from "@/lib/skills"
import { CURATED_PACK } from "@/lib/skills-seed"
import { isN8nConfigured, deployWorkflow, runWorkflow, inventoryWorkflow } from "@/lib/n8n"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user.id
}

// --- Skills ---------------------------------------------------------------------

export async function listSkills() {
  const userId = await getUserId()
  return db.select().from(skills).where(eq(skills.userId, userId)).orderBy(desc(skills.updatedAt))
}

export async function seedCuratedPack() {
  const userId = await getUserId()
  let created = 0
  let updated = 0
  for (const skill of CURATED_PACK) {
    const { created: wasCreated } = await upsertSkill(
      userId,
      {
        name: skill.name,
        description: skill.description,
        content: skill.content,
        tags: skill.tags,
        targetAgents: skill.targetAgents,
      },
      "curated_pack",
    )
    if (wasCreated) created++
    else updated++
  }
  revalidatePath("/")
  return { ok: true, created, updated, total: CURATED_PACK.length }
}

/**
 * Ingest a zip of skill files (SKILL.md / *.md / *.txt). Files without
 * frontmatter get their metadata (description, tags, target agents) inferred
 * by the LLM — arsenal.skill_extract, standard tier.
 */
export async function ingestSkillZip(formData: FormData) {
  const userId = await getUserId()
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false as const, error: "No file uploaded" }
  if (file.size > 5 * 1024 * 1024) return { ok: false as const, error: "Zip too large (max 5MB)" }

  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    return { ok: false as const, error: "Not a valid zip file" }
  }

  const results: { file: string; skill?: string; error?: string }[] = []
  let ingested = 0

  for (const [path, bytes] of Object.entries(entries)) {
    const lower = path.toLowerCase()
    if (path.endsWith("/") || (!lower.endsWith(".md") && !lower.endsWith(".txt"))) continue
    if (lower.includes("license") || lower.includes("changelog")) continue
    if (ingested >= 30) {
      results.push({ file: path, error: "skipped — 30-file cap per zip" })
      continue
    }
    let raw: string
    try {
      raw = strFromU8(bytes)
    } catch {
      results.push({ file: path, error: "not utf-8 text" })
      continue
    }
    if (raw.trim().length < 40) {
      results.push({ file: path, error: "too short to be a skill" })
      continue
    }

    const parsed = parseSkillMarkdown(path.split("/").pop() ?? path, raw)

    // No declared target agents → infer metadata with the LLM
    if (!parsed.targetAgents) {
      try {
        const inferred = await inferSkillMeta(userId, parsed)
        parsed.description = parsed.description || inferred.description
        parsed.tags = parsed.tags || inferred.tags
        parsed.targetAgents = inferred.targetAgents
      } catch {
        // Non-fatal: ingest as library-only (no injection until assigned)
      }
    }

    const { created } = await upsertSkill(userId, parsed, "zip")
    results.push({ file: path, skill: `${parsed.name}${created ? "" : " (updated)"}` })
    ingested++
  }

  revalidatePath("/")
  return { ok: true as const, ingested, results }
}

// --- GitHub repo ingestion ------------------------------------------------------

interface RepoRef {
  owner: string
  repo: string
  branch?: string
  subpath?: string
}

function parseRepoUrl(u: string): RepoRef | null {
  const m = u
    .trim()
    .match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?\/?$/i)
  if (!m) return null
  return { owner: m[1], repo: m[2], branch: m[3], subpath: m[4]?.replace(/\/$/, "") }
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "operator-os-arsenal" }
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

const EXCLUDE_NAMES = ["license", "changelog", "contributing", "security", "code_of_conduct", "pull_request_template", "issue_template"]
const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "")
const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1)

/**
 * Ingest skills straight from a GitHub repo URL. Deterministic fetch + parse
 * (ZERO tokens); the LLM runs ONLY to infer metadata + auto-target agents for
 * files without frontmatter (light path). Auto-targeting is what makes an
 * ingested skill immediately usable — the relevant agents pick it up on their
 * next run with no manual assignment.
 *
 * Handles both conventions:
 *   - SKILL.md repos (Claude/Anthropic style): each dir with a SKILL.md becomes
 *     one skill; sibling reference/*.md are folded into its body.
 *   - Flat catalogs (one .md per skill, e.g. agency-agents): each .md = a skill.
 */
export async function ingestSkillRepo(repoUrl: string) {
  const userId = await getUserId()
  const ref = parseRepoUrl(repoUrl)
  if (!ref) return { ok: false as const, error: "Not a GitHub repo URL (expected github.com/owner/repo)" }

  // Resolve default branch if not pinned in the URL.
  let branch = ref.branch
  if (!branch) {
    try {
      const meta = (await (await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, { headers: ghHeaders(), signal: AbortSignal.timeout(15000) })).json()) as { default_branch?: string; message?: string }
      if (!meta.default_branch) return { ok: false as const, error: meta.message === "Not Found" ? "Repo not found (private repos need a GITHUB_TOKEN)" : "Could not resolve default branch" }
      branch = meta.default_branch
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "GitHub API failed" }
    }
  }

  // Full file tree.
  let tree: { path: string; type: string }[]
  try {
    const res = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${branch}?recursive=1`, { headers: ghHeaders(), signal: AbortSignal.timeout(20000) })
    if (!res.ok) return { ok: false as const, error: `GitHub tree ${res.status} (rate limit? add GITHUB_TOKEN)` }
    const data = (await res.json()) as { tree?: { path: string; type: string }[]; truncated?: boolean }
    tree = data.tree ?? []
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "GitHub tree fetch failed" }
  }

  const sub = ref.subpath ? ref.subpath + "/" : ""
  const mdFiles = tree
    .filter((n) => n.type === "blob")
    .map((n) => n.path)
    .filter((p) => (p.endsWith(".md") || p.endsWith(".txt")) && (!sub || p.startsWith(sub)))
    .filter((p) => !EXCLUDE_NAMES.some((x) => baseOf(p).toLowerCase().includes(x)))
  if (mdFiles.length === 0) return { ok: false as const, error: "No .md/.txt skill files found in the repo/path" }

  const rawUrl = (p: string) => `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}/${p}`
  const fetchRaw = async (p: string): Promise<string> => {
    const res = await fetch(rawUrl(p), { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`raw ${res.status}`)
    return res.text()
  }

  // Group by SKILL.md dirs; fall back to flat.
  const skillDirs = mdFiles.filter((p) => baseOf(p).toLowerCase() === "skill.md").map(dirOf)
  const units: { name: string; mainPath: string; refPaths: string[] }[] = []
  if (skillDirs.length > 0) {
    for (const dir of skillDirs) {
      const mainPath = mdFiles.find((p) => dirOf(p) === dir && baseOf(p).toLowerCase() === "skill.md")!
      const refPaths = mdFiles.filter((p) => p !== mainPath && (dirOf(p) === dir || dirOf(p).startsWith(dir + "/"))).slice(0, 6)
      units.push({ name: dir || ref.repo, mainPath, refPaths })
    }
  } else {
    for (const p of mdFiles.slice(0, 60)) units.push({ name: baseOf(p), mainPath: p, refPaths: [] })
  }

  const results: { unit: string; skill?: string; error?: string }[] = []
  let ingested = 0
  for (const u of units) {
    if (ingested >= 60) {
      results.push({ unit: u.name, error: "skipped — 60-skill cap" })
      continue
    }
    try {
      let raw = await fetchRaw(u.mainPath)
      if (raw.trim().length < 40) {
        results.push({ unit: u.name, error: "too short" })
        continue
      }
      const parsed = parseSkillMarkdown(baseOf(u.mainPath), raw)
      // Fold reference/template files into the body (capped).
      if (u.refPaths.length > 0) {
        const refs: string[] = []
        for (const rp of u.refPaths) {
          try {
            refs.push(`\n\n## Reference: ${baseOf(rp)}\n${(await fetchRaw(rp)).slice(0, 4000)}`)
          } catch {
            /* skip missing ref */
          }
        }
        parsed.content = (parsed.content + refs.join("")).slice(0, 20000)
      }
      // Auto-target relevant agents when the file didn't declare them.
      if (!parsed.targetAgents) {
        try {
          const inferred = await inferSkillMeta(userId, parsed)
          parsed.description = parsed.description || inferred.description
          parsed.tags = parsed.tags || inferred.tags
          parsed.targetAgents = inferred.targetAgents
        } catch {
          /* library-only until assigned */
        }
      }
      const { created } = await upsertSkill(userId, parsed, "repo")
      results.push({ unit: u.name, skill: `${parsed.name}${created ? "" : " (updated)"}${parsed.targetAgents ? ` → [${parsed.targetAgents}]` : ""}` })
      ingested++
    } catch (e) {
      results.push({ unit: u.name, error: e instanceof Error ? e.message : "failed" })
    }
  }

  revalidatePath("/")
  return { ok: true as const, ingested, repo: `${ref.owner}/${ref.repo}`, results }
}

async function inferSkillMeta(userId: string, parsed: ParsedSkill): Promise<{ description: string; tags: string; targetAgents: string }> {
  const { text } = await generateText({
    model: await getModelForUser(userId, "standard"), // arsenal.skill_extract — metadata inference for frontmatter-less skill files
    system: `You classify a "skill" document for an operator OS with exactly these agents:
${Object.entries(AGENT_KEYS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}
Output STRICT JSON: {"description": "one line, max 200 chars", "tags": "comma,separated,max5", "targetAgents": "comma-separated agent keys from the list above that would genuinely benefit — empty string if none fit"}. JSON only.`,
    prompt: `SKILL NAME: ${parsed.name}\n\nCONTENT:\n${parsed.content.slice(0, 6000)}`,
  })
  const cleaned = text.replace(/```json?|```/g, "").trim()
  const json = JSON.parse(cleaned) as { description?: string; tags?: string; targetAgents?: string }
  return {
    description: (json.description ?? "").slice(0, 300),
    tags: (json.tags ?? "").slice(0, 200),
    targetAgents: (json.targetAgents ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(isAgentKey)
      .join(","),
  }
}

export async function updateSkillAction(
  id: string,
  patch: { active?: boolean; targetAgents?: string; name?: string; description?: string; content?: string },
) {
  const userId = await getUserId()
  const clean: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.active !== undefined) clean.active = patch.active
  if (patch.name !== undefined) clean.name = patch.name.slice(0, 120)
  if (patch.description !== undefined) clean.description = patch.description.slice(0, 300)
  if (patch.content !== undefined) clean.content = patch.content.slice(0, 20000)
  if (patch.targetAgents !== undefined) {
    clean.targetAgents = patch.targetAgents
      .split(",")
      .map((a) => a.trim())
      .filter(isAgentKey)
      .join(",")
  }
  await db.update(skills).set(clean).where(and(eq(skills.id, id), eq(skills.userId, userId)))
  revalidatePath("/")
  return { ok: true }
}

export async function deleteSkillAction(id: string) {
  const userId = await getUserId()
  await db.delete(skills).where(and(eq(skills.id, id), eq(skills.userId, userId)))
  revalidatePath("/")
  return { ok: true }
}

// --- Automations ----------------------------------------------------------------

export async function listAutomations() {
  const userId = await getUserId()
  const rows = await db.select().from(automations).where(eq(automations.userId, userId)).orderBy(desc(automations.updatedAt))
  const n8nReady = await isN8nConfigured(userId)
  return { automations: rows, n8nConfigured: n8nReady }
}

export async function importAutomation(name: string, rawJson: string) {
  const userId = await getUserId()
  let definition: Record<string, unknown>
  try {
    definition = JSON.parse(rawJson)
  } catch {
    return { ok: false as const, error: "Not valid JSON — paste the exported n8n workflow JSON" }
  }
  if (!Array.isArray(definition.nodes)) {
    return { ok: false as const, error: "JSON has no 'nodes' array — this doesn't look like an n8n workflow export" }
  }
  const inv = inventoryWorkflow(definition)
  const id = randomUUID()
  await db.insert(automations).values({
    id,
    userId,
    name: name.trim() || inv.name,
    description: `${inv.nodeCount} nodes · ${inv.triggers.length} trigger(s)`,
    kind: "n8n",
    definition,
    analysis: { inventory: inv },
    status: "imported",
  })
  revalidatePath("/")
  return { ok: true as const, id, inventory: inv }
}

/**
 * Jarvis-grade analysis of an imported workflow: what it does end-to-end,
 * whether it's worth running whole, and which parts are absorbable into our
 * existing agents as skills. Heavy tier — this is multi-constraint reasoning.
 */
export async function analyzeAutomation(id: string) {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.userId, userId)))
    .limit(1)
  if (!row) return { ok: false as const, error: "Automation not found" }

  const inv = inventoryWorkflow(row.definition as Record<string, unknown>)
  const defStr = JSON.stringify(row.definition).slice(0, 30000)

  try {
    const { text } = await generateText({
      model: await getModelForUser(userId, "heavy"), // arsenal.analyze_automation — workflow JSON → capability analysis + absorbable parts
      system: `You analyze n8n workflow JSON for a personal operator OS whose existing agents are:
${Object.entries(AGENT_KEYS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}
Plus subsystems: lead-gen discovery (Google Maps + web search), career job scanner (ATS APIs), LinkedIn drafting (HITL), YouTube video pipeline, Money OS.

Output STRICT JSON:
{
 "summary": "2-3 sentences: what this workflow does end to end",
 "runWholeVerdict": "run_whole" | "absorb_parts" | "both" | "neither",
 "runWholeRationale": "1-2 sentences",
 "absorbable": [{"capability": "name", "detail": "what the workflow does here that our OS could adopt", "targetAgent": "one of the agent keys above or empty", "asSkill": "if worth saving as a prompt-skill, the full skill content (rules/method extracted+generalized), else empty"}],
 "risks": "credentials, external services, or destructive steps to be aware of"
}
JSON only, no fences. Be honest: overlap with existing capabilities => say 'neither'.`,
      prompt: `WORKFLOW INVENTORY: ${JSON.stringify(inv)}\n\nWORKFLOW JSON:\n${defStr}`,
    })
    const cleaned = text.replace(/```json?|```/g, "").trim()
    const analysis = JSON.parse(cleaned) as Record<string, unknown>
    await db
      .update(automations)
      .set({ analysis: { inventory: inv, ...analysis }, status: "analyzed", updatedAt: new Date() })
      .where(and(eq(automations.id, id), eq(automations.userId, userId)))
    revalidatePath("/")
    return { ok: true as const, analysis }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Analysis failed" }
  }
}

/** Turn one absorbable capability (from analysis) into a real skill. */
export async function absorbCapability(automationId: string, capabilityIndex: number) {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, automationId), eq(automations.userId, userId)))
    .limit(1)
  if (!row) return { ok: false as const, error: "Automation not found" }
  const analysis = row.analysis as { absorbable?: { capability: string; detail: string; targetAgent: string; asSkill: string }[] }
  const cap = analysis.absorbable?.[capabilityIndex]
  if (!cap) return { ok: false as const, error: "Capability not found — run Analyze first" }
  if (!cap.asSkill) return { ok: false as const, error: "This capability wasn't marked as skill-worthy" }

  const { id } = await upsertSkill(
    userId,
    {
      name: cap.capability.slice(0, 120),
      description: cap.detail.slice(0, 300),
      content: cap.asSkill.slice(0, 20000),
      tags: "absorbed,automation",
      targetAgents: isAgentKey(cap.targetAgent) ? cap.targetAgent : "",
    },
    "automation",
  )
  revalidatePath("/")
  return { ok: true as const, skillId: id, name: cap.capability }
}

/** Deploy (if needed) + run an automation on the connected n8n instance. */
export async function runAutomationAction(id: string, trigger: "manual" | "jarvis" = "manual") {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.userId, userId)))
    .limit(1)
  if (!row) return { ok: false as const, error: "Automation not found" }

  const runId = randomUUID()
  await db.insert(automationRuns).values({ id: runId, userId, automationId: id, trigger, status: "started" })

  try {
    let n8nId = row.n8nWorkflowId
    if (!n8nId) {
      n8nId = await deployWorkflow(userId, row.definition as Record<string, unknown>)
      await db
        .update(automations)
        .set({ n8nWorkflowId: n8nId, status: "deployed", updatedAt: new Date() })
        .where(eq(automations.id, id))
    }
    const { executionId } = await runWorkflow(userId, n8nId)
    await db
      .update(automationRuns)
      .set({ status: "succeeded", detail: `execution ${executionId ?? "started"}` })
      .where(eq(automationRuns.id, runId))
    revalidatePath("/")
    return { ok: true as const, executionId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "run failed"
    await db.update(automationRuns).set({ status: "failed", detail: msg.slice(0, 500) }).where(eq(automationRuns.id, runId))
    revalidatePath("/")
    return { ok: false as const, error: msg }
  }
}

export async function deleteAutomationAction(id: string) {
  const userId = await getUserId()
  await db.delete(automations).where(and(eq(automations.id, id), eq(automations.userId, userId)))
  await db.delete(automationRuns).where(and(eq(automationRuns.automationId, id), eq(automationRuns.userId, userId)))
  revalidatePath("/")
  return { ok: true }
}

export async function listAutomationRuns(automationId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.automationId, automationId), eq(automationRuns.userId, userId)))
    .orderBy(desc(automationRuns.createdAt))
    .limit(10)
}
