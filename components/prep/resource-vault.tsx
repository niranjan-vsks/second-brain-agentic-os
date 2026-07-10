"use client"

import { useState, useTransition } from "react"
import { createResource, deleteResource } from "@/app/actions/prep"
import type { Resource, Topic } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, ExternalLink } from "lucide-react"

const KINDS = ["article", "paper", "video", "course", "repo", "notes"] as const

export function ResourceVault({ resources, topics }: { resources: Resource[]; topics: Topic[] }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("all")
  const [form, setForm] = useState({ title: "", url: "", kind: "article", topicId: "none", notes: "" })

  const topicById = new Map(topics.map((t) => [t.id, t]))
  const filtered = filter === "all" ? resources : resources.filter((r) => r.kind === filter)

  function handleCreate() {
    if (!form.title.trim()) return
    startTransition(async () => {
      await createResource({
        title: form.title.trim(),
        url: form.url.trim(),
        kind: form.kind,
        topicId: form.topicId === "none" ? null : Number(form.topicId),
        notes: form.notes.trim(),
      })
      setForm({ title: "", url: "", kind: "article", topicId: "none", notes: "" })
      setOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v ?? "")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpen(true)} className="ml-auto gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          Add resource
        </Button>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No resources saved yet. Add links, papers, and notes as you study.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.map((r) => {
          const topic = r.topicId ? topicById.get(r.topicId) : null
          return (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {r.title}
                      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <p className="text-sm font-medium">{r.title}</p>
                  )}
                  {topic && <p className="mt-0.5 truncate text-xs text-muted-foreground">{topic.title}</p>}
                </div>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                  {r.kind.toUpperCase()}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => startTransition(() => deleteResource(r.id))}
                  disabled={isPending}
                  aria-label={`Delete resource ${r.title}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
              {r.notes && <p className="text-xs leading-relaxed text-muted-foreground">{r.notes}</p>}
            </li>
          )
        })}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add resource</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="res-title">Title</Label>
              <Input id="res-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="res-url">URL</Label>
              <Input id="res-url" type="url" placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Topic (optional)</Label>
                <Select value={form.topicId} onValueChange={(v) => setForm({ ...form, topicId: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No topic</SelectItem>
                    {topics.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="res-notes">Notes</Label>
              <Textarea id="res-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleCreate} disabled={isPending || !form.title.trim()}>
              {isPending ? "Adding..." : "Add resource"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
