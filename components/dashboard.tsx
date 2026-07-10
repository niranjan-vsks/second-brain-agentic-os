"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FreelanceTab } from "@/components/freelance/freelance-tab"
import { PrepTab } from "@/components/prep/prep-tab"
import { LinkedinTab } from "@/components/linkedin/linkedin-tab"
import { YoutubeTab } from "@/components/youtube/youtube-tab"
import { CareerTab } from "@/components/career/career-tab"
import { MoneyTab } from "@/components/money/money-tab"
import { OsChat } from "@/components/os-chat"
import { NotificationsBell } from "@/components/notifications-bell"
import { Terminal, Briefcase, GraduationCap, LogOut, Megaphone, SquarePlay, MessageSquare, Target, Wallet } from "lucide-react"
import type {
  Deal,
  Asset,
  Lead,
  Artifact,
  Topic,
  Drill,
  Resource,
  TrendItem,
  LinkedinPost,
  WritingSample,
  VoicePreference,
  YoutubeChannel,
  VideoProject,
  PipelineSettings,
  YoutubeVideoRow,
  JobApplication,
  CareerSettings,
  InterviewStory,
  CompanyResearchNote,
  Resume,
} from "@/lib/types"

interface DashboardProps {
  userName: string
  deals: Deal[]
  assets: Asset[]
  leads: Lead[]
  artifacts: Artifact[]
  topics: Topic[]
  drills: Drill[]
  resources: Resource[]
  trends: TrendItem[]
  posts: LinkedinPost[]
  samples: WritingSample[]
  preferences: VoicePreference[]
  ytChannels: YoutubeChannel[]
  ytProjects: VideoProject[]
  ytSettings: PipelineSettings | null
  ytVideos: YoutubeVideoRow[]
  careerJobs: JobApplication[]
  careerSettings: CareerSettings | null
  careerStories: InterviewStory[]
  careerResearch: CompanyResearchNote[]
  careerResumes: Resume[]
}

export function Dashboard({
  userName,
  deals,
  assets,
  leads,
  artifacts,
  topics,
  drills,
  resources,
  trends,
  posts,
  samples,
  preferences,
  ytChannels,
  ytProjects,
  ytSettings,
  ytVideos,
  careerJobs,
  careerSettings,
  careerStories,
  careerResearch,
  careerResumes,
}: DashboardProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-background">
      <Tabs defaultValue="prep" className="gap-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2">
              <Terminal className="size-5 text-primary" aria-hidden="true" />
              <span className="font-mono text-sm font-semibold tracking-tight">operator_os</span>
            </div>
            <TabsList className="order-3 w-full md:order-none md:mx-6 md:w-auto">
              <TabsTrigger value="prep" className="gap-2">
                <GraduationCap className="size-4" aria-hidden="true" />
                FDE Prep
              </TabsTrigger>
              <TabsTrigger value="freelance" className="gap-2">
                <Briefcase className="size-4" aria-hidden="true" />
                Freelance Funnel
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="gap-2">
                <Megaphone className="size-4" aria-hidden="true" />
                LinkedIn OS
              </TabsTrigger>
              <TabsTrigger value="youtube" className="gap-2">
                <SquarePlay className="size-4" aria-hidden="true" />
                YouTube
              </TabsTrigger>
              <TabsTrigger value="career" className="gap-2">
                <Target className="size-4" aria-hidden="true" />
                Career
              </TabsTrigger>
              <TabsTrigger value="money" className="gap-2">
                <Wallet className="size-4" aria-hidden="true" />
                Money
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="size-4" aria-hidden="true" />
                Jarvis
              </TabsTrigger>
            </TabsList>
            <div className="ml-auto flex items-center gap-3">
              <NotificationsBell />
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{userName}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut} className="gap-1.5">
                <LogOut className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
          <TabsContent value="prep">
            <PrepTab topics={topics} drills={drills} resources={resources} />
          </TabsContent>
          <TabsContent value="freelance">
            <FreelanceTab deals={deals} assets={assets} leads={leads} artifacts={artifacts} />
          </TabsContent>
          <TabsContent value="linkedin">
            <LinkedinTab trends={trends} posts={posts} samples={samples} preferences={preferences} />
          </TabsContent>
          <TabsContent value="youtube">
            <YoutubeTab channels={ytChannels} projects={ytProjects} settings={ytSettings} videos={ytVideos} />
          </TabsContent>
          <TabsContent value="career">
            <CareerTab
              jobs={careerJobs}
              settings={careerSettings}
              stories={careerStories}
              research={careerResearch}
              masterResumes={careerResumes}
            />
          </TabsContent>
          <TabsContent value="money">
            <MoneyTab />
          </TabsContent>
          <TabsContent value="chat">
            <OsChat />
          </TabsContent>
        </div>
      </Tabs>
    </main>
  )
}
