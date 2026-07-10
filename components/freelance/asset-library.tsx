"use client"

import { useState } from "react"
import useSWR from "swr"
import { getAssets, createAsset, updateAsset, deleteAsset } from "@/app/actions/funnel"
import { BUILD_TYPES } from "@/lib/constants"
import type { Asset } from "@/lib/types"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Plus, Trash2, Check } from "lucide-react"

const CATEGORIES = [
  { id: "prompt", label: "Prompt" },
  { id: "architecture", label: "Architecture" },
  { id: "code-pattern", label: "Code Pattern" },
  { id: "sop", label: "SOP" },
]

export function AssetLibrary() {
  const { data: items, mutate } = useSWR("assets", () => getAssets())
  const [filter, setFilter] = useState<string>("all")
  const [buildFilter, setBuildFilter] = useState<string>("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const filtered = (items ?? []).filter(
    (a) =>
      (filter === "all" || a.category === filter) &&
      (buildFilter === "all" || a.buildType === buildFilter),
  )

  async function handleCopy(asset: Asset) {
    await navigator.clipboard.writeText(asset.content)
    setCopiedId(asset.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleDelete(id: number) {
    await deleteAsset(id)
    mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={buildFilter} onValueChange={(v) => setBuildFilter(v ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All build types</SelectItem>
            {BUILD_TYPES.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              if (!o) setEditing(null)
            }}
          >
            <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
              <Plus className="size-4" aria-hidden="true" />
              New asset
            </DialogTrigger>
            <AssetDialog
              editing={editing}
              onSaved={() => {
                setOpen(false)
                setEditing(null)
                mutate()
              }}
            />
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No assets yet. Save proven prompts, architectures, and code patterns here so every new
          build starts from a known-good baseline.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-medium hover:underline"
                  onClick={() => {
                    setEditing(asset)
                    setOpen(true)
                  }}
                >
                  {asset.title}
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => handleCopy(asset)}
                    aria-label="Copy content"
                  >
                    {copiedId === asset.id ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(asset.id)}
                    aria-label="Delete asset"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="line-clamp-3 font-mono text-xs text-muted-foreground">
                {asset.content}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                <Badge variant="secondary" className="text-xs">
                  {CATEGORIES.find((c) => c.id === asset.category)?.label ?? asset.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {BUILD_TYPES.find((b) => b.id === asset.buildType)?.label ?? asset.buildType}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssetDialog({ editing, onSaved }: { editing: Asset | null; onSaved: () => void }) {
  const [title, setTitle] = useState(editing?.title ?? "")
  const [category, setCategory] = useState(editing?.category ?? "prompt")
  const [buildType, setBuildType] = useState(editing?.buildType ?? "general")
  const [content, setContent] = useState(editing?.content ?? "")
  const [tags, setTags] = useState(editing?.tags ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    if (editing) {
      await updateAsset(editing.id, { title, category, buildType, content, tags })
    } else {
      await createAsset({ title, category, buildType, content, tags })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit asset" : "New asset"}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="asset-title">Title</Label>
          <Input
            id="asset-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. RAG reranker system prompt v3"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Build type</Label>
            <Select value={buildType} onValueChange={(v) => setBuildType(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUILD_TYPES.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="asset-content">Content</Label>
          <Textarea
            id="asset-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder="The prompt, architecture notes, or code pattern..."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="asset-tags">Tags (comma separated)</Label>
          <Input
            id="asset-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="reranking, claude, production"
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? "Saving..." : editing ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </DialogContent>
  )
}
