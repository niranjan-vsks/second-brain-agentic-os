"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { VideoPipeline } from "@/components/youtube/video-pipeline"
import { VideoReviewQueue } from "@/components/youtube/video-review-queue"
import { ChannelSettings } from "@/components/youtube/channel-settings"
import { VideoAnalytics } from "@/components/youtube/video-analytics"
import type { YoutubeChannel, VideoProject, PipelineSettings, YoutubeVideoRow } from "@/lib/types"

interface YoutubeTabProps {
  channels: YoutubeChannel[]
  projects: VideoProject[]
  settings: PipelineSettings | null
  videos: YoutubeVideoRow[]
}

export function YoutubeTab({ channels, projects, settings, videos }: YoutubeTabProps) {
  const pending = projects.filter((p) => p.status === "pending_approval").length
  const inFlight = projects.filter((p) =>
    ["scripting", "script_ready", "prompt_ready", "generating", "generated", "uploading"].includes(p.status),
  ).length
  const published = projects.filter((p) => p.status === "published").length
  const failed = projects.filter((p) => p.status === "failed").length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending Review" value={pending} accent={pending > 0} />
        <StatCard label="In Flight" value={inFlight} />
        <StatCard label="Published" value={published} />
        <StatCard label="Failed" value={failed} accent={failed > 0} />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="review">Review Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="channels">Channels & Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <VideoPipeline projects={projects} channels={channels} settings={settings} />
        </TabsContent>
        <TabsContent value="review">
          <VideoReviewQueue projects={projects.filter((p) => p.status === "pending_approval")} />
        </TabsContent>
        <TabsContent value="analytics">
          <VideoAnalytics videos={videos} projects={projects} />
        </TabsContent>
        <TabsContent value="channels">
          <ChannelSettings channels={channels} settings={settings} />
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
