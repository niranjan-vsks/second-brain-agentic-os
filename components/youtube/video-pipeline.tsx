"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createVideoProjects, transitionProject } from "@/app/actions/youtube"
import { composeScript, buildPromptAndGenerate } from "@/app/actions/youtube-agents"
import { useRouter } from "next/navigation"
import { Plus, Layers, RefreshCw, Loader2 } from "lucide-react"
import type { YoutubeChannel, VideoProject, PipelineSettings } from "@/lib/types"

const STAGE_LABELS: Record<string, string> = {
  draft: "Draft",
  scripting: "Scripting",
  script_ready: "Script Ready",
  prompt_ready: "Prompt Ready",
  generating: "Generating",
  generated: "Generated",
  pending_approval: "Pending Approval",
  auto_approved: "Auto-Approved",
  uploading: "Uploading",
  published: "Published",
  failed: "Failed",
  rejected: "Rejected",
}

const STAGE_ORDER = [
  "draft",
  "scripting",
  "script_ready",
  "prompt_ready",
  "generating",
  "generated",
  "pending_approval",
  "uploading",
  "published",
  "failed",
] as const

interface VideoPipelineProps {
  projects: VideoProject[]
  channels: YoutubeChannel[]
  settings: PipelineSettings | null
}

export function VideoPipeline({ projects, channels, settings }: VideoPipelineProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actingId, setActingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    topic: "",
    premise: "",
    channelId: channels[0]?.id ?? "",
    videoFormat: settings?.videoFormatDefault ?? "shorts",
    bypassApproval: settings?.defaultBypassApproval ?? false,
  })
  const [batchTopics, setBatchTopics] = useState("")

  const noChannels = channels.length === 0

  function submitCreate() {
    startTransition(async () => {
      await createVideoProjects({
        topics: [{ topic: form.topic, premise: form.premise }],
        channelId: form.channelId,
        videoFormat: form.videoFormat,
        bypassApproval: form.bypassApproval,
      })
      setOpen(false)
      setForm((f) => ({ ...f, topic: "", premise: "" }))
      router.refresh()
    })
  }

  function submitBatch() {
    const topics = batchTopics
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((topic) => ({ topic, premise: "" }))
    if (topics.length === 0) return
    startTransition(async () => {
      await createVideoProjects({
        topics,
        channelId: form.channelId,
        videoFormat: form.videoFormat,
        bypassApproval: form.bypassApproval,
      })
      setBatchOpen(false)
      setBatchTopics("")
      router.refresh()
    })
  }

  function advance(project: VideoProject) {
    setActingId(project.id)
    startTransition(async () => {
      try {
        if (project.status === "draft") await composeScript(project.id)
        else if (project.status === "script_ready") await buildPromptAndGenerate(project.id)
        else if (project.status === "prompt_ready") await buildPromptAndGenerate(project.id)
        else if (project.status === "failed") await transitionProject(project.id, "draft")
      } finally {
        setActingId(null)
        router.refresh()
      }
    })
  }

  const grouped = STAGE_ORDER.map((stage) => ({
    stage,
    items: projects.filter((p) => p.status === stage || (stage === "pending_approval" && p.status === "auto_approved")),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted-foreground">
          {"Draft → Script → Prompt → Generate → Review → Upload → Published"}
        </p>
        <div className="flex gap-2">
          <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" disabled={noChannels} />}>
              <Layers className="size-4" aria-hidden="true" />
              New Batch
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Batch</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="batch-topics">Topics (one per line)</Label>
                  <Textarea
                    id="batch-topics"
                    value={batchTopics}
                    onChange={(e) => setBatchTopics(e.target.value)}
                    rows={6}
                    placeholder={"AI agents for dental clinics\nWhy RAG fails in production\nMCP servers explained"}
                  />
                </div>
                <SharedFields form={form} setForm={setForm} channels={channels} />
                <Button onClick={submitBatch} disabled={isPending || !batchTopics.trim()}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : "Create Batch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" className="gap-1.5" disabled={noChannels} />}>
              <Plus className="size-4" aria-hidden="true" />
              New Video
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Video Project</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vp-topic">Topic</Label>
                  <Input
                    id="vp-topic"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    placeholder="Why most AI agents fail in production"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vp-premise">Premise (optional)</Label>
                  <Textarea
                    id="vp-premise"
                    value={form.premise}
                    onChange={(e) => setForm({ ...form, premise: e.target.value })}
                    rows={3}
                    placeholder="Angle, hook, or specific take for this video"
                  />
                </div>
                <SharedFields form={form} setForm={setForm} channels={channels} />
                <Button onClick={submitCreate} disabled={isPending || !form.topic.trim()}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {noChannels && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              No YouTube channel connected. Go to Channels & Settings to connect one (or add a stub channel to test the
              pipeline before OAuth is configured).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {grouped.map(({ stage, items }) => (
          <div key={stage} className="flex w-56 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {STAGE_LABELS[stage]}
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {items.length}
              </Badge>
            </div>
            <div className="flex min-h-24 flex-col gap-2 rounded-md border border-border bg-muted/20 p-2">
              {items.length === 0 && (
                <span className="p-2 text-center font-mono text-[10px] text-muted-foreground">Empty</span>
              )}
              {items.map((p) => (
                <div key={p.id} className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2.5">
                  <span className="text-xs font-medium leading-tight text-pretty">{p.topic}</span>
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant="outline" className="font-mono text-[9px]">
                      {p.videoFormat}
                    </Badge>
                    {p.batchId && (
                      <Badge variant="outline" className="font-mono text-[9px]">
                        batch
                      </Badge>
                    )}
                  </div>
                  {p.errorMessage && (
                    <p className="line-clamp-2 text-[10px] text-destructive" title={p.errorMessage}>
                      {p.errorMessage}
                    </p>
                  )}
                  {["draft", "script_ready", "prompt_ready", "failed"].includes(p.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-7 gap-1 font-mono text-[10px]"
                      disabled={isPending && actingId === p.id}
                      onClick={() => advance(p)}
                    >
                      {isPending && actingId === p.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : p.status === "failed" ? (
                        <>
                          <RefreshCw className="size-3" aria-hidden="true" />
                          Retry
                        </>
                      ) : p.status === "draft" ? (
                        "Write Script"
                      ) : p.status === "script_ready" ? (
                        "Build Prompt"
                      ) : (
                        "Generate Video"
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SharedFields({
  form,
  setForm,
  channels,
}: {
  form: {
    topic: string
    premise: string
    channelId: string
    videoFormat: string
    bypassApproval: boolean
  }
  setForm: (f: VideoPipelineFormState) => void
  channels: YoutubeChannel[]
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Channel</Label>
          <Select value={form.channelId} onValueChange={(v) => setForm({ ...form, channelId: v ?? "" })}>
            <SelectTrigger>
              <SelectValue placeholder="Select channel">
                {channels.find((c) => c.id === form.channelId)?.channelName ?? "Select channel"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.channelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Format</Label>
          <Select value={form.videoFormat} onValueChange={(v) => setForm({ ...form, videoFormat: v ?? "shorts" })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shorts">Shorts</SelectItem>
              <SelectItem value="long_form">Long Form</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="vp-bypass"
          checked={form.bypassApproval}
          onCheckedChange={(v) => setForm({ ...form, bypassApproval: v === true })}
        />
        <Label htmlFor="vp-bypass" className="text-xs text-muted-foreground">
          Bypass approval (auto-publish when sanity floor passes)
        </Label>
      </div>
    </>
  )
}

type VideoPipelineFormState = {
  topic: string
  premise: string
  channelId: string
  videoFormat: string
  bypassApproval: boolean
}
