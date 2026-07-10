"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import type { JobApplication, EvaluationReport, ResumeVersion, OutreachMessage } from "@/lib/types"
import {
  getEvaluationReport,
  getResumeVersionsForJob,
  getCoverLetterForJob,
  getOutreachForJob,
  transitionJob,
  confirmApplied,
  approveOutreach,
  markOutreachSent,
} from "@/app/actions/career"
import { evaluateJob, tailorResume, generateOutreach, deepResearch, applyAssist, runAutoPipeline } from "@/app/actions/career-agents"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowLeft } from "lucide-react"

function Block({ title, content }: { title: string; content: string }) {
  if (!content) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground leading-relaxed">{content}</pre>
      </CardContent>
    </Card>
  )
}

export function JobDetail({ job, onBack }: { job: JobApplication; onBack: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contactName, setContactName] = useState("")
  const [contactRole, setContactRole] = useState<"recruiter" | "hiring_manager" | "peer" | "interviewer">("recruiter")
  const [contactContext, setContactContext] = useState("")
  const [formQuestions, setFormQuestions] = useState("")
  const [deepResult, setDeepResult] = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<string | null>(null)

  const { data: report } = useSWR(["career-eval", job.id], () => getEvaluationReport(job.id))
  const { data: resumeVersions } = useSWR(["career-rv", job.id], () => getResumeVersionsForJob(job.id))
  const { data: coverData } = useSWR(["career-cl", job.id], () => getCoverLetterForJob(job.id))
  const { data: outreach } = useSWR(["career-or", job.id], () => getOutreachForJob(job.id))

  function refresh() {
    mutate(["career-eval", job.id])
    mutate(["career-rv", job.id])
    mutate(["career-cl", job.id])
    mutate(["career-or", job.id])
  }

  async function act(name: string, fn: () => Promise<unknown>) {
    setBusy(name)
    setError(null)
    try {
      const result = (await fn()) as { ok?: boolean; error?: string } | undefined
      if (result && result.ok === false && result.error) setError(result.error)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const r = report as EvaluationReport | null | undefined
  const covers = coverData?.versions ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-col">
          <h3 className="font-semibold text-balance">
            {job.roleTitle} — {job.company}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Badge variant="outline">{job.status.replaceAll("_", " ")}</Badge>
            {job.evaluationScore && <span>Score: {job.evaluationScore}/5</span>}
            {job.legitimacyTier && <Badge variant="secondary">{job.legitimacyTier.replaceAll("_", " ")}</Badge>}
            {job.jobUrl && (
              <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Job posting
              </a>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" disabled={busy !== null} onClick={() => act("eval", () => evaluateJob(job.id))}>
          {busy === "eval" && <Loader2 className="h-4 w-4 animate-spin" />}
          {r ? "Re-evaluate" : "Evaluate"}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy !== null || !r} onClick={() => act("tailor", () => tailorResume(job.id))}>
          {busy === "tailor" && <Loader2 className="h-4 w-4 animate-spin" />}
          Tailor Resume + Cover
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          onClick={() =>
            act("deep", async () => {
              const res = await deepResearch(job.company, job.id)
              if (res.ok)
                setDeepResult(
                  res.mode === "executed"
                    ? "Research executed and saved — see the Research tab."
                    : "No search provider configured — a research prompt was generated and saved to the Research tab. Paste it into Perplexity/ChatGPT.",
                )
              return res
            })
          }
        >
          {busy === "deep" && <Loader2 className="h-4 w-4 animate-spin" />}
          Deep Research
        </Button>
        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act("auto", () => runAutoPipeline(job.id))}>
          {busy === "auto" && <Loader2 className="h-4 w-4 animate-spin" />}
          Run Auto-Pipeline
        </Button>
        {job.status !== "applied" && (
          <Button size="sm" disabled={busy !== null} onClick={() => act("applied", () => confirmApplied(job.id))}>
            {busy === "applied" && <Loader2 className="h-4 w-4 animate-spin" />}
            Mark Applied
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("skip", () => transitionJob(job.id, "skip"))}>
          Skip
        </Button>
      </div>

      {deepResult && <Block title="Deep Research Result" content={deepResult} />}

      <Tabs defaultValue="evaluation">
        <TabsList className="flex-wrap">
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="apply">Apply Assist</TabsTrigger>
          <TabsTrigger value="jd">Job Description</TabsTrigger>
        </TabsList>

        <TabsContent value="evaluation" className="flex flex-col gap-3">
          {!r && (
            <p className="text-sm text-muted-foreground py-4">
              No evaluation yet. Run Evaluate to generate the 6-block report (role summary, CV match, level strategy,
              comp demand, personalization plan, interview plan).
            </p>
          )}
          {r && (
            <>
              <Block title="A — Role Summary & Archetype" content={r.blockA_roleSummary} />
              <Block title="B — CV Match & Gaps" content={r.blockB_cvMatch} />
              <Block title="C — Level Strategy" content={r.blockC_levelStrategy} />
              <Block title="D — Comp Demand" content={r.blockD_compDemand} />
              <Block title="E — Personalization Plan" content={r.blockE_personalizationPlan} />
              <Block title="F — Interview Plan" content={r.blockF_interviewPlan} />
              {r.blockH_draftAnswers && <Block title="H — Draft Application Answers" content={r.blockH_draftAnswers} />}
            </>
          )}
        </TabsContent>

        <TabsContent value="documents" className="flex flex-col gap-3">
          {(!resumeVersions || resumeVersions.length === 0) && covers.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No tailored documents yet. Run Tailor after evaluation.</p>
          )}
          {(resumeVersions as ResumeVersion[] | undefined)?.map((v) => (
            <Card key={v.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                  Resume v{v.versionNumber}
                  {v.isCurrent && <Badge>current</Badge>}
                  {v.atsKeywordScore !== null && <Badge variant="secondary">ATS {v.atsKeywordScore}%</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {v.changeExplanation && (
                  <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">{v.changeExplanation}</p>
                )}
                {v.atsKeywordsMissing && <p className="text-xs text-muted-foreground">Missing keywords: {v.atsKeywordsMissing}</p>}
                <pre className="whitespace-pre-wrap text-xs font-sans max-h-80 overflow-y-auto text-muted-foreground leading-relaxed">
                  {v.content}
                </pre>
              </CardContent>
            </Card>
          ))}
          {covers.map((v) => (
            <Card key={v.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Cover Letter v{v.versionNumber}
                  {v.isCurrent && <Badge>current</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs font-sans max-h-80 overflow-y-auto text-muted-foreground leading-relaxed">
                  {v.content}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="outreach" className="flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Draft outreach (contacto)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Contact name"
                  className="max-w-48"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
                <Select value={contactRole} onValueChange={(v) => setContactRole(v as typeof contactRole)}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                    <SelectItem value="hiring_manager">Hiring manager</SelectItem>
                    <SelectItem value="peer">Peer / warm intro</SelectItem>
                    <SelectItem value="interviewer">Interviewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Context about this contact (their posts, background, shared interests...)"
                rows={2}
                value={contactContext}
                onChange={(e) => setContactContext(e.target.value)}
              />
              <Button
                size="sm"
                className="self-start"
                disabled={busy !== null || !contactName.trim()}
                onClick={() =>
                  act("contacto", () =>
                    generateOutreach({ jobId: job.id, contactName: contactName.trim(), contactRole, contactContext }),
                  )
                }
              >
                {busy === "contacto" && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate Message
              </Button>
            </CardContent>
          </Card>

          {(outreach as OutreachMessage[] | undefined)?.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                  {m.messageType.replaceAll("_", " ")}
                  <Badge variant="outline">{m.status}</Badge>
                  <span className="text-xs text-muted-foreground font-normal">{m.content.length} chars</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground leading-relaxed">{m.content}</pre>
                <div className="flex gap-2">
                  {m.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => act("approve-msg", () => approveOutreach(m.id))}>
                      Approve
                    </Button>
                  )}
                  {m.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => act("sent-msg", () => markOutreachSent(m.id))}>
                      Mark Sent
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="apply" className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground text-pretty">
            Paste the application form questions. The agent drafts answers from your evaluation + resume — you always
            submit manually (the system never auto-submits, per the apply hard rule).
          </p>
          <Textarea
            placeholder={'e.g. "Why do you want to work here?" / "Describe a production AI system you shipped."'}
            rows={4}
            value={formQuestions}
            onChange={(e) => setFormQuestions(e.target.value)}
          />
          <Button
            size="sm"
            className="self-start"
            disabled={busy !== null || !formQuestions.trim()}
            onClick={() =>
              act("apply", async () => {
                const res = await applyAssist(job.id, formQuestions)
                if (res.ok && res.answers)
                  setApplyResult(res.answers.map((a) => `Q: ${a.question}\n\nA: ${a.answer}`).join("\n\n---\n\n"))
                return res
              })
            }
          >
            {busy === "apply" && <Loader2 className="h-4 w-4 animate-spin" />}
            Draft Answers
          </Button>
          {applyResult && <Block title="Draft Answers" content={applyResult} />}
        </TabsContent>

        <TabsContent value="jd">
          <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground leading-relaxed max-h-[32rem] overflow-y-auto">
            {job.jobDescription || "No job description stored."}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  )
}
