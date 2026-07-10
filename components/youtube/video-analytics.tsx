"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getLatestMetrics } from "@/app/actions/youtube"
import type { VideoProject, YoutubeVideoRow } from "@/lib/types"

interface VideoAnalyticsProps {
  videos: YoutubeVideoRow[]
  projects: VideoProject[]
}

export function VideoAnalytics({ videos, projects }: VideoAnalyticsProps) {
  const published = videos.filter((v) => v.uploadStatus === "published")
  const { data: metrics } = useSWR("yt-metrics", () => getLatestMetrics(), { refreshInterval: 60000 })

  if (published.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center font-mono text-xs text-muted-foreground">
            No published videos yet. Metrics are polled every 6 hours after publishing (requires connected channel).
          </p>
        </CardContent>
      </Card>
    )
  }

  const metricFor = (videoId: string) => metrics?.find((m) => m.youtubeVideoId === videoId)

  return (
    <div className="flex flex-col gap-3">
      {published.map((v) => {
        const project = projects.find((p) => p.id === v.videoProjectId)
        const m = metricFor(v.id)
        return (
          <Card key={v.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-pretty">{v.title || project?.topic || "Untitled"}</CardTitle>
              <div className="flex gap-1.5">
                {project?.autoPublished && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    auto-published
                  </Badge>
                )}
                {v.youtubeVideoId && (
                  <a
                    href={`https://youtube.com/watch?v=${v.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-primary underline underline-offset-2"
                  >
                    watch
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                <Metric label="Views" value={m?.views ?? 0} />
                <Metric label="Likes" value={m?.likes ?? 0} />
                <Metric label="Comments" value={m?.comments ?? 0} />
                <Metric label="Watch min" value={m?.watchTimeMinutes ?? 0} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-bold">{value.toLocaleString()}</span>
    </div>
  )
}
