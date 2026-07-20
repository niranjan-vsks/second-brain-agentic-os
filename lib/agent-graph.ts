import "server-only"
// Effective agent graph = BASE registry ⊕ per-user overlay (app_config key
// "agent_graph"). Both the Playground UI and Jarvis mutate this ONE overlay, so
// the two surfaces can never drift (Section 2.6 of the spec).
//
// Overlay is intentionally small and declarative — it records only DIFFS from
// the base graph:
//   renames:       { [key]: newDisplayName }
//   paused:        string[]           — agent keys temporarily excluded
//   added:         AgentDef[]         — user-created agent nodes
//   removed:       string[]           — deleted (non-load-bearing) base keys
//   addedEdges:    AgentEdgeDef[]     — user-created wires
//   removedEdges:  string[]          — deleted base edge ids
//   orchestrators: { [group]: key }   — orchestrator override per group
//   layout:        { [key]: {x,y} }   — canvas node positions
//
// Zero LLM cost — pure data merge.

import { getConfig } from "@/lib/config"
import {
  BASE_AGENTS,
  BASE_EDGES,
  AGENT_GROUPS,
  type AgentDef,
  type AgentEdgeDef,
  type AgentGroup,
} from "@/lib/agent-registry"

export interface AgentGraphOverlay {
  renames: Record<string, string>
  paused: string[]
  added: AgentDef[]
  removed: string[]
  addedEdges: AgentEdgeDef[]
  removedEdges: string[]
  orchestrators: Partial<Record<AgentGroup, string>>
  layout: Record<string, { x: number; y: number }>
}

export const EMPTY_OVERLAY: AgentGraphOverlay = {
  renames: {},
  paused: [],
  added: [],
  removed: [],
  addedEdges: [],
  removedEdges: [],
  orchestrators: {},
  layout: {},
}

export interface EffectiveAgent extends AgentDef {
  paused: boolean
  isAdded: boolean
}

export interface EffectiveGraph {
  agents: EffectiveAgent[]
  edges: AgentEdgeDef[]
  groups: typeof AGENT_GROUPS
  layout: Record<string, { x: number; y: number }>
}

export async function getOverlay(userId: string): Promise<AgentGraphOverlay> {
  return getConfig<AgentGraphOverlay>(userId, "agent_graph", EMPTY_OVERLAY)
}

/** Merge base registry with a user overlay into the effective, renderable graph. */
export function mergeGraph(overlay: AgentGraphOverlay): EffectiveGraph {
  const removed = new Set(overlay.removed ?? [])
  const paused = new Set(overlay.paused ?? [])
  const renames = overlay.renames ?? {}
  const orchestratorOverride = overlay.orchestrators ?? {}

  const baseAgents: EffectiveAgent[] = BASE_AGENTS.filter((a) => !removed.has(a.key)).map((a) => ({
    ...a,
    displayName: renames[a.key] ?? a.displayName,
    // Group orchestrator override: promote the chosen key, demote the default.
    isOrchestrator:
      orchestratorOverride[a.group] !== undefined
        ? orchestratorOverride[a.group] === a.key
        : a.isOrchestrator,
    paused: paused.has(a.key),
    isAdded: false,
  }))

  const addedAgents: EffectiveAgent[] = (overlay.added ?? []).map((a) => ({
    ...a,
    displayName: renames[a.key] ?? a.displayName,
    paused: paused.has(a.key),
    isAdded: true,
  }))

  const agents = [...baseAgents, ...addedAgents]
  const liveKeys = new Set(agents.map((a) => a.key))

  const removedEdges = new Set(overlay.removedEdges ?? [])
  const baseEdges = BASE_EDGES.filter(
    (e) => !removedEdges.has(e.id) && liveKeys.has(e.source) && liveKeys.has(e.target),
  )
  const addedEdges = (overlay.addedEdges ?? []).filter((e) => liveKeys.has(e.source) && liveKeys.has(e.target))

  return {
    agents,
    edges: [...baseEdges, ...addedEdges],
    groups: AGENT_GROUPS,
    layout: overlay.layout ?? {},
  }
}

/** Runtime check used at dispatch time: is this agent paused by the operator? */
export async function isAgentPaused(userId: string, agentKey: string): Promise<boolean> {
  try {
    const overlay = await getOverlay(userId)
    return (overlay.paused ?? []).includes(agentKey)
  } catch {
    return false // never block a real run on a graph-read failure
  }
}
