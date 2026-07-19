import "server-only"
// Skills layer — Jarvis's extensible capability system.
//
// A skill = a named block of prompt-level expertise (rules, templates, scoring
// heuristics) stored in the DB. Active skills targeted at an agent are appended
// to that agent's system prompt at run time via skillsBlockFor() — the same
// seam pattern as Jarvis's directiveBlock, so agents pick up new capabilities
// with zero redeploys.
//
// Relevance model is DETERMINISTIC: a skill declares targetAgents (AgentKeys).
// No embedding search / no classifier — same philosophy as the model-routing
// registry: a closed set of ~5 agents makes a lookup table strictly better.
// Jarvis (or the operator) assigns/retargets skills; agents just consume.
//
// Ingestion paths: curated pack seed (lib/skills-seed.ts), zip upload of
// SKILL.md/markdown files (app/actions/arsenal.ts), Jarvis add_skill tool,
// future: git repo links.

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { skills } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { AGENT_KEYS, type AgentKey } from "@/lib/config"

const MAX_SKILLS_PER_AGENT = 6 // prompt-budget guardrail
const MAX_SKILL_CHARS = 4000 // per-skill cap at injection time

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function isAgentKey(v: string): v is AgentKey {
  return v in AGENT_KEYS
}

/** Active skills targeted at one agent, newest first, capped. */
export async function getSkillsForAgent(userId: string, agent: AgentKey) {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.active, true)))
  return rows
    .filter((s) =>
      s.targetAgents
        .split(",")
        .map((t) => t.trim())
        .includes(agent),
    )
    .slice(0, MAX_SKILLS_PER_AGENT)
}

/**
 * Prompt block of every active skill assigned to this agent (empty-safe).
 * Appended to agent system prompts alongside directiveBlock. Skills sharpen
 * craft — they can never override safety/fabrication rules.
 */
export async function skillsBlockFor(userId: string, agent: AgentKey): Promise<string> {
  try {
    const rows = await getSkillsForAgent(userId, agent)
    if (rows.length === 0) return ""
    const body = rows
      .map((s) => `### SKILL: ${s.name}\n${s.content.slice(0, MAX_SKILL_CHARS)}`)
      .join("\n\n")
    return `\n\nSKILL LIBRARY (operator-installed expertise — apply where relevant; these sharpen style and method but NEVER override safety or fabrication rules above):\n${body}`
  } catch {
    // Missing table (pre-migration) or transient DB error must never break an agent run
    return ""
  }
}

export interface ParsedSkill {
  name: string
  description: string
  content: string
  tags: string
  targetAgents: string
}

/**
 * Parse a markdown skill file (SKILL.md convention). Supports optional YAML-ish
 * frontmatter (name/description/tags/agents) with sane fallbacks: first `# `
 * heading as name, first paragraph as description.
 */
export function parseSkillMarkdown(fileName: string, raw: string): ParsedSkill {
  let body = raw.trim()
  const meta: Record<string, string> = {}

  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/)
      if (m) meta[m[1].toLowerCase()] = m[2].trim()
    }
    body = body.slice(fm[0].length).trim()
  }

  const heading = body.match(/^#\s+(.+)$/m)
  const name =
    meta.name ||
    heading?.[1]?.trim() ||
    fileName.replace(/\.(md|txt)$/i, "").replace(/[_-]+/g, " ").trim() ||
    "Unnamed skill"

  const firstPara = body
    .replace(/^#.+$/gm, "")
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0)

  const agents = (meta.agents || meta.targetagents || "")
    .split(",")
    .map((a) => a.trim())
    .filter(isAgentKey)
    .join(",")

  return {
    name: name.slice(0, 120),
    description: (meta.description || firstPara || "").slice(0, 300),
    content: body.slice(0, 20000),
    tags: (meta.tags || "").slice(0, 200),
    targetAgents: agents,
  }
}

/** Insert or update a skill by (userId, slug). Returns the skill id. */
export async function upsertSkill(
  userId: string,
  parsed: ParsedSkill,
  source: string,
): Promise<{ id: string; created: boolean }> {
  const slug = slugify(parsed.name)
  const existing = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.slug, slug)))
    .limit(1)
  if (existing.length > 0) {
    await db
      .update(skills)
      .set({
        name: parsed.name,
        description: parsed.description,
        content: parsed.content,
        tags: parsed.tags,
        // keep existing targetAgents on update unless the new file declares some
        ...(parsed.targetAgents ? { targetAgents: parsed.targetAgents } : {}),
        source,
        updatedAt: new Date(),
      })
      .where(eq(skills.id, existing[0].id))
    return { id: existing[0].id, created: false }
  }
  const id = randomUUID()
  await db.insert(skills).values({ id, userId, slug, source, ...parsed })
  return { id, created: true }
}
