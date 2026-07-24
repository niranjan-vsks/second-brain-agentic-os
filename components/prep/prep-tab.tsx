"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { SyllabusView } from "@/components/prep/syllabus-view"
import { WeeklyPlanner } from "@/components/prep/weekly-planner"
import { DrillBank } from "@/components/prep/drill-bank"
import { ResourceVault } from "@/components/prep/resource-vault"
import { PrdView } from "@/components/prep/prd-view"
import { MetricCard } from "@/components/ui/metric-card"
import type { Topic, Drill, Resource } from "@/lib/types"

interface PrepTabProps {
  topics: Topic[]
  drills: Drill[]
  resources: Resource[]
}

export function PrepTab({ topics, drills, resources }: PrepTabProps) {
  const done = topics.filter((t) => t.status === "done").length
  const inProgress = topics.filter((t) => t.status === "in-progress").length
  const critical = topics.filter((t) => t.priority === 1 && t.status !== "done").length
  const answered = drills.filter((d) => d.status === "answered").length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Topics Done" value={`${done}/${topics.length}`} hint="FDE syllabus topics completed across all five tracks." />
        <MetricCard label="In Progress" value={inProgress} hint="Topics you're actively studying right now." />
        <MetricCard label="P1 Remaining" value={critical} accent={critical > 0} hint="Critical priority-1 topics not yet done — the highest-leverage prep." />
        <MetricCard label="Drills Answered" value={`${answered}/${drills.length}`} hint="Interview drill questions you've written and reviewed answers for." />
      </div>

      <Tabs defaultValue="syllabus" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto md:w-auto">
          <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
          <TabsTrigger value="planner">Weekly Planner</TabsTrigger>
          <TabsTrigger value="drills">Drills</TabsTrigger>
          <TabsTrigger value="vault">Resource Vault</TabsTrigger>
          <TabsTrigger value="prd">Research Agent PRD</TabsTrigger>
        </TabsList>
        <TabsContent value="syllabus">
          <SyllabusView topics={topics} />
        </TabsContent>
        <TabsContent value="planner">
          <WeeklyPlanner topics={topics} />
        </TabsContent>
        <TabsContent value="drills">
          <DrillBank drills={drills} topics={topics} />
        </TabsContent>
        <TabsContent value="vault">
          <ResourceVault resources={resources} topics={topics} />
        </TabsContent>
        <TabsContent value="prd">
          <PrdView />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-mono text-[11px] tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  )
}
