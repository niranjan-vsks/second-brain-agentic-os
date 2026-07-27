"use client"

import { useRef, useState } from "react"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import type { Resume } from "@/lib/types"
import { getMasterResumes, saveMasterResume, deleteMasterResume } from "@/app/actions/career"
import { parseResumeFileAction } from "@/app/actions/resume-import"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Plus, Upload, Trash2 } from "lucide-react"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(",") + 1)) // strip the data: URL prefix
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Upload a PDF/DOCX/MD/TXT file, extract it server-side to markdown, and hand
// the text to the caller for review before saving — never auto-saves blindly.
function ResumeFileUpload({ onExtracted }: { onExtracted: (markdown: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function handleFile(file: File) {
    setBusy(true)
    setError("")
    try {
      const base64 = await fileToBase64(file)
      const result = await parseResumeFileAction(base64, file.name)
      if (result.ok) onExtracted(result.markdown)
      else setError(result.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read the file")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload PDF / DOCX / Markdown
        </Button>
        <span className="text-xs text-muted-foreground">or paste below</span>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

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

  async function removeResume(r: Resume) {
    if (!window.confirm(`Delete master resume "${r.label}"? This also removes any tailored versions built from it. Can't be undone.`)) return
    setBusy(true)
    try {
      await deleteMasterResume(r.id)
      if (selectedId === r.id) {
        setSelectedId(null)
        setEditContent(null)
      }
      mutate("career-resumes")
      toast.success(`Deleted "${r.label}"`)
    } catch (e) {
      toast.error("Couldn't delete resume", { description: e instanceof Error ? e.message : undefined })
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
              <ResumeFileUpload onExtracted={setNewContent} />
              <Textarea
                placeholder="Paste your current FDE-focused resume markdown here, or upload a file above. This becomes the source of truth for all tailoring — the agent never fabricates beyond it."
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
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditContent(selected.baseContent)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeResume(selected)}
                    disabled={busy}
                    aria-label={`Delete ${selected.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
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
              <div className="flex flex-col gap-2">
                <ResumeFileUpload onExtracted={setEditContent} />
                <Textarea rows={22} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
