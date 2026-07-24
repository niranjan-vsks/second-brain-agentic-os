"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PipelineBoard } from "@/components/freelance/pipeline-board"
import { AssetLibrary } from "@/components/freelance/asset-library"
import { OutreachTracker } from "@/components/freelance/outreach-tracker"
import { ArtifactGenerator } from "@/components/freelance/artifact-generator"
import { AdCreativeStudio } from "@/components/freelance/ad-creative-studio"
import { LeadgenPanel } from "@/components/freelance/leadgen-panel"
import { MetricCard } from "@/components/ui/metric-card"
import type { Deal, Asset, Lead, Artifact } from "@/lib/types"

interface FreelanceTabProps {
  deals: Deal[]
  assets: Asset[]
  leads: Lead[]
  artifacts: Artifact[]
}

export function FreelanceTab({ deals, assets, leads, artifacts }: FreelanceTabProps) {
  const totalPipeline = deals.filter((d) => !["handoff", "retention"].includes(d.stage)).reduce((s, d) => s + d.value, 0)
  const activeDeals = deals.filter((d) => !["retention"].includes(d.stage)).length
  const overdueFollowUps = leads.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp) < new Date()).length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Pipeline Value" value={`$${totalPipeline.toLocaleString()}`} hint="Total dollar value of every open deal across the funnel (excludes handoff/retention)." />
        <MetricCard label="Active Deals" value={activeDeals} hint="Deals currently moving through the pipeline — not yet in retention." />
        <MetricCard label="Overdue Follow-ups" value={overdueFollowUps} accent={overdueFollowUps > 0} hint="Leads past their follow-up date. Chase these first — momentum decays fast." />
      </div>

      <Tabs defaultValue="pipeline" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto md:w-auto">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leadgen">Lead-Gen Agent</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="library">Asset Library</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
          <TabsTrigger value="ad-studio">Ad Studio</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <PipelineBoard deals={deals} />
        </TabsContent>
        <TabsContent value="leadgen">
          <LeadgenPanel />
        </TabsContent>
        <TabsContent value="outreach">
          <OutreachTracker leads={leads} />
        </TabsContent>
        <TabsContent value="library">
          <AssetLibrary />
        </TabsContent>
        <TabsContent value="artifacts">
          <ArtifactGenerator />
        </TabsContent>
        <TabsContent value="ad-studio">
          <AdCreativeStudio deals={deals} />
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
