"use client"

// Career → Auto-Apply: the operator surface for the 4-node Job-Hunt engine.
// Config + per-node autonomy dials + the pipeline + the review-gate approval
// queue + run history. Nodes also render live in the Agent Playground.

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getJobHuntData,
  saveJobHuntConfigAction,
  runSourcerAction,
  runNodeAction,
  runCycleAction,
  approveApplicationAction,
  approveOutreachAction,
  discardJobAction,
} from "@/app/actions/jobhunt"
import { setAutonomyAction } from "@/app/actions/playground"
import { Loader2, Radar, Play, Send, CheckCircle2, Trash2, UserSearch, FileCheck2, Plus, X } from "lucide-react"

type Data = Awaited<ReturnType<typeof getJobHuntData>>
const NODES = [
  { key: "jobhunt.sourcer", label: "Sourcer", desc: "finds roles" },
  { key: "jobhunt.applicant", label: "Applicant", desc: "applies" },
  { key: "jobhunt.enricher", label: "Enricher", desc: "finds manager" },
  { key: "jobhunt.emissary", label: "Emissary", desc: "outreach" },
] as const

export function JobHuntPanel() {
  const { data, mutate, isLoading } = useSWR<Data>("jobhunt-data", () => getJobHuntData(), { refreshInterval: 20000 })
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState("")

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(""), 4000)
  }
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    try {
      const r = (await fn()) as { message?: string; staged?: number; processed?: number }
      flash(r?.message ?? (r?.processed !== undefined ? `Cycle processed ${r.processed}` : r?.staged !== undefined ? `Sourced ${r.staged}` : "Done"))
    } catch (e) {
      flash(e instanceof Error ? e.message : "failed")
    }
    setBusy("")
    mutate()
  }

  if (isLoading || !data) {
    return <div className="skeleton h-64 w-full rounded-xl" />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Control bar */}
      <Card className="surface-raised border-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Auto-Apply Engine</CardTitle>
              <CardDescription>
                Source roles across the internet → apply → find the manager → humanized outreach. Each node graduates from
                review to autopilot independently.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={busy !== ""} onClick={() => run("source", runSourcerAction)}>
                {busy === "source" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Radar className="mr-1.5 size-4" />}
                Source now
              </Button>
              <Button size="sm" disabled={busy !== ""} onClick={() => run("cycle", runCycleAction)}>
                {busy === "cycle" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
                Run cycle
              </Button>
            </div>
          </div>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </CardHeader>
        <CardContent>
          {/* Per-node autonomy dials */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NODES.map((n) => {
              const level = data.autonomy[n.key as keyof typeof data.autonomy]
              return (
                <div key={n.key} className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{n.label}</span>
                    <span className={`text-micro ${level === "auto" ? "text-primary" : "text-muted-foreground"}`}>
                      {level === "auto" ? "AUTO" : "REVIEW"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{n.desc}</span>
                  <Switch
                    checked={level === "auto"}
                    onCheckedChange={async (v) => {
                      await setAutonomyAction(n.key, v ? "auto" : "review")
                      mutate()
                    }}
                    aria-label={`${n.label} autonomy`}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Approval queue */}
      {data.approvalQueue.length > 0 && (
        <Card className="surface-raised border-0 ring-1 ring-warning/30">
          <CardHeader>
            <CardTitle>Needs your approval</CardTitle>
            <CardDescription>Review-gated steps waiting on you — one tap to send it live.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.approvalQueue.map((j) => (
              <div key={j.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{j.roleTitle}</p>
                    <p className="text-xs text-muted-foreground">{j.company}{j.manager ? ` · ${j.manager.name} (${j.manager.email || "no email"})` : ""}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {j.status === "pending_approval" && (
                      <Button size="sm" disabled={busy !== ""} onClick={() => run(`apv-${j.id}`, () => approveApplicationAction(j.id))}>
                        {busy === `apv-${j.id}` ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <FileCheck2 className="mr-1 size-3.5" />}
                        Approve + submit
                      </Button>
                    )}
                    {j.emailDraft && j.emailStatus === "draft" && (
                      <Button size="sm" variant="secondary" disabled={busy !== ""} onClick={() => run(`snd-${j.id}`, () => approveOutreachAction(j.id))}>
                        {busy === `snd-${j.id}` ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Send className="mr-1 size-3.5" />}
                        Send email
                      </Button>
                    )}
                  </div>
                </div>
                {j.emailDraft && (
                  <details className="rounded-md bg-secondary p-2">
                    <summary className="cursor-pointer text-[11px] text-muted-foreground">Email draft — {j.emailDraft.subject}</summary>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">{j.emailDraft.body}</p>
                    {j.linkedinDraft && <p className="mt-2 whitespace-pre-wrap border-t border-border pt-2 text-[11px] leading-relaxed"><span className="text-micro text-primary">LinkedIn DM:</span> {j.linkedinDraft}</p>}
                  </details>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ConfigCard data={data} onSaved={() => mutate()} />

      {/* Sourced pipeline */}
      <Card className="surface-raised border-0">
        <CardHeader>
          <CardTitle>Sourced roles</CardTitle>
          <CardDescription>Run any node on a single role, or let a cycle chain them.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sourced yet — configure discovery below and hit “Source now”.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.jobs.slice(0, 30).map((j) => (
                <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{j.roleTitle}</p>
                      <Badge variant="outline" className="text-[10px]">{j.status}</Badge>
                      {j.trackingId && <Badge variant="secondary" className="font-mono text-[9px]">{j.trackingId}</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {j.company}{j.manager?.email ? ` · ✉ ${j.manager.email}` : ""}{j.emailStatus === "sent" ? " · sent" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon-sm" variant="ghost" title="Apply" disabled={busy !== ""} onClick={() => run(`a-${j.id}`, () => runNodeAction("applicant", j.id))}>
                      {busy === `a-${j.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <FileCheck2 className="size-3.5" />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" title="Find manager" disabled={busy !== ""} onClick={() => run(`e-${j.id}`, () => runNodeAction("enricher", j.id))}>
                      {busy === `e-${j.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <UserSearch className="size-3.5" />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" title="Outreach" disabled={busy !== ""} onClick={() => run(`o-${j.id}`, () => runNodeAction("emissary", j.id))}>
                      {busy === `o-${j.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" title="Discard" disabled={busy !== ""} onClick={() => run(`d-${j.id}`, () => discardJobAction(j.id))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run history */}
      {data.runs.length > 0 && (
        <Card className="surface-raised border-0">
          <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1">
            {data.runs.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[9px] uppercase">{r.node}</Badge>
                  <span className={`text-micro ${r.status === "failed" ? "text-status-error" : r.status === "completed" ? "text-status-success" : "text-status-pending"}`}>{r.status}</span>
                  <span className="text-xs text-muted-foreground">{r.detail}</span>
                </span>
                <span className="text-micro text-muted-foreground/70">{new Date(r.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ConfigCard({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const [cfg, setCfg] = useState(data.config)
  const [busy, setBusy] = useState(false)
  const [nb, setNb] = useState({ name: "", url: "" })

  const save = async () => {
    setBusy(true)
    await saveJobHuntConfigAction(cfg)
    setBusy(false)
    onSaved()
  }

  return (
    <Card className="surface-raised border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Discovery config</CardTitle>
            <CardDescription>Search runs internet-wide on your keywords; seed boards are a headstart.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="jh-enabled" className="text-xs text-muted-foreground">24/7 cron</Label>
            <Switch id="jh-enabled" checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Role keywords (comma-separated)</Label>
          <Input value={cfg.roleKeywords} onChange={(e) => setCfg({ ...cfg, roleKeywords: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Locations</Label>
          <Input value={cfg.locations} onChange={(e) => setCfg({ ...cfg, locations: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Seed boards (headstart)</Label>
          <div className="flex flex-col gap-1.5">
            {cfg.boards.map((b, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs"><span className="font-medium">{b.name}</span> — {b.url}</span>
                <Button size="icon-xs" variant="ghost" onClick={() => setCfg({ ...cfg, boards: cfg.boards.filter((_, j) => j !== i) })}>
                  <X className="size-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Name" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} className="h-8 w-32" />
              <Input placeholder="https://board.com/jobs" value={nb.url} onChange={(e) => setNb({ ...nb, url: e.target.value })} className="h-8" />
              <Button size="sm" variant="secondary" disabled={!nb.name.trim() || !nb.url.trim()} onClick={() => { setCfg({ ...cfg, boards: [...cfg.boards, { name: nb.name.trim(), url: nb.url.trim() }] }); setNb({ name: "", url: "" }) }}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-4" />}
            Save config
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
