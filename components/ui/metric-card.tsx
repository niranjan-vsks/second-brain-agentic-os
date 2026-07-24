"use client"

// Premium flip metric card — glassmorphic 3D card that flips on hover to reveal
// a one-line explanation of what the metric means. Used across the live-metrics
// and status dashboards. Keyboard-accessible (flips on focus too).

import type { ReactNode } from "react"

export function MetricCard({
  label,
  value,
  hint,
  icon,
  accent = false,
  status,
}: {
  label: string
  value: ReactNode
  /** one-liner shown on the flipped back face */
  hint: string
  icon?: ReactNode
  accent?: boolean
  /** optional status dot color */
  status?: "success" | "pending" | "error" | "idle"
}) {
  const statusDot =
    status === "success"
      ? "bg-status-success"
      : status === "pending"
        ? "bg-status-pending"
        : status === "error"
          ? "bg-status-error"
          : status === "idle"
            ? "bg-muted-foreground/40"
            : ""

  return (
    <div className="flip-card h-32 select-none" tabIndex={0} aria-label={`${label}: ${value}. ${hint}`}>
      <div className="flip-card-inner">
        {/* Front */}
        <div className={`flip-face glass-card p-4 ${accent ? "surface-glow" : ""}`}>
          <div className="flex items-start justify-between">
            <span className="text-micro text-muted-foreground">{label}</span>
            {status ? (
              <span className={`mt-0.5 size-2 rounded-full ${statusDot}`} aria-hidden="true" />
            ) : icon ? (
              <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
            ) : null}
          </div>
          <span className={`mt-2 font-mono text-3xl font-semibold tracking-tight ${accent ? "text-primary" : ""}`}>
            {value}
          </span>
          <span className="mt-auto text-[10px] text-muted-foreground/60">hover for detail</span>
        </div>
        {/* Back */}
        <div className="flip-face flip-back glass-card scanline-edge p-4">
          <div className="flex items-center gap-1.5">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <span className="text-micro text-primary">{label}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  )
}
