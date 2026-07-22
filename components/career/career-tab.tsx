"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { JobPipeline } from "@/components/career/job-pipeline"
import { ResumeStudio } from "@/components/career/resume-studio"
import { StoryBank } from "@/components/career/story-bank"
import { ResearchPanel } from "@/components/career/research-panel"
import { ScannerPanel } from "@/components/career/scanner-panel"
import { JobHuntPanel } from "@/components/career/jobhunt-panel"
import { CareerSettingsPanel } from "@/components/career/career-settings-panel"
import type { JobApplication, CareerSettings, InterviewStory, CompanyResearchNote, Resume } from "@/lib/types"

interface CareerTabProps {
  jobs: JobApplication[]
  settings: CareerSettings | null
  stories: InterviewStory[]
  research: CompanyResearchNote[]
  masterResumes: Resume[]
}

export function CareerTab({ jobs, settings, stories, research, masterResumes }: CareerTabProps) {
  const discovered = jobs.filter((j) => j.status === "discovered").length
  const inPipeline = jobs.filter((j) =>
    ["evaluating", "evaluated", "shortlisted", "tailored", "outreach_prepared", "pending_approval", "auto_approved"].includes(j.status),
  ).length
  const applied = jobs.filter((j) => ["applied", "responded"].includes(j.status)).length
  const interviews = jobs.filter((j) => ["interview", "offer"].includes(j.status)).length

  const hasResume = masterResumes.length > 0

  return (
    <div className="flex flex-col gap-6">
      {!hasResume && (
        <Card className="border-primary/50">
          <CardContent className="p-4">
            <p className="text-sm text-pretty">
              <span className="font-mono font-semibold text-primary">Setup required:</span> upload your master resume in the
              Settings sub-tab before running evaluations — the agent refuses to fabricate a profile (source-of-truth rule).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Discovered" value={discovered} accent={discovered > 0} />
        <StatCard label="In Pipeline" value={inPipeline} />
        <StatCard label="Applied" value={applied} />
        <StatCard label="Interviews / Offers" value={interviews} accent={interviews > 0} />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="autoapply">Auto-Apply</TabsTrigger>
          <TabsTrigger value="scanner">Scanner</TabsTrigger>
          <TabsTrigger value="resumes">Resumes</TabsTrigger>
          <TabsTrigger value="stories">Story Bank</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <JobPipeline jobs={jobs} hasResume={hasResume} />
        </TabsContent>
        <TabsContent value="autoapply">
          <JobHuntPanel />
        </TabsContent>
        <TabsContent value="scanner">
          <ScannerPanel />
        </TabsContent>
        <TabsContent value="resumes">
          <ResumeStudio />
        </TabsContent>
        <TabsContent value="stories">
          <StoryBank />
        </TabsContent>
        <TabsContent value="research">
          <ResearchPanel research={research} />
        </TabsContent>
        <TabsContent value="settings">
          <CareerSettingsPanel settings={settings} masterResumes={masterResumes} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`font-mono text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
      </CardContent>
    </Card>
  )
}
