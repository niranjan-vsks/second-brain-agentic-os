"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  getArtifacts,
  createArtifact,
  updateArtifact,
  deleteArtifact,
  getDeals,
} from "@/app/actions/funnel"
import { ARTIFACT_TEMPLATES } from "@/lib/constants"
import type { Artifact } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, FileText, Plus, Trash2, Check } from "lucide-react"

export function ArtifactGenerator() {
  const { data: items, mutate } = useSWR("artifacts", () => getArtifacts())
  const { data: deals } = useSWR("deals-for-artifacts", () => getDeals())
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Artifact | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  async function handleCopy(a: Artifact) {
    await navigator.clipboard.writeText(a.content)
    setCopiedId(a.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleDelete(id: number) {
    await deleteArtifact(id)
    mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Generate client documents from battle-tested templates, pre-filled with deal context.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New artifact
        </Button>
      </div>

      {(items ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No artifacts yet. Generate a discovery doc, proposal, test plan, handoff doc, or outreach
          message from a template.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(items ?? []).map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left text-sm font-medium hover:underline"
                  onClick={() => setEditing(a)}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  {a.title}
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleCopy(a)}
                    aria-label="Copy artifact"
                  >
                    {copiedId === a.id ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(a.id)}
                    aria-label="Delete artifact"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="line-clamp-3 font-mono text-xs text-muted-foreground">{a.content}</p>
              <div className="mt-auto pt-1">
                <Badge variant="secondary" className="text-xs capitalize">
                  {a.type.replace("-", " ")}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <CreateArtifactDialog
          deals={deals ?? []}
          onSaved={() => {
            setCreating(false)
            mutate()
          }}
        />
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <EditArtifactDialog
            artifact={editing}
            onSaved={() => {
              setEditing(null)
              mutate()
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

function CreateArtifactDialog({
  deals,
  onSaved,
}: {
  deals: { id: number; name: string; client: string }[]
  onSaved: () => void
}) {
  const [templateId, setTemplateId] = useState(ARTIFACT_TEMPLATES[0].id)
  const [dealId, setDealId] = useState<string>("none")
  const [title, setTitle] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    const template = ARTIFACT_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    const deal = deals.find((d) => String(d.id) === dealId)
    const content = template.template
      .replaceAll("{client}", deal?.client || "[Client]")
      .replaceAll("{title}", deal?.name || title || "[Project]")
    setSaving(true)
    await createArtifact({
      dealId: deal?.id ?? null,
      type: templateId,
      title: title.trim() || `${template.label}${deal ? ` — ${deal.client}` : ""}`,
      content,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Generate artifact</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARTIFACT_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Link to deal (pre-fills client name)</Label>
          <Select value={dealId} onValueChange={(v) => setDealId(v ?? "")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No deal</SelectItem>
              {deals.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name} ({d.client})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="artifact-title">Title (optional)</Label>
          <Input
            id="artifact-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to template + client"
          />
        </div>
        <Button onClick={handleCreate} disabled={saving}>
          {saving ? "Generating..." : "Generate"}
        </Button>
      </div>
    </DialogContent>
  )
}

function EditArtifactDialog({ artifact, onSaved }: { artifact: Artifact; onSaved: () => void }) {
  const [title, setTitle] = useState(artifact.title)
  const [content, setContent] = useState(artifact.content)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await updateArtifact(artifact.id, { title, content })
    setSaving(false)
    onSaved()
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Edit artifact</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-artifact-title">Title</Label>
          <Input
            id="edit-artifact-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-artifact-content">Content (Markdown)</Label>
          <Textarea
            id="edit-artifact-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="font-mono text-xs"
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </DialogContent>
  )
}
