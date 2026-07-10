"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import type { Resume } from "@/lib/types"
import { getMasterResumes, saveMasterResume } from "@/app/actions/career"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Plus } from "lucide-react"

export function ResumeStudio() {
  const { data: resumes } = useSWR("career-resumes", () => getMasterResumes())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newContent, setNewContent] = useState("")

  const list = (resumes as Resume[] | undefined) ?? []
  const selected = list.find((r) => r.id === selectedId) ?? list[0]

  async function saveMaster() {
    if (!selected || editContent === null) return
    setBusy(true)
    try {
      await saveMasterResume(selected.label, editContent)
      setEditContent(null)
      mutate("career-resumes")
    } finally {
      setBusy(false)
    }
  }

  async function addResume() {
    if (!newLabel.trim()) return
    setBusy(true)
    try {
      await saveMasterResume(newLabel.trim(), newContent)
      setDialogOpen(false)
      setNewLabel("")
      setNewContent("")
      mutate("career-resumes")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {list.map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant={selected?.id === r.id ? "default" : "outline"}
            onClick={() => {
              setSelectedId(r.id)
              setEditContent(null)
            }}
          >
            {r.label}
          </Button>
        ))}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" variant="ghost" />}>
            <Plus className="h-4 w-4" />
            New Master Resume
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Master Resume</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Input placeholder='Label (e.g. "FDE Master")' value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <Textarea
                placeholder="Paste your current FDE-focused resume markdown here. This becomes the source of truth for all tailoring — the agent never fabricates beyond it."
                rows={14}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
              <Button onClick={addResume} disabled={busy || !newLabel.trim() || !newContent.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!selected && (
        <p className="text-sm text-muted-foreground py-6 text-pretty">
          No master resumes yet. Create one and paste your current FDE-focused resume markdown. All tailored versions
          derive from it; the tailoring agent may reorder and rephrase but never invent experience (source-of-truth
          rule).
        </p>
      )}

      {selected && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Master: {selected.label}</span>
              {editContent === null ? (
                <Button size="sm" variant="outline" onClick={() => setEditContent(selected.baseContent)}>
                  Edit
                </Button>
              ) : (
                <span className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditContent(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveMaster} disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editContent === null ? (
              <pre className="whitespace-pre-wrap text-xs font-sans max-h-[32rem] overflow-y-auto text-muted-foreground leading-relaxed">
                {selected.baseContent || "Empty — click Edit to paste content."}
              </pre>
            ) : (
              <Textarea rows={22} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
