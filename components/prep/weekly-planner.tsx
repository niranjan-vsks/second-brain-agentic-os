"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { getSessions, createSession, updateSession, deleteSession } from "@/app/actions/prep"
import type { Topic, StudySession } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react"

const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
] as const

function mondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(weekStart + "T00:00:00")
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export function WeeklyPlanner({ topics }: { topics: Topic[] }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ day: "mon", topicId: "none", plannedMinutes: "90", focus: "" })

  const { data: sessions = [], mutate } = useSWR<StudySession[]>(["sessions", weekStart], () => getSessions(weekStart))

  const totalPlanned = sessions.reduce((s, x) => s + x.plannedMinutes, 0)
  const totalDone = sessions.filter((s) => s.done).reduce((s, x) => s + x.plannedMinutes, 0)
  const budget = 15 * 60 // 15 hrs/week upper bound

  function handleCreate() {
    startTransition(async () => {
      await createSession({
        topicId: form.topicId === "none" ? null : Number(form.topicId),
        weekStart,
        day: form.day,
        plannedMinutes: Number(form.plannedMinutes) || 60,
        focus: form.focus.trim(),
      })
      await mutate()
      setForm({ day: "mon", topicId: "none", plannedMinutes: "90", focus: "" })
      setOpen(false)
    })
  }

  function toggleDone(s: StudySession) {
    startTransition(async () => {
      await updateSession(s.id, { done: !s.done })
      await mutate()
    })
  }

  function remove(id: number) {
    startTransition(async () => {
      await deleteSession(id)
      await mutate()
    })
  }

  const topicById = new Map(topics.map((t) => [t.id, t]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8 bg-transparent" onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="Previous week">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-32 text-center font-mono text-sm">Week of {weekStart}</span>
          <Button variant="outline" size="icon" className="size-8 bg-transparent" onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="Next week">
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {(totalPlanned / 60).toFixed(1)}h planned / 10-15h budget · {(totalDone / 60).toFixed(1)}h completed
        </span>
        {totalPlanned > budget && <span className="font-mono text-xs text-destructive">Over budget — cut P2/P3 sessions</span>}
        <Button size="sm" onClick={() => setOpen(true)} className="ml-auto gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          Add session
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {DAYS.map((day) => {
          const daySessions = sessions.filter((s) => s.day === day.id)
          return (
            <div key={day.id} className="flex min-h-24 flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <p className="font-mono text-[11px] tracking-widest text-muted-foreground">{day.label.toUpperCase()}</p>
              {daySessions.map((s) => {
                const topic = s.topicId ? topicById.get(s.topicId) : null
                return (
                  <div key={s.id} className="flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-2">
                    <Checkbox
                      checked={s.done}
                      onCheckedChange={() => toggleDone(s)}
                      disabled={isPending}
                      className="mt-0.5"
                      aria-label={`Mark session done: ${s.focus || topic?.title || "session"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium leading-snug ${s.done ? "text-muted-foreground line-through" : ""}`}>
                        {s.focus || topic?.title || "Study session"}
                      </p>
                      {topic && s.focus && <p className="truncate text-[10px] text-muted-foreground">{topic.title}</p>}
                      <p className="font-mono text-[10px] text-muted-foreground">{s.plannedMinutes}m</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 text-muted-foreground"
                      onClick={() => remove(s.id)}
                      disabled={isPending}
                      aria-label="Delete session"
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add study session</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Day</Label>
                <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="session-minutes">Minutes</Label>
                <Input
                  id="session-minutes"
                  type="number"
                  min={15}
                  step={15}
                  value={form.plannedMinutes}
                  onChange={(e) => setForm({ ...form, plannedMinutes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Topic (optional)</Label>
              <Select value={form.topicId} onValueChange={(v) => setForm({ ...form, topicId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Link a syllabus topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No topic</SelectItem>
                  {topics
                    .filter((t) => t.status !== "done")
                    .map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        P{t.priority} · {t.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="session-focus">Focus note</Label>
              <Input
                id="session-focus"
                placeholder="e.g. vLLM batching deep dive + notes"
                value={form.focus}
                onChange={(e) => setForm({ ...form, focus: e.target.value })}
              />
            </div>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? "Adding..." : "Add session"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
