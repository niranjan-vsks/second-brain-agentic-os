"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { approveProject, rejectProject, getScripts, getGenerationJobs } from "@/app/actions/youtube"
import { requestEdit, getEditVersions } from "@/app/actions/edits"
import { useRouter } from "next/navigation"
import { Check, X, Scissors, Loader2 } from "lucide-react"
import type { VideoProject } from "@/lib/types"

export function VideoReviewQueue({ projects }: { projects: VideoProject[] }) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center font-mono text-xs text-muted-foreground">
            Nothing pending review. Videos land here after generation completes (unless bypass approval is on).
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {projects.map((p) => (
        <ReviewCard key={p.id} project={p} />
      ))}
    </div>
  )
}

function ReviewCard({ project }: { project: VideoProject }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editPrompt, setEditPrompt] = useState("")
  const [showEdit, setShowEdit] = useState(false)

  const { data: detail } = useSWR(`video-detail-${project.id}`, async () => {
    const [scripts, jobs, versions] = await Promise.all([
      getScripts(project.id),
      getGenerationJobs(project.id),
      getEditVersions(project.id),
    ])
    const latestScript = scripts[0]?.scriptText ?? ""
    const currentVersion = versions.find((v) => v.isCurrent)
    const latestJob = jobs.find((j) => j.blobUrl)
    return {
      script: latestScript,
      editVersions: versions,
      currentVideoUrl: currentVersion?.blobUrl ?? latestJob?.blobUrl ?? null,
    }
  })

  function act(action: "approve" | "reject") {
    startTransition(async () => {
      if (action === "approve") await approveProject(project.id)
      else await rejectProject(project.id)
      router.refresh()
    })
  }

  function submitEdit() {
    if (!editPrompt.trim()) return
    startTransition(async () => {
      await requestEdit(project.id, editPrompt)
      setEditPrompt("")
      setShowEdit(false)
      router.refresh()
    })
  }

  const videoUrl = detail?.currentVideoUrl

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm text-pretty">{project.topic}</CardTitle>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px]">
              {project.videoFormat}
            </Badge>
            <Badge className="font-mono text-[10px]">pending approval</Badge>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowEdit(!showEdit)}>
            <Scissors className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => act("reject")} disabled={isPending}>
            <X className="size-3.5" aria-hidden="true" />
            Reject
          </Button>
          <Button size="sm" className="gap-1" onClick={() => act("approve")} disabled={isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" aria-hidden="true" />}
            Approve & Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {videoUrl ? (
          <video src={videoUrl} controls className="max-h-96 w-full rounded-md border border-border bg-black" />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border">
            <span className="font-mono text-xs text-muted-foreground">Video preview unavailable (job may still be syncing)</span>
          </div>
        )}
        {detail?.script && (
          <details>
            <summary className="cursor-pointer font-mono text-xs text-muted-foreground">View script</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed">{detail.script}</pre>
          </details>
        )}
        {detail?.editVersions && detail.editVersions.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Edit versions</span>
            <div className="flex flex-wrap gap-1.5">
              {detail.editVersions.map((v) => (
                <Badge key={v.id} variant={v.isCurrent ? "default" : "outline"} className="font-mono text-[10px]">
                  v{v.versionNumber}
                  {v.isCurrent ? " (current)" : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {showEdit && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <Label htmlFor={`edit-${project.id}`} className="text-xs">
              Edit instruction (natural language, rendered via Remotion)
            </Label>
            <Textarea
              id={`edit-${project.id}`}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={2}
              placeholder="Trim the first 2 seconds and add the hook text overlay at 0:00-0:03"
            />
            <Button size="sm" onClick={submitEdit} disabled={isPending || !editPrompt.trim()} className="self-start">
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Submit Edit Request"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
