"use client"

// Lead-Gen Agent panel — run the agent, review AI-qualified prospects,
// promote winners into the Outreach funnel or reject them.

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  getLeadgenStateAction,
  runLeadgenNowAction,
  promoteProspectAction,
  rejectProspectAction,
} from "@/app/actions/leadgen"
import { Bot, Play, Loader2, ArrowUpRight, X, MapPin, Phone, ExternalLink } from "lucide-react"

type State = Awaited<ReturnType<typeof getLeadgenStateAction>>

const STATUS_STYLES: Record<string, string> = {
  qualified: "border-primary/30 bg-primary/10 text-primary",
  discovered: "text-muted-foreground",
  promoted: "border-primary/30 text-primary",
  rejected: "text-muted-foreground line-through",
}

export function LeadgenPanel() {
  const { data, isLoading, mutate } = useSWR<State>("leadgen-state", () => getLeadgenStateAction())
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("")
  const [location, setLocation] = useState("")
  const [source, setSource] = useState<"maps_no_website" | "ai_upgrade">("maps_no_website")
  const [busyId, setBusyId] = useState("")

  async function runNow() {
    setRunning(true)
    setMessage("")
    const result = await runLeadgenNowAction({
      category: category.trim() || undefined,
      location: location.trim() || undefined,
      source,
    })
    setMessage(result.ok ? result.message : result.error)
    setRunning(false)
    mutate()
  }

  async function promote(id: string) {
    setBusyId(id)
    await promoteProspectAction(id)
    setBusyId("")
    mutate()
  }

  async function reject(id: string) {
    setBusyId(id)
    await rejectProspectAction(id)
    setBusyId("")
    mutate()
  }

  const prospects = data?.prospects ?? []
  const runs = data?.runs ?? []
  const actionable = prospects.filter((p) => p.status === "qualified" || p.status === "discovered")

  return (
    <div className="flex flex-col gap-4">
      {/* Run controls */}
      <div className="surface-raised flex flex-col gap-3 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">Lead-Gen Agent</p>
            <p className="text-xs text-muted-foreground">
              Discover → AI-qualify → promote into Outreach. Configure ICP, sources, and schedule in Settings → Agents.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <Input
            placeholder="Category override (e.g. dental clinics)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category override"
          />
          <Input
            placeholder="Location override (e.g. Hyderabad)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            aria-label="Location override"
          />
          <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Source mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maps_no_website">No-website hunt</SelectItem>
              <SelectItem value="ai_upgrade">AI-upgrade scan</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runNow} disabled={running} className="gap-1.5">
            {running ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            Run now
          </Button>
        </div>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>

      {/* Prospect list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Loading prospects...
        </div>
      ) : prospects.length === 0 ? (
        <div className="surface-raised rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No prospects yet. Add a discovery key in Settings → API Keys, then hit Run now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {prospects.map((p) => (
            <div key={p.id} className="surface-raised flex flex-col gap-2 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{p.businessName}</p>
                    {p.aiScore !== null ? (
                      <Badge
                        variant="outline"
                        className={
                          p.aiScore >= 60 ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground"
                        }
                      >
                        {p.aiScore}/100
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className={STATUS_STYLES[p.status] ?? ""}>
                      {p.status}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {p.source === "maps_no_website" ? "no-website" : "ai-upgrade"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{p.category}</span>
                    {p.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {p.location}
                      </span>
                    ) : null}
                    {p.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" aria-hidden="true" />
                        {p.phone}
                      </span>
                    ) : null}
                    {p.mapsUrl ? (
                      <a
                        href={p.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                        Maps
                      </a>
                    ) : null}
                  </div>
                </div>
                {(p.status === "qualified" || p.status === "discovered") && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promote(p.id)}
                      disabled={busyId === p.id}
                      className="gap-1"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      )}
                      To funnel
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => reject(p.id)}
                      disabled={busyId === p.id}
                      aria-label={`Reject ${p.businessName}`}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
              {p.pitchAngle ? <p className="text-xs leading-relaxed text-foreground">{p.pitchAngle}</p> : null}
              {p.aiRationale ? <p className="text-xs leading-relaxed text-muted-foreground">{p.aiRationale}</p> : null}
            </div>
          ))}
        </div>
      )}

      {/* Run history */}
      {runs.length > 0 ? (
        <details className="surface-raised rounded-xl p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Run history <span className="text-muted-foreground">({runs.length})</span>
          </summary>
          <div className="mt-3 flex flex-col gap-1.5">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className={r.status === "failed" ? "text-destructive" : r.status === "completed" ? "text-primary" : ""}
                >
                  {r.status}
                </Badge>
                <span className="font-mono">{new Date(r.createdAt).toLocaleString()}</span>
                <span>{r.query}</span>
                <span>
                  {r.prospectsFound} found · {r.prospectsQualified} qualified
                </span>
                {r.errorMessage ? <span className="text-destructive">{r.errorMessage}</span> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {actionable.length} prospect{actionable.length === 1 ? "" : "s"} awaiting review. Daily auto-run:{" "}
        {"enabled in Settings → Agents when the toggle is on."}
      </p>
    </div>
  )
}
