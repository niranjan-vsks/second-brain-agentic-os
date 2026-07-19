import "server-only"
// n8n instance seam — same env-activation philosophy as Higgsfield/Remotion:
// honest stub until configured, zero code changes to go live.
//
// Config: base URL from Settings → Connections (n8nBaseUrl) or N8N_BASE_URL
// env; API key from the vault ("n8n" provider) or N8N_API_KEY env.
// The API key is created in the n8n UI: Settings → n8n API → Create key.
//
// Capabilities: deploy an imported workflow JSON to the instance, activate it,
// run it, and read execution status. Used by the Automations page and by
// Jarvis's run_automation tool.

import { getConfig, getSecret, CONNECTIONS_DEFAULTS } from "@/lib/config"

async function resolveN8n(userId: string): Promise<{ base: string; key: string } | null> {
  const conn = await getConfig(userId, "connections", CONNECTIONS_DEFAULTS)
  const base = process.env.N8N_BASE_URL || (conn as { n8nBaseUrl?: string }).n8nBaseUrl || ""
  if (!base) return null
  const key = (await getSecret(userId, "n8n", "n8n.api")) || ""
  if (!key) return null
  return { base: base.replace(/\/$/, ""), key }
}

export async function isN8nConfigured(userId: string): Promise<boolean> {
  return (await resolveN8n(userId)) !== null
}

async function n8nFetch<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const cfg = await resolveN8n(userId)
  if (!cfg) {
    throw new Error(
      "n8n not connected — set the instance URL in Settings → Connections and store an n8n API key in Settings → API Keys.",
    )
  }
  const res = await fetch(`${cfg.base}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": cfg.key,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`n8n ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json() as Promise<T>
}

/** Push a workflow definition to the connected n8n instance. Returns its n8n id. */
export async function deployWorkflow(
  userId: string,
  definition: Record<string, unknown>,
): Promise<string> {
  // n8n's create-workflow API accepts name/nodes/connections/settings only
  const payload = {
    name: (definition.name as string) || "operator_os import",
    nodes: definition.nodes ?? [],
    connections: definition.connections ?? {},
    settings: (definition.settings as Record<string, unknown>) ?? {},
  }
  const created = await n8nFetch<{ id: string }>(userId, "/workflows", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return created.id
}

/** Activate a deployed workflow (enables its own triggers/schedules on the instance). */
export async function activateWorkflow(userId: string, n8nWorkflowId: string): Promise<void> {
  await n8nFetch(userId, `/workflows/${n8nWorkflowId}/activate`, { method: "POST" })
}

/**
 * Run a deployed workflow once, now. Uses n8n's run endpoint; workflows whose
 * first node is a webhook/manual trigger execute immediately.
 */
export async function runWorkflow(
  userId: string,
  n8nWorkflowId: string,
): Promise<{ executionId?: string }> {
  const res = await n8nFetch<{ executionId?: string; id?: string }>(
    userId,
    `/workflows/${n8nWorkflowId}/run`,
    { method: "POST", body: JSON.stringify({}) },
  )
  return { executionId: res.executionId || res.id }
}

/** Latest executions for a workflow (status visibility on the Automations page). */
export async function getExecutions(
  userId: string,
  n8nWorkflowId: string,
  limit = 5,
): Promise<{ id: string; status: string; startedAt?: string }[]> {
  const res = await n8nFetch<{ data?: { id: string; status: string; startedAt?: string }[] }>(
    userId,
    `/executions?workflowId=${encodeURIComponent(n8nWorkflowId)}&limit=${limit}`,
  )
  return res.data ?? []
}

/** Structural inventory of a workflow JSON — deterministic, no LLM. */
export function inventoryWorkflow(definition: Record<string, unknown>): {
  name: string
  nodeCount: number
  nodeTypes: string[]
  triggers: string[]
  credentialsNeeded: string[]
} {
  const nodes = Array.isArray(definition.nodes) ? (definition.nodes as Record<string, unknown>[]) : []
  const nodeTypes = [...new Set(nodes.map((n) => String(n.type ?? "unknown")))]
  const triggers = nodes
    .filter((n) => String(n.type ?? "").toLowerCase().includes("trigger") || String(n.type ?? "").toLowerCase().includes("webhook"))
    .map((n) => String(n.name ?? n.type))
  const credentialsNeeded = [
    ...new Set(
      nodes.flatMap((n) =>
        n.credentials && typeof n.credentials === "object" ? Object.keys(n.credentials as object) : [],
      ),
    ),
  ]
  return {
    name: String(definition.name ?? "unnamed workflow"),
    nodeCount: nodes.length,
    nodeTypes,
    triggers,
    credentialsNeeded,
  }
}
