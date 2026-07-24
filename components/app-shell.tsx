"use client"

// App shell — header (grouped dropdown nav) + section hero strip, driven by the
// URL (usePathname) instead of local tab state. Each section is a real route;
// nav navigates via the router so back/forward and shareable URLs just work.

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationsBell } from "@/components/notifications-bell"
import {
  Terminal,
  Briefcase,
  GraduationCap,
  LogOut,
  Megaphone,
  SquarePlay,
  Target,
  Wallet,
  Settings,
  ChevronDown,
  Sparkles,
  Layers,
  Workflow,
} from "lucide-react"

type SectionKey =
  | "prep"
  | "freelance"
  | "linkedin"
  | "youtube"
  | "career"
  | "money"
  | "chat"
  | "arsenal"
  | "playground"
  | "settings"

const SECTIONS: Record<
  SectionKey,
  { href: string; label: string; group: string; icon: typeof Terminal; title: string; description: string }
> = {
  prep: {
    href: "/prep",
    label: "FDE Prep",
    group: "Career Ops",
    icon: GraduationCap,
    title: "FDE Interview Prep",
    description: "Topics, drills, and resources for forward-deployed engineering readiness.",
  },
  career: {
    href: "/career",
    label: "Career Intelligence",
    group: "Career Ops",
    icon: Target,
    title: "Career Intelligence",
    description: "Job pipeline, ATS scanner, resume tailoring, and deep company research.",
  },
  freelance: {
    href: "/freelance",
    label: "Freelance Funnel",
    group: "Business Ops",
    icon: Briefcase,
    title: "Freelance Funnel",
    description: "Lead generation, deal pipeline, and delivery assets for the AI agency.",
  },
  linkedin: {
    href: "/linkedin",
    label: "LinkedIn OS",
    group: "Business Ops",
    icon: Megaphone,
    title: "LinkedIn OS",
    description: "Trend radar, voice-true post drafting, and human-in-the-loop publishing.",
  },
  youtube: {
    href: "/youtube",
    label: "YouTube Studio",
    group: "Business Ops",
    icon: SquarePlay,
    title: "YouTube Pipeline",
    description: "Faceless channel automation: scripts, generation, uploads, and analytics.",
  },
  money: {
    href: "/money",
    label: "Money OS",
    group: "Life Ops",
    icon: Wallet,
    title: "Money OS",
    description: "Autopay guardian: instruments, mandates, reminders, and cancellation playbooks.",
  },
  chat: {
    href: "/jarvis",
    label: "Jarvis",
    group: "Assistant",
    icon: Sparkles,
    title: "Jarvis",
    description: "Tool-calling assistant with voice: your data, calendar, and autopays.",
  },
  arsenal: {
    href: "/connection-hub",
    label: "Connection Hub",
    group: "Assistant",
    icon: Layers,
    title: "Connection Hub",
    description: "Skills, automations, and connectors: ingest capabilities, absorb workflows, and power up the agents.",
  },
  playground: {
    href: "/playground",
    label: "Agent Playground",
    group: "Assistant",
    icon: Workflow,
    title: "Agent Playground",
    description: "Live orchestration canvas — every agent, its handoffs, and real-time status. Rewire, pause, inspect.",
  },
  settings: {
    href: "/settings",
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

function activeKeyFor(pathname: string): SectionKey {
  const entry = (Object.entries(SECTIONS) as [SectionKey, (typeof SECTIONS)[SectionKey]][]).find(
    ([, s]) => pathname === s.href || pathname.startsWith(s.href + "/"),
  )
  return entry?.[0] ?? "prep"
}

export function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  const active = activeKeyFor(pathname)
  const section = SECTIONS[active]
  const SectionIcon = section.icon

  function go(key: SectionKey) {
    router.push(SECTIONS[key].href)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 md:px-6">
          <button
            type="button"
            onClick={() => go("prep")}
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
                      <DropdownMenuLabel className="text-micro text-muted-foreground">{group.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {group.items.map((key) => {
                        const item = SECTIONS[key]
                        const ItemIcon = item.icon
                        return (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => go(key)}
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
              onClick={() => go("chat")}
              className={`gap-1.5 text-[13px] ${active === "chat" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            >
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Jarvis
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => go("arsenal")}
              className={`gap-1.5 text-[13px] ${active === "arsenal" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            >
              <Layers className="size-3.5 text-primary" aria-hidden="true" />
              Connection Hub
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => go("playground")}
              className={`gap-1.5 text-[13px] ${active === "playground" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            >
              <Workflow className="size-3.5 text-primary" aria-hidden="true" />
              Agent Playground
            </Button>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationsBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => go("settings")}
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
                onClick={() => go(key)}
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
            <h1 className="bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-2xl font-bold tracking-[-0.02em] text-balance text-transparent md:text-[2rem] md:leading-[1.1]">
              {section.title}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground text-pretty">{section.description}</p>
          </div>
        </div>
      </div>

      <div key={active} className="section-enter mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        {children}
      </div>
    </main>
  )
}
