import "server-only"
// Live status derivation for the Agent Playground — CODE-ONLY, ZERO LLM COST.
//
// Every status comes from data the app already writes: state-machine columns and
// audit tables. We run ONE batched query of cheap latest-row lookups per user
// and map each status source to a traffic-light: green (healthy/completed),
// yellow (in-flight/pending), red (failed/blocked), idle (nothing recent).
//
// This is the "never ask a model what the status is" rule from spec §4.

import { pool } from "@/lib/db"
import { BASE_AGENTS, type AgentDef } from "@/lib/agent-registry"

export type NodeStatus = "success" | "pending" | "error" | "idle"

export interface SourceStatus {
  status: NodeStatus
  detail: string
  lastAt: string | null
}

export type StatusMap = Record<string, SourceStatus>

const IDLE: SourceStatus = { status: "idle", detail: "no recent activity", lastAt: null }

function classify(raw: string | null | undefined, map: Record<string, NodeStatus>): NodeStatus {
  if (!raw) return "idle"
  return map[raw] ?? "idle"
}

/**
 * One round-trip: latest relevant row per source. Each subquery is indexed by
 * userId + createdAt/updatedAt and LIMIT 1 — negligible cost, safe to poll.
 */
export async function getStatusSources(userId: string): Promise<StatusMap> {
  const q = await pool.query(
    `SELECT
       (SELECT status FROM video_projects WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1) AS youtube_status,
       (SELECT "updatedAt" FROM video_projects WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1) AS youtube_at,
       (SELECT gj.status FROM generation_jobs gj JOIN video_projects vp ON vp.id = gj."videoProjectId" WHERE vp."userId" = $1 ORDER BY gj."createdAt" DESC LIMIT 1) AS generation_status,
       (SELECT gj."createdAt" FROM generation_jobs gj JOIN video_projects vp ON vp.id = gj."videoProjectId" WHERE vp."userId" = $1 ORDER BY gj."createdAt" DESC LIMIT 1) AS generation_at,
       (SELECT status FROM leadgen_runs WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS leadgen_status,
       (SELECT "errorMessage" FROM leadgen_runs WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS leadgen_err,
       (SELECT "createdAt" FROM leadgen_runs WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS leadgen_at,
       (SELECT status FROM job_applications WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1) AS career_status,
       (SELECT "updatedAt" FROM job_applications WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1) AS career_at,
       (SELECT status FROM scan_history WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS scan_status,
       (SELECT "createdAt" FROM scan_history WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS scan_at,
       (SELECT tool FROM jarvis_actions WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS jarvis_tool,
       (SELECT summary FROM jarvis_actions WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS jarvis_summary,
       (SELECT "createdAt" FROM jarvis_actions WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS jarvis_at,
       (SELECT status FROM automation_runs WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS automation_status,
       (SELECT detail FROM automation_runs WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS automation_detail,
       (SELECT "createdAt" FROM automation_runs WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1) AS automation_at,
       (SELECT status FROM linkedin_posts WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1) AS linkedin_status,
       (SELECT "updatedAt" FROM linkedin_posts WHERE "userId" = $1 ORDER BY "updatedAt" DESC LIMIT 1) AS linkedin_at,
       (SELECT status FROM job_hunt_runs WHERE "userId" = $1 AND node = 'sourcer' ORDER BY "createdAt" DESC LIMIT 1) AS jobhunt_status,
       (SELECT detail FROM job_hunt_runs WHERE "userId" = $1 AND node = 'sourcer' ORDER BY "createdAt" DESC LIMIT 1) AS jobhunt_detail,
       (SELECT "createdAt" FROM job_hunt_runs WHERE "userId" = $1 AND node = 'sourcer' ORDER BY "createdAt" DESC LIMIT 1) AS jobhunt_at`,
    [userId],
  )
  const r = q.rows[0] ?? {}
  const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : (v as string | null) ?? null)

  return {
    youtube: {
      status: classify(r.youtube_status, {
        published: "success",
        generated: "success",
        auto_approved: "success",
        scripting: "pending",
        script_ready: "pending",
        prompt_ready: "pending",
        generating: "pending",
        pending_approval: "pending",
        uploading: "pending",
        failed: "error",
        rejected: "error",
      }),
      detail: r.youtube_status ? `latest project: ${r.youtube_status}` : IDLE.detail,
      lastAt: iso(r.youtube_at),
    },
    generation: {
      status: classify(r.generation_status, { complete: "success", submitted: "pending", polling: "pending", failed: "error" }),
      detail: r.generation_status ? `latest job: ${r.generation_status}` : IDLE.detail,
      lastAt: iso(r.generation_at),
    },
    leadgen: {
      status: classify(r.leadgen_status, { completed: "success", running: "pending", failed: "error" }),
      detail: r.leadgen_err || (r.leadgen_status ? `latest run: ${r.leadgen_status}` : IDLE.detail),
      lastAt: iso(r.leadgen_at),
    },
    career: {
      status: classify(r.career_status, {
        offer: "success",
        interview: "success",
        applied: "success",
        responded: "success",
        evaluated: "success",
        shortlisted: "success",
        tailored: "success",
        outreach_prepared: "success",
        evaluating: "pending",
        pending_approval: "pending",
        discovered: "pending",
        rejected: "error",
        discarded: "error",
      }),
      detail: r.career_status ? `latest application: ${r.career_status}` : IDLE.detail,
      lastAt: iso(r.career_at),
    },
    career_scan: {
      status: classify(r.scan_status, { added: "success", skipped_title: "idle", skipped_dup: "idle", skipped_expired: "idle" }),
      detail: r.scan_status ? `latest scan: ${r.scan_status}` : IDLE.detail,
      lastAt: iso(r.scan_at),
    },
    jarvis: {
      status: r.jarvis_tool ? (String(r.jarvis_summary ?? "").startsWith("FAILED") ? "error" : "success") : "idle",
      detail: r.jarvis_summary || IDLE.detail,
      lastAt: iso(r.jarvis_at),
    },
    automation: {
      status: classify(r.automation_status, { succeeded: "success", started: "pending", failed: "error" }),
      detail: r.automation_detail || (r.automation_status ? `latest run: ${r.automation_status}` : IDLE.detail),
      lastAt: iso(r.automation_at),
    },
    linkedin: {
      status: classify(r.linkedin_status, {
        posted: "success",
        scheduled: "success",
        approved: "success",
        pending_review: "pending",
        rejected: "error",
      }),
      detail: r.linkedin_status ? `latest post: ${r.linkedin_status}` : IDLE.detail,
      lastAt: iso(r.linkedin_at),
    },
    jobhunt: {
      status: classify(r.jobhunt_status, { completed: "success", running: "pending", failed: "error" }),
      detail: r.jobhunt_detail || (r.jobhunt_status ? `sourcer: ${r.jobhunt_status}` : IDLE.detail),
      lastAt: iso(r.jobhunt_at),
    },
    static: IDLE,
  }
}

/**
 * Env/vault-driven "blocked" overlay — a few cheap boolean checks, no LLM.
 * A stub agent whose activation key is missing glows red (spec §2.4).
 */
export function blockedReasons(): Record<string, string> {
  const blocked: Record<string, string> = {}
  if (!process.env.HIGGSFIELD_API_KEY) {
    blocked["youtube.prompt_builder"] = "HIGGSFIELD_API_KEY not set — generation is a stub"
  }
  return blocked
}

/** Resolve a per-agent status from the source map + blocked overlay. */
export function agentStatus(agent: AgentDef, sources: StatusMap, blocked: Record<string, string>): SourceStatus {
  if (blocked[agent.key]) return { status: "error", detail: blocked[agent.key], lastAt: null }
  return sources[agent.statusSource] ?? IDLE
}

export { BASE_AGENTS }
