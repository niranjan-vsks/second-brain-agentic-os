"use client"

import { useState, useTransition } from "react"
import { createDrill, updateDrill, deleteDrill } from "@/app/actions/prep"
import { SYLLABUS_TRACKS } from "@/lib/constants"
import type { Drill, Topic } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"

export function DrillBank({ drills, topics }: { drills: Drill[]; topics: Topic[] }) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [draftAnswers, setDraftAnswers] = useState<Record<number, string>>({})
  const [form, setForm] = useState({ question: "", difficulty: "medium", topicId: "none" })

  const topicById = new Map(topics.map((t) => [t.id, t]))

  function saveAnswer(drill: Drill) {
    const answer = draftAnswers[drill.id] ?? drill.answer
    startTransition(() => updateDrill(drill.id, { answer, status: answer.trim() ? "answered" : "unanswered" }))
  }

  function handleCreate() {
    if (!form.question.trim()) return
    startTransition(async () => {
      await createDrill({
        topicId: form.topicId === "none" ? null : Number(form.topicId),
        question: form.question.trim(),
        difficulty: form.difficulty,
      })
      setForm({ question: "", difficulty: "medium", topicId: "none" })
      setOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Practice out loud, then write your answer. Answered drills are your interview cheat sheet.
        </p>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          Add drill
        </Button>
      </div>

      {drills.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No drills yet. Load the syllabus from the Syllabus tab to seed 10 FDE-style questions, or add your own.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {drills.map((drill) => {
          const topic = drill.topicId ? topicById.get(drill.topicId) : null
          const track = topic ? SYLLABUS_TRACKS.find((t) => t.id === topic.track) : null
          const isOpen = expanded === drill.id
          return (
            <li key={drill.id} className="rounded-lg border border-border bg-card">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left"
                onClick={() => setExpanded(isOpen ? null : drill.id)}
                aria-expanded={isOpen}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-relaxed">{drill.question}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={drill.difficulty === "hard" ? "destructive" : "secondary"} className="font-mono text-[10px]">
                      {drill.difficulty.toUpperCase()}
                    </Badge>
                    {track && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {track.label}
                      </Badge>
                    )}
                    <Badge variant={drill.status === "answered" ? "default" : "outline"} className="font-mono text-[10px]">
                      {drill.status === "answered" ? "ANSWERED" : "UNANSWERED"}
                    </Badge>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-border p-4">
                  <Label htmlFor={`answer-${drill.id}`} className="text-xs text-muted-foreground">
                    Your answer / framework
                  </Label>
                  <Textarea
                    id={`answer-${drill.id}`}
                    rows={8}
                    className="font-mono text-xs leading-relaxed"
                    value={draftAnswers[drill.id] ?? drill.answer}
                    onChange={(e) => setDraftAnswers({ ...draftAnswers, [drill.id]: e.target.value })}
                    placeholder="Structure: requirements > constraints > high-level design > deep dives > tradeoffs > failure modes"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => saveAnswer(drill)} disabled={isPending}>
                      {isPending ? "Saving..." : "Save answer"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto gap-1.5 text-muted-foreground"
                      onClick={() => startTransition(() => deleteDrill(drill.id))}
                      disabled={isPending}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add drill</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="drill-question">Question</Label>
              <Textarea
                id="drill-question"
                rows={4}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
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
            <Button onClick={handleCreate} disabled={isPending || !form.question.trim()}>
              {isPending ? "Adding..." : "Add drill"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
