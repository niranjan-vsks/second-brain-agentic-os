"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FreelanceTab } from "@/components/freelance/freelance-tab"
import { PrepTab } from "@/components/prep/prep-tab"
import { LinkedinTab } from "@/components/linkedin/linkedin-tab"
import { YoutubeTab } from "@/components/youtube/youtube-tab"
import { CareerTab } from "@/components/career/career-tab"
import { MoneyTab } from "@/components/money/money-tab"
import { SettingsTab } from "@/components/settings/settings-tab"
import { ArsenalTab } from "@/components/arsenal/arsenal-tab"
import { PlaygroundTab } from "@/components/playground/playground-tab"
import { OsChat } from "@/components/os-chat"
import { NotificationsBell } from "@/components/notifications-bell"
import {
  Terminal,
  Briefcase,
  GraduationCap,
  LogOut,
  Megaphone,
  SquarePlay,
  MessageSquare,
  Target,
  Wallet,
  Settings,
  ChevronDown,
  Sparkles,
  Layers,
  Workflow,
} from "lucide-react"
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

type SectionKey = "prep" | "freelance" | "linkedin" | "youtube" | "career" | "money" | "chat" | "arsenal" | "playground" | "settings"

const SECTIONS: Record<
  SectionKey,
  { label: string; group: string; icon: typeof Terminal; title: string; description: string }
> = {
  prep: {
    label: "FDE Prep",
    group: "Career Ops",
    icon: GraduationCap,
    title: "FDE Interview Prep",
    description: "Topics, drills, and resources for forward-deployed engineering readiness.",
  },
  career: {
    label: "Career Intelligence",
    group: "Career Ops",
    icon: Target,
    title: "Career Intelligence",
    description: "Job pipeline, ATS scanner, resume tailoring, and deep company research.",
  },
  freelance: {
    label: "Freelance Funnel",
    group: "Business Ops",
    icon: Briefcase,
    title: "Freelance Funnel",
    description: "Lead generation, deal pipeline, and delivery assets for the AI agency.",
  },
  linkedin: {
    label: "LinkedIn OS",
    group: "Business Ops",
    icon: Megaphone,
    title: "LinkedIn OS",
    description: "Trend radar, voice-true post drafting, and human-in-the-loop publishing.",
  },
  youtube: {
    label: "YouTube Studio",
    group: "Business Ops",
    icon: SquarePlay,
    title: "YouTube Pipeline",
    description: "Faceless channel automation: scripts, generation, uploads, and analytics.",
  },
  money: {
    label: "Money OS",
    group: "Life Ops",
    icon: Wallet,
    title: "Money OS",
    description: "Autopay guardian: instruments, mandates, reminders, and cancellation playbooks.",
  },
  chat: {
    label: "Jarvis",
    group: "Assistant",
    icon: MessageSquare,
    title: "Jarvis",
    description: "Tool-calling assistant with voice: your data, calendar, and autopays.",
  },
  arsenal: {
    label: "Arsenal",
    group: "Assistant",
    icon: Layers,
    title: "Arsenal",
    description: "Skills and automations: ingest capabilities, absorb workflows, and power up the agents.",
  },
  playground: {
    label: "Agent Playground",
    group: "Assistant",
    icon: Workflow,
    title: "Agent Playground",
    description: "Live orchestration canvas — every agent, its handoffs, and real-time status. Rewire, pause, inspect.",
  },
  settings: {
    label: "Settings",
    group: "System",
    icon: Settings,
    title: "Settings Hub",
    description: "Central configuration: models, connections, API keys, agents, and funnels.",
  },
}

const NAV_GROUPS: { name: string; items: SectionKey[] }[] = [
  { name: "Career Ops", items: ["prep", "career"] },
  { name: "Business Ops", items: ["freelance", "linkedin", "youtube"] },
  { name: "Life Ops", items: ["money"] },
]

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
  const [active, setActive] = useState<SectionKey>("prep")

  async function handleSignOut() {
    setSigningOut(true)
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  const section = SECTIONS[active]
  const SectionIcon = section.icon

  return (
    <main className="min-h-screen bg-background">
      <Tabs value={active} onValueChange={(v) => setActive(v as SectionKey)} className="gap-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 md:px-6">
            <button
              type="button"
              onClick={() => setActive("prep")}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent"
            >
              <span className="surface-glow flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/25">
                <Terminal className="size-3.5" aria-hidden="true" />
              </span>
              <span className="font-mono text-sm font-semibold tracking-tight">operator_os</span>
            </button>

            {/* Desktop nav: grouped dropdowns */}
            <nav className="ml-4 hidden items-center gap-0.5 md:flex" aria-label="Primary">
              {NAV_GROUPS.map((group) => {
                const groupActive = group.items.includes(active)
                return (
                  <DropdownMenu key={group.name}>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`gap-1.5 text-[13px] ${groupActive ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                        >
                          {group.name}
                          <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="start" className="w-64 surface-raised">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-micro text-muted-foreground">
                          {group.name}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {group.items.map((key) => {
                          const item = SECTIONS[key]
                          const ItemIcon = item.icon
                          return (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => setActive(key)}
                              className={`gap-3 py-2.5 ${active === key ? "bg-accent" : ""}`}
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-primary">
                                <ItemIcon className="size-4" aria-hidden="true" />
                              </span>
                              <span className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium leading-none">{item.label}</span>
                                <span className="line-clamp-1 text-xs text-muted-foreground">{item.description}</span>
                              </span>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActive("chat")}
                className={`gap-1.5 text-[13px] ${active === "chat" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              >
                <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                Jarvis
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActive("arsenal")}
                className={`gap-1.5 text-[13px] ${active === "arsenal" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              >
                <Layers className="size-3.5 text-primary" aria-hidden="true" />
                Arsenal
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActive("playground")}
                className={`gap-1.5 text-[13px] ${active === "playground" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              >
                <Workflow className="size-3.5 text-primary" aria-hidden="true" />
                Playground
              </Button>
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <NotificationsBell />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActive("settings")}
                aria-label="Settings"
                className={active === "settings" ? "bg-accent" : ""}
              >
                <Settings className="size-4" aria-hidden="true" />
              </Button>
              <span className="hidden font-mono text-xs text-muted-foreground lg:inline">{userName}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut} className="gap-1.5">
                <LogOut className="size-4" aria-hidden="true" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          </div>

          {/* Mobile nav: horizontal scroll strip */}
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden" aria-label="Sections">
            {(Object.keys(SECTIONS) as SectionKey[]).map((key) => {
              const item = SECTIONS[key]
              const ItemIcon = item.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active === key
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  <ItemIcon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </header>

        {/* Section hero strip */}
        <div className="grid-backdrop border-b border-border">
          <div key={active} className="section-enter mx-auto flex max-w-7xl items-center gap-4 px-4 py-6 md:px-6 md:py-8">
            <span className="surface-raised surface-glow flex size-12 shrink-0 items-center justify-center rounded-xl text-primary transition-transform duration-200">
              <SectionIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-micro text-primary/90">{section.group}</span>
              <h1 className="text-xl font-semibold tracking-tight text-balance md:text-2xl">{section.title}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground text-pretty">{section.description}</p>
            </div>
          </div>
        </div>

        <div key={active} className="section-enter mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
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
          <TabsContent value="arsenal">
            <ArsenalTab />
          </TabsContent>
          <TabsContent value="playground">
            <PlaygroundTab />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </main>
  )
}
