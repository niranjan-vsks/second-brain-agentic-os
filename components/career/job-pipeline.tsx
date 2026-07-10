"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { addJobManually, transitionJob, confirmApplied } from "@/app/actions/career"
import { runAutoPipeline, evaluateJob, tailorResume } from "@/app/actions/career-agents"
import { JobDetailDialog } from "@/components/career/job-detail-dialog"
import { Plus, Zap, Loader2 } from "lucide-react"
import type { JobApplication } from "@/lib/types"

const STATUS_COLORS: Record<string, string> = {
  discovered: "bg-muted text-muted-foreground",
  evaluating: "bg-muted text-muted-foreground",
  evaluated: "bg-secondary text-secondary-foreground",
  shortlisted: "bg-primary/15 text-primary",
  tailored: "bg-primary/15 text-primary",
  outreach_prepared: "bg-primary/15 text-primary",
  pending_approval: "bg-primary text-primary-foreground",
  applied: "bg-secondary text-secondary-foreground",
  responded: "bg-primary/15 text-primary",
  interview: "bg-primary text-primary-foreground",
  offer: "bg-primary text-primary-foreground",
  rejected: "bg-destructive/15 text-destructive",
  discarded: "bg-muted text-muted-foreground",
  skip: "bg-muted text-muted-foreground",
}

export function JobPipeline({ jobs, hasResume }: { jobs: JobApplication[]; hasResume: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailJob, setDetailJob] = useState<JobApplication | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ company: "", roleTitle: "", jobUrl: "", jobDescription: "", geography: "" })

  async function run(jobId: string, label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(`${jobId}:${label}`)
    setError(null)
    try {
      const r = await fn()
      if (!r.ok && r.error) setError(r.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  async function handleAdd() {
    if (!form.company.trim() || !form.roleTitle.trim()) return
    setBusy("add")
    try {
      await addJobManually({ ...form, portalSource: "manual" })
      setForm({ company: "", roleTitle: "", jobUrl: "", jobDescription: "", geography: "" })
      setAddOpen(false)
    } finally {
      setBusy(null)
    }
  }

  const active = jobs.filter((j) => !["rejected", "discarded", "skip"].includes(j.status))
  const closed = jobs.filter((j) => ["rejected", "discarded", "skip"].includes(j.status))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {active.length} active · {closed.length} closed
        </p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" aria-hidden="true" />
            Add Job
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Job Manually</DialogTitle>
              <DialogDescription>Paste a JD or URL — the auto-pipeline handles the rest.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="job-company">Company</Label>
                  <Input id="job-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="job-role">Role title</Label>
                  <Input id="job-role" value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="job-url">Job URL (optional)</Label>
                <Input id="job-url" value={form.jobUrl} onChange={(e) => setForm({ ...form, jobUrl: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="job-geo">Geography</Label>
                <Input id="job-geo" placeholder="e.g. Remote (US), Bangalore" value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="job-jd">Job description (paste, or leave empty to extract from URL)</Label>
                <Textarea id="job-jd" rows={6} value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} />
              </div>
              <Button onClick={handleAdd} disabled={busy === "add" || !form.company.trim() || !form.roleTitle.trim()}>
                {busy === "add" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Add to Pipeline"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {active.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No jobs in the pipeline. Add one manually or configure the scanner.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {active.map((job) => (
          <Card key={job.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {job.roleTitle} <span className="font-normal text-muted-foreground">@ {job.company}</span>
                  </CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge className={STATUS_COLORS[job.status] ?? ""} variant="secondary">
                      {job.status.replace(/_/g, " ")}
                    </Badge>
                    {job.evaluationScore && (
                      <Badge variant="outline" className="font-mono">
                        {job.evaluationScore}/5
                      </Badge>
                    )}
                    {job.legitimacyTier && job.legitimacyTier !== "high_confidence" && (
                      <Badge variant="outline" className="text-destructive">
                        {job.legitimacyTier.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {job.archetype && <span className="text-xs text-muted-foreground">{job.archetype}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.status === "discovered" && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!hasResume || busy !== null}
                      onClick={() => run(job.id, "auto", () => runAutoPipeline(job.id))}
                    >
                      {busy === `${job.id}:auto` ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Zap className="size-4" aria-hidden="true" />
                      )}
                      Auto-Pipeline
                    </Button>
                  )}
                  {["discovered", "evaluated"].includes(job.status) && (
                    <Button size="sm" variant="outline" disabled={!hasResume || busy !== null} onClick={() => run(job.id, "eval", () => evaluateJob(job.id))}>
                      {busy === `${job.id}:eval` ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Evaluate"}
                    </Button>
                  )}
                  {["shortlisted", "evaluated"].includes(job.status) && (
                    <Button size="sm" variant="outline" disabled={!hasResume || busy !== null} onClick={() => run(job.id, "tailor", () => tailorResume(job.id))}>
                      {busy === `${job.id}:tailor` ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Tailor"}
                    </Button>
                  )}
                  {["tailored", "outreach_prepared", "pending_approval", "auto_approved", "evaluated"].includes(job.status) && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(job.id, "applied", () => confirmApplied(job.id))}>
                      Mark Applied
                    </Button>
                  )}
                  {job.status === "applied" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(job.id, "resp", () => transitionJob(job.id, "responded"))}>
                        Responded
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(job.id, "rej", () => transitionJob(job.id, "rejected"))}>
                        Rejected
                      </Button>
                    </>
                  )}
                  {job.status === "responded" && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(job.id, "int", () => transitionJob(job.id, "interview"))}>
                      Interview
                    </Button>
                  )}
                  {job.status === "interview" && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(job.id, "offer", () => transitionJob(job.id, "offer"))}>
                      Offer
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDetailJob(job)}>
                    Detail
                  </Button>
                  {!["applied", "responded", "interview", "offer"].includes(job.status) && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy !== null} onClick={() => run(job.id, "skip", () => transitionJob(job.id, job.status === "discovered" ? "skip" : "discarded"))}>
                      Skip
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {job.jobUrl && (
              <CardContent className="pt-0">
                <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline-offset-2 hover:underline">
                  {job.jobUrl}
                </a>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Closed ({closed.length})</summary>
          <div className="mt-3 flex flex-col gap-2">
            {closed.map((job) => (
              <Card key={job.id}>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <span className="text-sm">
                    {job.roleTitle} <span className="text-muted-foreground">@ {job.company}</span>
                  </span>
                  <Badge variant="secondary" className={STATUS_COLORS[job.status] ?? ""}>
                    {job.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}

      {detailJob && <JobDetailDialog job={detailJob} onClose={() => setDetailJob(null)} />}
    </div>
  )
}
