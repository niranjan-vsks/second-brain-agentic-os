"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TrendFeed } from "@/components/linkedin/trend-feed"
import { ReviewQueue } from "@/components/linkedin/review-queue"
import { PostCalendar } from "@/components/linkedin/post-calendar"
import { PublishedLog } from "@/components/linkedin/published-log"
import { StyleVault } from "@/components/linkedin/style-vault"
import type { TrendItem, LinkedinPost, WritingSample, VoicePreference } from "@/lib/types"

interface LinkedinTabProps {
  trends: TrendItem[]
  posts: LinkedinPost[]
  samples: WritingSample[]
  preferences: VoicePreference[]
}

export function LinkedinTab({ trends, posts, samples, preferences }: LinkedinTabProps) {
  const now = new Date()
  const published = posts.filter((p) => p.status === "posted")
  const publishedThisMonth = published.filter(
    (p) => p.postedAt && new Date(p.postedAt).getMonth() === now.getMonth() && new Date(p.postedAt).getFullYear() === now.getFullYear(),
  ).length
  const pendingReview = posts.filter((p) => p.status === "pending_review").length
  const scheduled = posts.filter((p) => p.status === "scheduled").length
  const engagement = published.reduce(
    (s, p) => s + (p.likeCount ?? 0) + (p.commentCount ?? 0) + (p.shareCount ?? 0),
    0,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="PUBLISHED" value={`${published.length} all-time / ${publishedThisMonth} this month`} />
        <StatCard label="PENDING REVIEW" value={String(pendingReview)} alert={pendingReview > 0} />
        <StatCard label="SCHEDULED" value={String(scheduled)} />
        <StatCard label="ENGAGEMENT LOGGED" value={engagement.toLocaleString()} />
      </div>

      <Tabs defaultValue="review" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto md:w-auto">
          <TabsTrigger value="trends">Trend Feed</TabsTrigger>
          <TabsTrigger value="review">Review Queue</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="published">Published Log</TabsTrigger>
          <TabsTrigger value="style">Style Vault</TabsTrigger>
        </TabsList>
        <TabsContent value="trends">
          <TrendFeed trends={trends} />
        </TabsContent>
        <TabsContent value="review">
          <ReviewQueue posts={posts.filter((p) => p.status === "pending_review")} />
        </TabsContent>
        <TabsContent value="calendar">
          <PostCalendar posts={posts.filter((p) => p.status === "approved" || p.status === "scheduled")} />
        </TabsContent>
        <TabsContent value="published">
          <PublishedLog posts={posts.filter((p) => p.status === "posted" || p.status === "rejected")} />
        </TabsContent>
        <TabsContent value="style">
          <StyleVault samples={samples} preferences={preferences} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-mono text-[11px] tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  )
}
