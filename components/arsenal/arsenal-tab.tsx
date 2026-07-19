"use client"

// Arsenal — Jarvis's extensible capability layer.
// Skills: ingested capability modules injected into agent prompts (curated
// pack, zip upload, Jarvis-created). Automations: imported n8n workflows —
// analyze (what's absorbable?), absorb (capability → skill), run (on the
// connected n8n instance).

import { useRef, useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  listSkills,
  listAutomations,
  seedCuratedPack,
  ingestSkillZip,
  updateSkillAction,
  deleteSkillAction,
  importAutomation,
  analyzeAutomation,
  absorbCapability,
  runAutomationAction,
  deleteAutomationAction,
} from "@/app/actions/arsenal"
import {
  Layers,
  Workflow,
  Upload,
  Sparkles,
  Trash2,
  Play,
  Loader2,
  PackagePlus,
  BrainCircuit,
} from "lucide-react"

const AGENT_LABELS: Record<string, string> = {
  linkedin_post: "LinkedIn",
  youtube_script: "YouTube",
  leadgen_qualify: "Lead-Gen",
  career_outreach: "Outreach",
  ads_creative: "Ads",
}

type SkillRow = Awaited<ReturnType<typeof listSkills>>[number]
type AutomationsSnap = Awaited<ReturnType<typeof listAutomations>>

export function ArsenalTab() {
  const [sub, setSub] = useState<"skills" | "automations">("skills")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1">
        {(
          [
            { id: "skills", label: "Skills", icon: Layers },
            { id: "automations", label: "Automations", icon: Workflow },
          ] as const
        ).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                sub === t.id ? "surface-raised text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className={`size-4 ${sub === t.id ? "text-primary" : ""}`} aria-hidden="true" />
              {t.label}
            </button>
          )
        })}
      </div>
      {sub === "skills" ? <SkillsPanel /> : <AutomationsPanel />}
    </div>
  )
}

// --- Skills ---------------------------------------------------------------------

function SkillsPanel() {
  const { data: skills, mutate, isLoading } = useSWR<SkillRow[]>("arsenal-skills", () => listSkills())
  const [busy, setBusy] = useState("")
  const [uploadResult, setUploadResult] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function seedPack() {
    setBusy("seed")
    const r = await seedCuratedPack()
    setUploadResult(`Curated pack: ${r.created} installed, ${r.updated} refreshed.`)
    setBusy("")
    mutate()
  }

  async function onZipPicked(file: File | undefined) {
    if (!file) return
    setBusy("zip")
    setUploadResult("")
    const fd = new FormData()
    fd.append("file", file)
    const r = await ingestSkillZip(fd)
    setUploadResult(
      r.ok
        ? `Ingested ${r.ingested} skill(s): ${r.results
            .filter((x) => x.skill)
            .map((x) => x.skill)
            .join(", ")}${r.results.some((x) => x.error) ? ` · skipped: ${r.results.filter((x) => x.error).length}` : ""}`
        : `Failed: ${r.error}`,
    )
    setBusy("")
    if (fileRef.current) fileRef.current.value = ""
    mutate()
  }

  async function toggleAgent(skill: SkillRow, agent: string) {
    const current = skill.targetAgents.split(",").map((a) => a.trim()).filter(Boolean)
    const next = current.includes(agent) ? current.filter((a) => a !== agent) : [...current, agent]
    await updateSkillAction(skill.id, { targetAgents: next.join(",") })
    mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="surface-raised border-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Skill Library</CardTitle>
              <CardDescription>
                Capability modules injected into agent prompts. Toggle which agents each skill powers — changes apply on
                the agent&apos;s next run. Jarvis can install, retarget, and extract skills too.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => onZipPicked(e.target.files?.[0])}
              />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy !== ""}>
                {busy === "zip" ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-1.5 size-4" aria-hidden="true" />}
                Ingest zip
              </Button>
              <Button onClick={seedPack} disabled={busy !== ""}>
                {busy === "seed" ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <PackagePlus className="mr-1.5 size-4" aria-hidden="true" />}
                Install curated pack
              </Button>
            </div>
          </div>
          {uploadResult ? <p className="text-xs text-muted-foreground">{uploadResult}</p> : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading skills...</p>
          ) : !skills || skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No skills yet. Install the curated pack (distilled from the 100-agents sales/marketing guide, tuned to
              your agents) or ingest a zip of SKILL.md files.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {skills.map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{s.name}</p>
                        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                          {s.source}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={s.active}
                        onCheckedChange={async (v) => {
                          await updateSkillAction(s.id, { active: v })
                          mutate()
                        }}
                        aria-label={`Toggle ${s.name}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${s.name}`}
                        onClick={async () => {
                          await deleteSkillAction(s.id)
                          mutate()
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-micro text-muted-foreground">Powers:</span>
                    {Object.entries(AGENT_LABELS).map(([key, label]) => {
                      const on = s.targetAgents.split(",").map((a) => a.trim()).includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleAgent(s, key)}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                            on
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Skill content
                    </summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {s.content}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --- Automations ----------------------------------------------------------------

function AutomationsPanel() {
  const { data, mutate, isLoading } = useSWR<AutomationsSnap>("arsenal-automations", () => listAutomations())
  const [name, setName] = useState("")
  const [json, setJson] = useState("")
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState("")

  async function doImport() {
    if (!json.trim()) return
    setBusy("import")
    setMsg("")
    const r = await importAutomation(name, json)
    setMsg(r.ok ? `Imported "${name || r.inventory.name}" — ${r.inventory.nodeCount} nodes. Now hit Analyze.` : r.error)
    if (r.ok) {
      setName("")
      setJson("")
    }
    setBusy("")
    mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="surface-raised border-0">
        <CardHeader>
          <CardTitle>Import Automation</CardTitle>
          <CardDescription>
            Paste an exported n8n workflow JSON. Jarvis analyzes it (what it does, run-whole vs absorb-parts) and can
            fold its capabilities into your agents as skills. Running whole workflows needs an n8n instance —{" "}
            {data?.n8nConfigured ? (
              <span className="text-primary">connected</span>
            ) : (
              <>set its URL in Settings → Connections + an n8n API key in Settings → API Keys</>
            )}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Name (optional — taken from JSON if empty)" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={doImport} disabled={busy !== "" || !json.trim()}>
              {busy === "import" ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-1.5 size-4" aria-hidden="true" />}
              Import
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wfjson" className="text-xs">
              Workflow JSON
            </Label>
            <Textarea
              id="wfjson"
              rows={5}
              placeholder='{"name": "...", "nodes": [...], "connections": {...}}'
              value={json}
              onChange={(e) => setJson(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
        </CardContent>
      </Card>

      <Card className="surface-raised border-0">
        <CardHeader>
          <CardTitle>Imported Automations</CardTitle>
          <CardDescription>Analyze → absorb capabilities as skills → run whole (when n8n is connected).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !data || data.automations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing imported yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {data.automations.map((a) => (
                <AutomationCard key={a.id} automation={a} n8nConfigured={data.n8nConfigured} onChanged={() => mutate()} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AutomationCard({
  automation,
  n8nConfigured,
  onChanged,
}: {
  automation: AutomationsSnap["automations"][number]
  n8nConfigured: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState("")
  const analysis = automation.analysis as {
    summary?: string
    runWholeVerdict?: string
    runWholeRationale?: string
    risks?: string
    absorbable?: { capability: string; detail: string; targetAgent: string; asSkill: string }[]
    inventory?: { nodeCount: number; nodeTypes: string[]; credentialsNeeded: string[] }
  }

  async function doAnalyze() {
    setBusy("analyze")
    setMsg("")
    const r = await analyzeAutomation(automation.id)
    if (!r.ok) setMsg(r.error)
    setBusy("")
    onChanged()
  }

  async function doRun() {
    setBusy("run")
    setMsg("")
    const r = await runAutomationAction(automation.id)
    setMsg(r.ok ? `Running — execution ${r.executionId ?? "started"}` : r.error)
    setBusy("")
    onChanged()
  }

  async function doAbsorb(i: number) {
    setBusy(`absorb-${i}`)
    const r = await absorbCapability(automation.id, i)
    setMsg(r.ok ? `Absorbed "${r.name}" into the Skill Library.` : r.error)
    setBusy("")
    onChanged()
  }

  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{automation.name}</p>
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
              {automation.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{automation.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={doAnalyze} disabled={busy !== ""}>
            {busy === "analyze" ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" /> : <BrainCircuit className="mr-1 size-3.5" aria-hidden="true" />}
            Analyze
          </Button>
          <Button size="sm" onClick={doRun} disabled={busy !== "" || !n8nConfigured} title={n8nConfigured ? "Run on n8n" : "Connect n8n first"}>
            {busy === "run" ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" /> : <Play className="mr-1 size-3.5" aria-hidden="true" />}
            Run
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${automation.name}`}
            onClick={async () => {
              await deleteAutomationAction(automation.id)
              onChanged()
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {analysis.summary ? (
        <div className="mt-2.5 flex flex-col gap-2 rounded-md bg-secondary p-3">
          <p className="text-xs leading-relaxed">{analysis.summary}</p>
          {analysis.runWholeVerdict ? (
            <p className="text-xs text-muted-foreground">
              <span className="text-micro text-primary">verdict:</span> {analysis.runWholeVerdict} —{" "}
              {analysis.runWholeRationale}
            </p>
          ) : null}
          {analysis.risks ? (
            <p className="text-xs text-muted-foreground">
              <span className="text-micro text-destructive">risks:</span> {analysis.risks}
            </p>
          ) : null}
          {analysis.absorbable && analysis.absorbable.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-micro text-muted-foreground">Absorbable capabilities</span>
              {analysis.absorbable.map((cap, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{cap.capability}</p>
                    <p className="text-[11px] text-muted-foreground">{cap.detail}</p>
                  </div>
                  {cap.asSkill ? (
                    <Button variant="secondary" size="sm" onClick={() => doAbsorb(i)} disabled={busy !== ""}>
                      {busy === `absorb-${i}` ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="mr-1 size-3.5" aria-hidden="true" />
                      )}
                      Absorb as skill
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      not skill-worthy
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {msg ? <p className="mt-2 text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  )
}
