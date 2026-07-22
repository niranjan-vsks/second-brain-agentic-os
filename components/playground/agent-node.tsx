"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Crown, Pause, Zap, Gauge, Feather, CircuitBoard } from "lucide-react"

export interface AgentNodeData extends Record<string, unknown> {
  displayName: string
  role: string
  tier: "light" | "standard" | "heavy" | "deterministic"
  status: "success" | "pending" | "error" | "idle"
  isOrchestrator: boolean
  paused: boolean
  speaking?: boolean
  selected?: boolean
}

const TIER_META: Record<AgentNodeData["tier"], { label: string; icon: typeof Zap; cls: string }> = {
  light: { label: "light", icon: Feather, cls: "text-muted-foreground" },
  standard: { label: "standard", icon: Gauge, cls: "text-primary" },
  heavy: { label: "heavy", icon: Zap, cls: "text-warning" },
  deterministic: { label: "no-llm", icon: CircuitBoard, cls: "text-muted-foreground" },
}

const STATUS_DOT: Record<AgentNodeData["status"], string> = {
  success: "bg-status-success",
  pending: "bg-status-pending",
  error: "bg-status-error",
  idle: "bg-muted-foreground/40",
}

function glowClass(status: AgentNodeData["status"], paused: boolean): string {
  if (paused) return "node-glow-idle"
  return `node-glow-${status}`
}

export const AgentNode = memo(function AgentNode({ data, selected }: NodeProps) {
  const d = data as AgentNodeData
  const tier = TIER_META[d.tier]
  const TierIcon = tier.icon

  return (
    <div
      className={`node-face press w-[196px] rounded-xl border p-3 transition-[box-shadow,transform,opacity] duration-200 ${
        d.speaking ? "node-speaking" : glowClass(d.status, d.paused)
      } ${selected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""} ${
        d.isOrchestrator ? "border-2" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-border !bg-muted" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-border !bg-primary" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {d.isOrchestrator && <Crown className="size-3.5 text-warning" aria-label="Orchestrator" />}
          <span className="text-sm font-semibold tracking-tight">{d.displayName}</span>
        </div>
        {d.speaking ? (
          <span className="voice-wave" aria-label="speaking">
            <span /><span /><span /><span />
          </span>
        ) : (
          <span className={`mt-1 size-2 shrink-0 rounded-full ${STATUS_DOT[d.status]}`} aria-label={d.status} />
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{d.role}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 text-micro ${tier.cls}`}>
          <TierIcon className="size-3" aria-hidden="true" />
          {tier.label}
        </span>
        {d.paused && (
          <span className="inline-flex items-center gap-1 text-micro text-muted-foreground">
            <Pause className="size-3" aria-hidden="true" />
            paused
          </span>
        )}
      </div>
    </div>
  )
})

export interface GroupNodeData extends Record<string, unknown> {
  label: string
}

export const GroupNode = memo(function GroupNode({ data, width, height }: NodeProps) {
  const d = data as GroupNodeData
  return (
    <div
      className="rounded-2xl border border-border/70 bg-card/40 ring-1 ring-inset ring-primary/5"
      style={{ width: width ?? 400, height: height ?? 200 }}
    >
      <span className="text-micro absolute left-3 top-2 text-muted-foreground">{d.label}</span>
    </div>
  )
})
