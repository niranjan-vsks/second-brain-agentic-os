"use server"

// Agent Playground server actions — read the effective agent graph + live
// status, and mutate the graph overlay. Every action getUserId()-scoped; every
// mutation delegates to lib/agent-graph-mutations (audited, single source of
// truth shared with Jarvis). Status is code-only (lib/agent-status) — ZERO LLM.

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getOverlay, mergeGraph } from "@/lib/agent-graph"
import { getStatusSources, blockedReasons, agentStatus } from "@/lib/agent-status"
import { AGENT_BY_KEY } from "@/lib/agent-registry"
import { getConfig, getAgentOverride } from "@/lib/config"
import {
  renameAgent,
  setAgentPaused,
  addAgent as addAgentMut,
  deleteAgent as deleteAgentMut,
  addEdge as addEdgeMut,
  deleteEdge as deleteEdgeMut,
  setGroupOrchestrator,
  setAgentAutonomy,
  saveLayout as saveLayoutMut,
  resetGraph as resetGraphMut,
} from "@/lib/agent-graph-mutations"
import type { AgentTier, AgentGroup } from "@/lib/agent-registry"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error("Not authenticated")
  return session.user.id
}

/** Full graph + live status. Cheap enough to SWR-poll (~30s). */
export async function getPlaygroundGraph() {
  const userId = await getUserId()
  const [overlay, sources] = await Promise.all([getOverlay(userId), getStatusSources(userId)])
  const graph = mergeGraph(overlay)
  const blocked = blockedReasons()

  const agents = graph.agents.map((a) => {
    const st = a.paused ? ({ status: "idle", detail: "paused by operator", lastAt: null } as const) : agentStatus(a, sources, blocked)
    return {
      key: a.key,
      displayName: a.displayName,
      role: a.role,
      tier: a.tier,
      group: a.group,
      isOrchestrator: Boolean(a.isOrchestrator),
      loadBearing: Boolean(a.loadBearing),
      paused: a.paused,
      isAdded: a.isAdded,
      autonomy: a.autonomy,
      status: st.status,
      statusDetail: st.detail,
      lastAt: st.lastAt,
    }
  })

  return {
    agents,
    edges: graph.edges,
    groups: graph.groups,
    layout: graph.layout,
  }
}

/** Deep inspector payload for one node (directives + skills + last error). */
export async function getAgentInspector(key: string) {
  const userId = await getUserId()
  const base = AGENT_BY_KEY[key]
  const overrideKey = base?.overrideKey
  const [directive, sources] = await Promise.all([
    overrideKey ? getAgentOverride(userId, overrideKey as never) : Promise.resolve(""),
    getStatusSources(userId),
  ])

  // Assigned Arsenal skills targeting this agent's override key
  let skills: { name: string; active: boolean }[] = []
  if (overrideKey) {
    try {
      const { db } = await import("@/lib/db")
      const { skills: skillsTable } = await import("@/lib/db/schema")
      const { eq, and } = await import("drizzle-orm")
      const rows = await db.select().from(skillsTable).where(and(eq(skillsTable.userId, userId), eq(skillsTable.active, true)))
      skills = rows
        .filter((s) => s.targetAgents.split(",").map((t) => t.trim()).includes(overrideKey))
        .map((s) => ({ name: s.name, active: s.active }))
    } catch {
      skills = []
    }
  }

  const st = base ? agentStatus(base, sources, blockedReasons()) : { status: "idle" as const, detail: "unknown agent", lastAt: null }
  return {
    key,
    directive,
    skills,
    status: st.status,
    statusDetail: st.detail,
    lastAt: st.lastAt,
    overrideKey: overrideKey ?? null,
  }
}

// --- Mutations (thin wrappers; logic + audit live in agent-graph-mutations) ---

export async function saveLayoutAction(layout: Record<string, { x: number; y: number }>) {
  const r = await saveLayoutMut(await getUserId(), layout)
  return r
}

export async function renameAgentAction(key: string, name: string) {
  const r = await renameAgent(await getUserId(), key, name)
  revalidatePath("/")
  return r
}

export async function setPausedAction(key: string, paused: boolean) {
  const r = await setAgentPaused(await getUserId(), key, paused)
  revalidatePath("/")
  return r
}

export async function addAgentAction(def: { displayName: string; role: string; tier: AgentTier; group: AgentGroup }) {
  const r = await addAgentMut(await getUserId(), def)
  revalidatePath("/")
  return r
}

export async function deleteAgentAction(key: string) {
  const r = await deleteAgentMut(await getUserId(), key)
  revalidatePath("/")
  return r
}

export async function addEdgeAction(source: string, target: string, label?: string) {
  const r = await addEdgeMut(await getUserId(), source, target, label)
  revalidatePath("/")
  return r
}

export async function deleteEdgeAction(edgeId: string) {
  const r = await deleteEdgeMut(await getUserId(), edgeId)
  revalidatePath("/")
  return r
}

export async function setOrchestratorAction(group: AgentGroup, key: string) {
  const r = await setGroupOrchestrator(await getUserId(), group, key)
  revalidatePath("/")
  return r
}

export async function setAutonomyAction(key: string, level: "review" | "auto") {
  const r = await setAgentAutonomy(await getUserId(), key, level)
  revalidatePath("/")
  return r
}

export async function resetGraphAction() {
  const r = await resetGraphMut(await getUserId())
  revalidatePath("/")
  return r
}

// Re-export config reader for the inspector's parameter view (avoids a client
// importing server config directly).
export async function getLayoutConfig() {
  const userId = await getUserId()
  return getConfig(userId, "agent_graph", { layout: {} } as { layout: Record<string, { x: number; y: number }> })
}
