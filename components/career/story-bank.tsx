"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import type { InterviewStory } from "@/lib/types"
import { getInterviewStories, addInterviewStory, deleteInterviewStory } from "@/app/actions/career"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Plus, Trash2 } from "lucide-react"

const EMPTY = { situation: "", task: "", action: "", result: "", reflection: "", relatedRequirementTags: "" }

export function StoryBank() {
  const { data: stories } = useSWR("career-stories", () => getInterviewStories())
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function submit() {
    if (!form.situation.trim()) return
    setBusy(true)
    try {
      await addInterviewStory(form)
      setForm(EMPTY)
      setOpen(false)
      mutate("career-stories")
    } finally {
      setBusy(false)
    }
  }

  const list = (stories as InterviewStory[] | undefined) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          STAR(R) stories reused across interviews. Tag with requirement themes so evaluation Block F can reference
          them.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4" />
            New Story
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New STAR(R) Story</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Textarea placeholder="Situation" rows={2} value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value })} />
              <Textarea placeholder="Task" rows={2} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
              <Textarea placeholder="Action" rows={3} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
              <Textarea placeholder="Result (quantified)" rows={2} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
              <Textarea placeholder="Reflection (optional)" rows={2} value={form.reflection} onChange={(e) => setForm({ ...form, reflection: e.target.value })} />
              <Input placeholder="Requirement tags (comma-separated, e.g. rag, stakeholder-mgmt)" value={form.relatedRequirementTags} onChange={(e) => setForm({ ...form, relatedRequirementTags: e.target.value })} />
              <Button onClick={submit} disabled={busy || !form.situation.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Story
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 && <p className="text-sm text-muted-foreground py-6">No stories yet.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-start justify-between gap-2">
                <span className="text-pretty">{s.situation.slice(0, 100)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  onClick={async () => {
                    await deleteInterviewStory(s.id)
                    mutate("career-stories")
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete story</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">T:</span> {s.task}</p>
              <p><span className="font-medium text-foreground">A:</span> {s.action}</p>
              <p><span className="font-medium text-foreground">R:</span> {s.result}</p>
              {s.reflection && <p><span className="font-medium text-foreground">R+:</span> {s.reflection}</p>}
              {s.relatedRequirementTags && (
                <div className="flex gap-1 flex-wrap">
                  {s.relatedRequirementTags.split(",").map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t.trim()}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
