import "server-only"
// Graph mutation helpers — the ONE place agent-graph overlay writes happen.
// Both app/actions/playground.ts (UI) and lib/jarvis-orchestrator.ts (Jarvis
// god-mode) call these, so the Playground and Jarvis edit a single source of
// truth and can never drift (spec §2.6). Every mutation is audited into
// jarvis_actions. Zero LLM cost.

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { appConfig, jarvisActions } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { getOverlay, EMPTY_OVERLAY, type AgentGraphOverlay } from "@/lib/agent-graph"
import { AGENT_BY_KEY, type AgentDef, type AgentTier, type AgentGroup } from "@/lib/agent-registry"

async function writeOverlay(userId: string, overlay: AgentGraphOverlay) {
  const existing = await db
    .select({ id: appConfig.id })
    .from(appConfig)
    .where(and(eq(appConfig.userId, userId), eq(appConfig.key, "agent_graph")))
    .limit(1)
  if (existing.length > 0) {
    await db
      .update(appConfig)
      .set({ value: overlay as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(and(eq(appConfig.userId, userId), eq(appConfig.key, "agent_graph")))
  } else {
    await db.insert(appConfig).values({ id: randomUUID(), userId, key: "agent_graph", value: overlay as unknown as Record<string, unknown> })
  }
}

async function audit(userId: string, summary: string, payload: Record<string, unknown>) {
  try {
    await db.insert(jarvisActions).values({ id: randomUUID(), userId, tool: "agent_graph", summary, payload })
  } catch {
    // audit must never break the mutation
  }
}

function isLoadBearing(key: string): boolean {
  return Boolean(AGENT_BY_KEY[key]?.loadBearing)
}

// --- Mutations ------------------------------------------------------------------

export async function renameAgent(userId: string, key: string, name: string) {
  const overlay = await getOverlay(userId)
  overlay.renames = { ...overlay.renames, [key]: name.trim().slice(0, 40) }
  await writeOverlay(userId, overlay)
  await audit(userId, `Renamed ${key} → "${name.trim()}"`, { key, name })
  return { ok: true as const }
}

export async function setAgentPaused(userId: string, key: string, paused: boolean) {
  if (paused && isLoadBearing(key)) {
    return { ok: false as const, error: `"${AGENT_BY_KEY[key]?.displayName ?? key}" is load-bearing and cannot be paused.` }
  }
  const overlay = await getOverlay(userId)
  const set = new Set(overlay.paused ?? [])
  if (paused) set.add(key)
  else set.delete(key)
  overlay.paused = [...set]
  await writeOverlay(userId, overlay)
  await audit(userId, `${paused ? "Paused" : "Resumed"} ${key}`, { key, paused })
  return { ok: true as const }
}

export async function addAgent(userId: string, def: {
  displayName: string
  role: string
  tier: AgentTier
  group: AgentGroup
}) {
  const overlay = await getOverlay(userId)
  const key = `custom.${def.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30)}_${randomUUID().slice(0, 6)}`
  const agent: AgentDef = {
    key,
    displayName: def.displayName.trim().slice(0, 40),
    role: def.role.trim().slice(0, 200),
    tier: def.tier,
    group: def.group,
    statusSource: "static",
  }
  overlay.added = [...(overlay.added ?? []), agent]
  await writeOverlay(userId, overlay)
  await audit(userId, `Added agent "${agent.displayName}" (${key})`, { key, ...def })
  return { ok: true as const, key }
}

export async function deleteAgent(userId: string, key: string) {
  if (isLoadBearing(key)) {
    return { ok: false as const, error: `"${AGENT_BY_KEY[key]?.displayName ?? key}" is load-bearing and cannot be deleted.` }
  }
  const overlay = await getOverlay(userId)
  const isCustom = (overlay.added ?? []).some((a) => a.key === key)
  if (isCustom) {
    overlay.added = (overlay.added ?? []).filter((a) => a.key !== key)
  } else if (AGENT_BY_KEY[key]) {
    overlay.removed = [...new Set([...(overlay.removed ?? []), key])]
  } else {
    return { ok: false as const, error: "Unknown agent." }
  }
  // Clean up edges + pause/rename referencing the deleted node
  overlay.addedEdges = (overlay.addedEdges ?? []).filter((e) => e.source !== key && e.target !== key)
  overlay.paused = (overlay.paused ?? []).filter((k) => k !== key)
  await writeOverlay(userId, overlay)
  await audit(userId, `Deleted agent ${key}`, { key })
  return { ok: true as const }
}

export async function addEdge(userId: string, source: string, target: string, label?: string) {
  if (source === target) return { ok: false as const, error: "An agent can't hand off to itself." }
  const overlay = await getOverlay(userId)
  const id = `custom-${randomUUID().slice(0, 8)}`
  overlay.addedEdges = [...(overlay.addedEdges ?? []), { id, source, target, kind: "handoff", label: label?.slice(0, 40) }]
  await writeOverlay(userId, overlay)
  await audit(userId, `Wired ${source} → ${target}`, { source, target })
  return { ok: true as const, id }
}

export async function deleteEdge(userId: string, edgeId: string) {
  const overlay = await getOverlay(userId)
  const wasCustom = (overlay.addedEdges ?? []).some((e) => e.id === edgeId)
  if (wasCustom) {
    overlay.addedEdges = (overlay.addedEdges ?? []).filter((e) => e.id !== edgeId)
  } else {
    overlay.removedEdges = [...new Set([...(overlay.removedEdges ?? []), edgeId])]
  }
  await writeOverlay(userId, overlay)
  await audit(userId, `Removed edge ${edgeId}`, { edgeId })
  return { ok: true as const }
}

export async function setGroupOrchestrator(userId: string, group: AgentGroup, key: string) {
  const overlay = await getOverlay(userId)
  overlay.orchestrators = { ...overlay.orchestrators, [group]: key }
  await writeOverlay(userId, overlay)
  await audit(userId, `Set ${group} orchestrator → ${key}`, { group, key })
  return { ok: true as const }
}

export async function setAgentAutonomy(userId: string, key: string, level: "review" | "auto") {
  const overlay = await getOverlay(userId)
  overlay.autonomy = { ...overlay.autonomy, [key]: level }
  await writeOverlay(userId, overlay)
  await audit(userId, `Set ${key} autonomy → ${level}`, { key, level })
  return { ok: true as const }
}

export async function saveLayout(userId: string, layout: Record<string, { x: number; y: number }>) {
  const overlay = await getOverlay(userId)
  overlay.layout = layout
  await writeOverlay(userId, overlay)
  return { ok: true as const }
}

export async function resetGraph(userId: string) {
  await writeOverlay(userId, { ...EMPTY_OVERLAY })
  await audit(userId, "Reset agent graph to defaults", {})
  return { ok: true as const }
}
