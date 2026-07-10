"use client"

import { useState, useTransition } from "react"
import { SYLLABUS_TRACKS } from "@/lib/constants"
import { updateTopicStatus, deleteTopic, createTopic, seedSyllabus } from "@/app/actions/prep"
import type { Topic } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Sparkles, Circle, CircleDot, CheckCircle2 } from "lucide-react"

const STATUS_CYCLE: Record<string, string> = {
  "not-started": "in-progress",
  "in-progress": "done",
  done: "not-started",
}

export function SyllabusView({ topics }: { topics: Topic[] }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ track: "system-design", title: "", description: "", priority: "1" })

  function cycle(topic: Topic) {
    startTransition(() => updateTopicStatus(topic.id, STATUS_CYCLE[topic.status] ?? "in-progress"))
  }

  function handleCreate() {
    if (!form.title.trim()) return
    startTransition(async () => {
      await createTopic({
        track: form.track,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: Number(form.priority),
      })
      setForm({ track: "system-design", title: "", description: "", priority: "1" })
      setOpen(false)
    })
  }

  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No syllabus yet. Load the curated FDE prep syllabus tuned for an aggressive 1-2 month timeline.
        </p>
        <Button
          onClick={() =>
            startTransition(async () => {
              await seedSyllabus()
            })
          }
          disabled={isPending}
          className="gap-2"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {isPending ? "Loading syllabus..." : "Load FDE syllabus (25 topics + 10 drills)"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Click the status icon to cycle: not started, in progress, done.</p>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          Add topic
        </Button>
      </div>

      {SYLLABUS_TRACKS.map((track) => {
        const trackTopics = topics.filter((t) => t.track === track.id)
        if (trackTopics.length === 0) return null
        const doneCount = trackTopics.filter((t) => t.status === "done").length
        return (
          <section key={track.id} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <h3 className="font-mono text-sm font-semibold">{track.label}</h3>
              <Progress value={(doneCount / trackTopics.length) * 100} className="h-1.5 max-w-32 flex-1" />
              <span className="font-mono text-xs text-muted-foreground">
                {doneCount}/{trackTopics.length}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {trackTopics.map((topic) => (
                <li key={topic.id} className="flex items-start gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => cycle(topic)}
                    disabled={isPending}
                    className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`Status: ${topic.status}. Click to change.`}
                  >
                    {topic.status === "done" ? (
                      <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                    ) : topic.status === "in-progress" ? (
                      <CircleDot className="size-4 text-chart-4" aria-hidden="true" />
                    ) : (
                      <Circle className="size-4" aria-hidden="true" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${topic.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                      {topic.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{topic.description}</p>
                  </div>
                  <Badge variant={topic.priority === 1 ? "destructive" : "secondary"} className="shrink-0 font-mono text-[10px]">
                    P{topic.priority}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() => startTransition(() => deleteTopic(topic.id))}
                    disabled={isPending}
                    aria-label={`Delete topic ${topic.title}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add topic</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="topic-title">Title</Label>
              <Input id="topic-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="topic-desc">Description</Label>
              <Textarea id="topic-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Track</Label>
                <Select value={form.track} onValueChange={(v) => setForm({ ...form, track: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYLLABUS_TRACKS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">P1 - Critical</SelectItem>
                    <SelectItem value="2">P2 - Important</SelectItem>
                    <SelectItem value="3">P3 - Nice to have</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={isPending || !form.title.trim()}>
              {isPending ? "Adding..." : "Add topic"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
