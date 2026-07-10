"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { runTrendScout, addManualTrend, deleteTrendItem } from "@/app/actions/linkedin"
import { composeDraft } from "@/app/actions/linkedin-agents"
import { Radar, Plus, Trash2, PenLine, ExternalLink } from "lucide-react"
import type { TrendItem } from "@/lib/types"
import { CLAIM_STATUSES } from "@/components/linkedin/claim-status"

export function TrendFeed({ trends }: { trends: TrendItem[] }) {
  const [isPending, startTransition] = useTransition()
  const [scoutResult, setScoutResult] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ title: "", url: "", summary: "" })

  function handleScout() {
    setScoutResult(null)
    startTransition(async () => {
      const r = await runTrendScout()
      setScoutResult(`Scanned ${r.scanned} items, added ${r.added} new.`)
    })
  }

  function handleAdd() {
    if (!form.title.trim()) return
    startTransition(async () => {
      await addManualTrend(form.title.trim(), form.url.trim(), form.summary.trim())
      setForm({ title: "", url: "", summary: "" })
      setAddOpen(false)
    })
  }

  const unused = trends.filter((t) => !t.used)
  const used = trends.filter((t) => t.used)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Sources: Hacker News, arXiv, GitHub (official APIs only). Never LinkedIn/X or login-walled platforms.
        </p>
        <div className="flex items-center gap-2">
          {scoutResult && <span className="font-mono text-xs text-primary">{scoutResult}</span>}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
              <Plus className="size-4" aria-hidden="true" />
              Manual Idea
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Manual Idea</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="trend-title">Title / idea</Label>
                  <Input id="trend-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="trend-url">URL (optional)</Label>
                  <Input id="trend-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="trend-summary">Notes</Label>
                  <Textarea id="trend-summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                </div>
                <Button onClick={handleAdd} disabled={isPending || !form.title.trim()}>
                  {isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" className="gap-1.5" onClick={handleScout} disabled={isPending}>
            <Radar className="size-4" aria-hidden="true" />
            {isPending ? "Scouting..." : "Run Trend Scout"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {unused.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No unused trends. Run the Trend Scout or add a manual idea.
          </p>
        )}
        {unused.map((t) => (
          <TrendRow key={t.id} trend={t} />
        ))}
      </div>

      {used.length > 0 && (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Used ({used.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {used.map((t) => (
              <TrendRow key={t.id} trend={t} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function TrendRow({ trend }: { trend: TrendItem }) {
  const [isPending, startTransition] = useTransition()
  const [draftOpen, setDraftOpen] = useState(false)
  const [claimStatus, setClaimStatus] = useState("insight")
  const [longForm, setLongForm] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  function handleCompose() {
    setStatus("Composing draft...")
    startTransition(async () => {
      try {
        await composeDraft({ trendItemId: trend.id, claimStatus, longForm })
        setStatus(null)
        setDraftOpen(false)
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed")
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-pretty">{trend.title}</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {trend.source}
          </Badge>
        </div>
        {trend.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{trend.summary}</p>}
      </div>
      <div className="flex items-center gap-2">
        {trend.url && (
          <Button variant="ghost" size="sm" className="h-8 px-2" render={<a href={trend.url} target="_blank" rel="noopener noreferrer" aria-label="Open source link" />}>
            <ExternalLink className="size-4" aria-hidden="true" />
          </Button>
        )}
        {!trend.used && (
          <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}>
              <PenLine className="size-4" aria-hidden="true" />
              Draft
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Compose Draft</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground text-pretty">{trend.title}</p>
                <div className="flex flex-col gap-2">
                  <Label>Claim status (mandatory — controls how the agent frames it)</Label>
                  <Select value={claimStatus} onValueChange={(v) => setClaimStatus(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLAIM_STATUSES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`longform-${trend.id}`}
                    checked={longForm}
                    onChange={(e) => setLongForm(e.target.checked)}
                    className="size-4"
                  />
                  <Label htmlFor={`longform-${trend.id}`}>Long-form (400-600 words)</Label>
                </div>
                {status && <p className="font-mono text-xs text-muted-foreground">{status}</p>}
                <Button onClick={handleCompose} disabled={isPending}>
                  {isPending ? "Composing..." : "Compose Draft"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => startTransition(() => deleteTrendItem(trend.id))}
          aria-label={`Delete trend ${trend.title}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
