"use client"

// Agent Playground — live, editable orchestration canvas over the REAL agent
// graph (lib/agent-registry ⊕ app_config overlay). Status is code-derived
// (zero LLM). Every edit goes through server actions that write the same
// overlay Jarvis writes, so the two surfaces stay in sync.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AgentNode, GroupNode } from "@/components/playground/agent-node"
import {
  getPlaygroundGraph,
  getAgentInspector,
  saveLayoutAction,
  renameAgentAction,
  setPausedAction,
  addAgentAction,
  deleteAgentAction,
  addEdgeAction,
  deleteEdgeAction,
  resetGraphAction,
} from "@/app/actions/playground"
import { speakLineForAgent, synthesizeSpeech } from "@/app/actions/agent-voice"
import { speakAsAgent, cancelSpeech, playBase64Audio } from "@/lib/speak-client"
import { X, Plus, RotateCcw, Loader2, Crown, Trash2, Pause, Play, CircleDot, ExternalLink, Volume2, Radio, MessageCircle } from "lucide-react"

type Graph = Awaited<ReturnType<typeof getPlaygroundGraph>>
type Inspector = Awaited<ReturnType<typeof getAgentInspector>>

const GROUP_ORDER = ["core", "linkedin", "youtube", "leadgen", "career", "freelance", "arsenal", "jobhunt"] as const
const LANE_W = 224
const BAND_H = 150
const BAND_GAP = 56
const LABEL_TOP = 40

const nodeTypes = { agent: AgentNode, group: GroupNode }

const STATUS_EDGE: Record<string, string> = {
  success: "var(--status-success)",
  pending: "var(--status-pending)",
  error: "var(--status-error)",
  idle: "var(--border)",
}

export function PlaygroundTab() {
  const { data, mutate, isLoading } = useSWR<Graph>("playground-graph", () => getPlaygroundGraph(), {
    refreshInterval: 15000,
  })
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [inspector, setInspector] = useState<Inspector | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState("")
  const [speakingKey, setSpeakingKey] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<{ key: string; name: string; line: string } | null>(null)
  const [introducing, setIntroducing] = useState(false)
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({})
  const introStopRef = useRef(false)

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3200)
  }, [])

  // Make one agent "speak": write its line (Jarvis, in the agent's voice) and
  // play it with that agent's distinct voice + speaking animation. Returns when
  // audio finishes. Prefers the OmniVoice seam, falls back to browser TTS.
  const speakAgent = useCallback(
    async (key: string, tier: string, mode: "introduce" | "ask", question?: string): Promise<void> => {
      const res = await speakLineForAgent(key, mode, question)
      if (!res.ok) {
        flash(res.error)
        return
      }
      setTranscript({ key, name: res.displayName, line: res.line })
      const profile = { gender: "male", pitch: 1, rate: 1, persona: "" }
      // Try premium OmniVoice; fall back to browser voices.
      let usedPremium = false
      try {
        const synth = await synthesizeSpeech(res.line, profile)
        if (synth.ok) {
          usedPremium = true
          await new Promise<void>((resolve) => {
            setSpeakingKey(key)
            playBase64Audio(synth.audioBase64, synth.mime, { onEnd: () => resolve() })
          })
        }
      } catch {
        // fall through to browser TTS
      }
      if (!usedPremium) {
        await new Promise<void>((resolve) => {
          setSpeakingKey(key)
          void speakAsAgent(key, tier, res.line, { onEnd: () => resolve() })
        })
      }
      setSpeakingKey(null)
    },
    [flash],
  )

  // Build canvas nodes/edges from the graph snapshot (preserving saved layout).
  useEffect(() => {
    if (!data) return
    const saved = { ...data.layout, ...positionsRef.current }
    const byGroup = new Map<string, Graph["agents"]>()
    for (const g of GROUP_ORDER) byGroup.set(g, [])
    for (const a of data.agents) byGroup.get(a.group)?.push(a)

    const groupNodes: Node[] = []
    const agentNodes: Node[] = []
    let band = 0
    for (const g of GROUP_ORDER) {
      const members = byGroup.get(g) ?? []
      if (members.length === 0) continue
      const bandY = band * (BAND_H + BAND_GAP)
      const width = members.length * LANE_W + 40
      groupNodes.push({
        id: `group-${g}`,
        type: "group",
        position: { x: 0, y: bandY },
        data: { label: data.groups.find((gr) => gr.id === g)?.label ?? g },
        width,
        height: BAND_H,
        draggable: false,
        selectable: false,
        zIndex: -1,
        style: { pointerEvents: "none" },
      })
      members.forEach((a, i) => {
        const auto = { x: 20 + i * LANE_W, y: bandY + LABEL_TOP }
        agentNodes.push({
          id: a.key,
          type: "agent",
          position: saved[a.key] ?? auto,
          data: {
            displayName: a.displayName,
            role: a.role,
            tier: a.tier,
            status: a.status,
            isOrchestrator: a.isOrchestrator,
            paused: a.paused,
          },
        })
      })
      band++
    }

    const statusOf = (key: string) => data.agents.find((a) => a.key === key)?.status ?? "idle"
    const flowEdges: Edge[] = data.edges.map((e) => {
      const s = statusOf(e.source)
      const control = e.kind === "control"
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: s === "pending",
        style: {
          stroke: STATUS_EDGE[s] ?? "var(--border)",
          strokeWidth: control ? 1 : 1.75,
          strokeDasharray: control ? "4 4" : undefined,
          opacity: control ? 0.5 : 0.85,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: STATUS_EDGE[s] ?? "var(--border)" },
        labelStyle: { fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.85 },
      }
    })

    setNodes([...groupNodes, ...agentNodes])
    setEdges(flowEdges)
  }, [data, setNodes, setEdges])

  // Reflect the speaking agent onto its node (patch only, no full rebuild).
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => (n.type === "agent" ? { ...n, data: { ...n.data, speaking: n.id === speakingKey } } : n)),
    )
  }, [speakingKey, setNodes])

  const introduceTeam = useCallback(async () => {
    if (!data) return
    setIntroducing(true)
    introStopRef.current = false
    for (const a of data.agents) {
      if (introStopRef.current) break
      // eslint-disable-next-line no-await-in-loop
      await speakAgent(a.key, a.tier, "introduce")
    }
    setIntroducing(false)
    setTranscript(null)
  }, [data, speakAgent])

  const stopIntroduce = useCallback(() => {
    introStopRef.current = true
    cancelSpeech()
    setSpeakingKey(null)
    setIntroducing(false)
  }, [])

  const persistPositions = useCallback(() => {
    const next: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) {
      if (n.type === "agent") next[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) }
    }
    positionsRef.current = next
    saveLayoutAction(next)
  }, [nodes])

  const openInspector = useCallback(async (key: string) => {
    setSelectedKey(key)
    setInspector(null)
    try {
      setInspector(await getAgentInspector(key))
    } catch {
      setInspector(null)
    }
  }, [])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      if (node.type === "agent") openInspector(node.id)
    },
    [openInspector],
  )

  const onConnect = useCallback(
    async (c: Connection) => {
      if (!c.source || !c.target) return
      const r = await addEdgeAction(c.source, c.target)
      if (!r.ok) flash(r.error ?? "Could not wire agents.")
      mutate()
    },
    [mutate, flash],
  )

  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      for (const e of deleted) await deleteEdgeAction(e.id)
      mutate()
    },
    [mutate],
  )

  const selectedAgent = useMemo(
    () => data?.agents.find((a) => a.key === selectedKey) ?? null,
    [data, selectedKey],
  )

  return (
    <div className="relative flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Legend />
        </div>
        <div className="flex items-center gap-2">
          {introducing ? (
            <Button variant="destructive" size="sm" onClick={stopIntroduce}>
              <Radio className="mr-1.5 size-4 animate-pulse" aria-hidden="true" /> Stop
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={introduceTeam} title="Each agent introduces itself in its own voice">
              <Volume2 className="mr-1.5 size-4" aria-hidden="true" /> Introduce team
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" /> Add agent
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await resetGraphAction()
              positionsRef.current = {}
              mutate()
              flash("Graph reset to defaults.")
            }}
          >
            <RotateCcw className="mr-1.5 size-4" aria-hidden="true" /> Reset
          </Button>
        </div>
      </div>

      {showAdd && <AddAgentPanel onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); mutate() }} />}

      {/* Canvas */}
      <div className="rf-agent-canvas grid-backdrop relative h-[62vh] min-h-[460px] overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="skeleton h-24 w-48" />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={persistPositions}
            onNodeClick={onNodeClick}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: "smoothstep" }}
            minZoom={0.25}
            maxZoom={1.6}
          >
            <Background gap={22} size={1} color="oklch(1 0 0 / 6%)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                const st = (n.data as { status?: string })?.status
                return st === "error"
                  ? "oklch(0.65 0.2 25)"
                  : st === "pending"
                    ? "oklch(0.82 0.15 85)"
                    : st === "success"
                      ? "oklch(0.78 0.16 160)"
                      : "oklch(0.4 0.01 160)"
              }}
              maskColor="oklch(0.13 0.007 160 / 70%)"
            />
          </ReactFlow>
        )}

        {/* Inspector drawer */}
        {selectedKey && selectedAgent && (
          <InspectorDrawer
            agent={selectedAgent}
            inspector={inspector}
            onClose={() => setSelectedKey(null)}
            onChanged={() => mutate()}
            flash={flash}
            speaking={speakingKey === selectedAgent.key}
            transcript={transcript?.key === selectedAgent.key ? transcript.line : ""}
            onIntroduce={() => speakAgent(selectedAgent.key, selectedAgent.tier, "introduce")}
            onAsk={(q) => speakAgent(selectedAgent.key, selectedAgent.tier, "ask", q)}
          />
        )}

        {/* Live speaking caption (roll-call / introductions) */}
        {transcript && speakingKey && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-40 w-[min(90%,540px)] -translate-x-1/2 rounded-xl border border-primary/30 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="voice-wave"><span /><span /><span /><span /></span>
              <span className="text-micro text-primary">{transcript.name}</span>
            </div>
            <p className="mt-1 text-sm leading-snug">{transcript.line}</p>
          </div>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
          {toast}
        </div>
      )}
      <p className="text-micro text-muted-foreground/70">
        Drag to rewire · click a node to inspect · drag an edge handle to connect · select an edge + Delete to cut it.
        Status refreshes every 15s from live run data — no tokens spent.
      </p>
    </div>
  )
}

function Legend() {
  const items = [
    { c: "bg-status-success", l: "healthy" },
    { c: "bg-status-pending", l: "in-flight" },
    { c: "bg-status-error", l: "failed / blocked" },
    { c: "bg-muted-foreground/40", l: "idle" },
  ]
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((i) => (
        <span key={i.l} className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
          <span className={`size-2 rounded-full ${i.c}`} /> {i.l}
        </span>
      ))}
    </div>
  )
}

function AddAgentPanel({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [tier, setTier] = useState<"light" | "standard" | "heavy" | "deterministic">("standard")
  const [group, setGroup] = useState<(typeof GROUP_ORDER)[number]>("core")
  const [busy, setBusy] = useState(false)

  return (
    <div className="surface-raised flex flex-col gap-3 rounded-xl p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="an-name" className="text-xs">Name</Label>
          <Input id="an-name" placeholder="e.g. Sifter" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="an-role" className="text-xs">Role</Label>
          <Input id="an-role" placeholder="One-line function" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Tier</Label>
          <Select value={tier} onValueChange={(v) => setTier((v as typeof tier) ?? "standard")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">light</SelectItem>
              <SelectItem value="standard">standard</SelectItem>
              <SelectItem value="heavy">heavy</SelectItem>
              <SelectItem value="deterministic">no-llm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Group</Label>
          <Select value={group} onValueChange={(v) => setGroup((v as typeof group) ?? "core")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUP_ORDER.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={busy || !name.trim() || !role.trim()}
          onClick={async () => {
            setBusy(true)
            await addAgentAction({ displayName: name, role, tier, group })
            setBusy(false)
            onAdded()
          }}
        >
          {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
          Add to canvas
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Custom nodes are visual/orchestration placeholders — wire them into flows and pause/route as needed. Model tier
        is a label; actual model routing stays env-controlled by design.
      </p>
    </div>
  )
}

function InspectorDrawer({
  agent,
  inspector,
  onClose,
  onChanged,
  flash,
  speaking,
  transcript,
  onIntroduce,
  onAsk,
}: {
  agent: Graph["agents"][number]
  inspector: Inspector | null
  onClose: () => void
  onChanged: () => void
  flash: (m: string) => void
  speaking: boolean
  transcript: string
  onIntroduce: () => void
  onAsk: (q: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(agent.displayName)
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState("")

  useEffect(() => {
    setNewName(agent.displayName)
    setRenaming(false)
  }, [agent.key, agent.displayName])

  const statusColor =
    agent.status === "error"
      ? "text-status-error"
      : agent.status === "pending"
        ? "text-status-pending"
        : agent.status === "success"
          ? "text-status-success"
          : "text-muted-foreground"

  return (
    <aside className="surface-raised absolute right-0 top-0 z-40 flex h-full w-[330px] max-w-[85%] flex-col gap-4 overflow-y-auto border-l border-border p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            {agent.isOrchestrator && <Crown className="size-4 text-warning" aria-hidden="true" />}
            {renaming ? (
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 w-40" />
            ) : (
              <h3 className="text-base font-semibold tracking-tight">{agent.displayName}</h3>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{agent.key}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-micro">{agent.tier}</Badge>
        <Badge variant="outline" className="text-micro">{agent.group}</Badge>
        <span className={`inline-flex items-center gap-1 text-micro ${statusColor}`}>
          <CircleDot className="size-3" aria-hidden="true" /> {agent.status}
        </span>
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{agent.role}</p>
      </div>

      {/* Talk to this agent — Jarvis answers in the agent's voice */}
      <section className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
        <div className="flex items-center justify-between">
          <span className="text-micro text-primary">Talk to {agent.displayName}</span>
          {speaking && (
            <span className="voice-wave"><span /><span /><span /><span /></span>
          )}
        </div>
        {transcript && <p className="rounded-md bg-card/70 p-2 text-[11px] leading-relaxed">{transcript}</p>}
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && question.trim()) {
                onAsk(question.trim())
                setQuestion("")
              }
            }}
            placeholder={`Ask ${agent.displayName} something…`}
            className="h-8"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!question.trim()}
            onClick={() => {
              onAsk(question.trim())
              setQuestion("")
            }}
            aria-label="Ask"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="justify-start" onClick={onIntroduce}>
          <Volume2 className="mr-1.5 size-4" aria-hidden="true" /> Introduce yourself
        </Button>
      </section>

      {/* Live status */}
      <section className="flex flex-col gap-1.5">
        <span className="text-micro text-muted-foreground/70">Live status</span>
        <p className="text-xs">{inspector?.statusDetail ?? agent.statusDetail}</p>
        {(inspector?.lastAt ?? agent.lastAt) && (
          <p className="font-mono text-[10px] text-muted-foreground">
            last activity: {new Date((inspector?.lastAt ?? agent.lastAt) as string).toLocaleString()}
          </p>
        )}
      </section>

      {/* Directive */}
      {inspector?.overrideKey && (
        <section className="flex flex-col gap-1.5">
          <span className="text-micro text-muted-foreground/70">Operator directive (Jarvis)</span>
          <p className="rounded-md bg-secondary p-2 text-[11px] leading-relaxed text-muted-foreground">
            {inspector.directive || "— none set —"}
          </p>
        </section>
      )}

      {/* Skills */}
      {inspector?.overrideKey && (
        <section className="flex flex-col gap-1.5">
          <span className="text-micro text-muted-foreground/70">Assigned Arsenal skills</span>
          {inspector.skills.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">— none assigned —</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {inspector.skills.map((s) => (
                <Badge key={s.name} variant="secondary" className="text-[10px]">{s.name}</Badge>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Deep-link hint */}
      <section className="flex flex-col gap-1.5">
        <span className="text-micro text-muted-foreground/70">Audit trail</span>
        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <ExternalLink className="size-3" aria-hidden="true" />
          Graph edits + agent runs are recorded in jarvis_actions (ask Jarvis: &quot;show recent agent_graph actions&quot;).
        </p>
      </section>

      {/* Controls */}
      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
          <span className="text-xs font-medium">{agent.paused ? "Paused" : "Active"}</span>
          <Switch
            checked={!agent.paused}
            onCheckedChange={async (v) => {
              setBusy(true)
              const r = await setPausedAction(agent.key, !v)
              setBusy(false)
              if (!r.ok) flash(r.error ?? "Could not change pause state.")
              onChanged()
            }}
            aria-label="Active toggle"
          />
        </div>
        <div className="flex gap-2">
          {renaming ? (
            <>
              <Button
                size="sm"
                className="flex-1"
                disabled={busy || !newName.trim()}
                onClick={async () => {
                  setBusy(true)
                  await renameAgentAction(agent.key, newName)
                  setBusy(false)
                  setRenaming(false)
                  onChanged()
                }}
              >
                Save name
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => setRenaming(true)}>
              Rename
            </Button>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-status-error hover:text-status-error"
          disabled={busy || agent.loadBearing}
          title={agent.loadBearing ? "Load-bearing — cannot be deleted" : "Delete agent"}
          onClick={async () => {
            setBusy(true)
            const r = await deleteAgentAction(agent.key)
            setBusy(false)
            if (!r.ok) flash(r.error ?? "Could not delete.")
            else {
              onClose()
              onChanged()
            }
          }}
        >
          <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
          {agent.loadBearing ? "Load-bearing (protected)" : "Delete agent"}
        </Button>
        {agent.paused ? (
          <span className="inline-flex items-center gap-1 text-micro text-muted-foreground">
            <Play className="size-3" aria-hidden="true" /> excluded from orchestration until resumed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-micro text-muted-foreground">
            <Pause className="size-3" aria-hidden="true" /> pause to temporarily remove from flows
          </span>
        )}
      </div>
    </aside>
  )
}
