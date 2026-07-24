"use client"

// Metric card — solid glass card with a subtle 3D tilt/lift on hover. On hover
// (or focus) it TYPES OUT the one-line explanation beneath the value. No flip,
// no backface tricks — rock-solid, never disappears.

import { useEffect, useRef, useState, type ReactNode } from "react"

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
  hint: string
  icon?: ReactNode
  accent?: boolean
  status?: "success" | "pending" | "error" | "idle"
}) {
  const [active, setActive] = useState(false)
  const [typed, setTyped] = useState("")
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (!active) {
      setTyped("")
      return
    }
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      setTyped(hint.slice(0, i))
      if (i >= hint.length && timer.current) clearInterval(timer.current)
    }, 16)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [active, hint])

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
    <div
      className={`metric-tilt metric-face group flex h-32 select-none flex-col p-4 ${accent ? "surface-glow" : ""}`}
      tabIndex={0}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      aria-label={`${label}: ${value}. ${hint}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-micro text-muted-foreground">{label}</span>
        {status ? (
          <span className={`mt-0.5 size-2 rounded-full ${statusDot}`} aria-hidden="true" />
        ) : icon ? (
          <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        ) : null}
      </div>

      <span className={`mt-2 font-mono text-3xl font-semibold tracking-tight ${accent ? "text-primary" : ""}`}>{value}</span>

      {/* Typewriter one-liner (bottom) */}
      <div className="mt-auto min-h-[2.1rem]">
        {active ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {typed}
            <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-primary align-middle" />
          </p>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">hover for detail</span>
        )}
      </div>
    </div>
  )
}
