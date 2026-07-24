"use client"

// Settings Hub — central configuration for the whole OS.
// Sections: General · Model Routing · Connections · API Keys · Agents · Funnels.
// Loads a single snapshot via SWR; each section saves through server actions.

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getSettingsSnapshot, saveConfigAction, saveApiKeyAction, deleteApiKeyAction, validateApiKeyAction, verifyStoredKeyAction, saveBrainAction, applyRecommendedRoutingAction, saveRoutingAction } from "@/app/actions/settings"
import type { KeyValidation } from "@/lib/key-validation"
import {
  Settings2,
  Cpu,
  Cable,
  KeyRound,
  Bot,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react"

type Snapshot = Awaited<ReturnType<typeof getSettingsSnapshot>>

const SECTIONS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "routing", label: "Model Routing", icon: Cpu },
  { id: "connections", label: "Connections", icon: Cable },
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "funnels", label: "Funnels", icon: Filter },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

function StatusDot({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return ok ? (
    <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {okLabel}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <XCircle className="size-3" aria-hidden="true" />
      {badLabel}
    </Badge>
  )
}

export function SettingsTab() {
  const { data, isLoading, mutate } = useSWR<Snapshot>("settings-snapshot", () => getSettingsSnapshot())
  const [section, setSection] = useState<SectionId>("general")

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        Loading configuration...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {/* Section rail */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col" aria-label="Settings sections">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                section === s.id
                  ? "surface-raised text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className={`size-4 ${section === s.id ? "text-primary" : ""}`} aria-hidden="true" />
              {s.label}
            </button>
          )
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {section === "general" && <GeneralSection data={data} onSaved={() => mutate()} />}
        {section === "routing" && <RoutingSection data={data} />}
        {section === "connections" && (
          <ConnectionsSection data={data} onSaved={() => mutate()} goToKeys={() => setSection("keys")} />
        )}
        {section === "keys" && <KeysSection data={data} onSaved={() => mutate()} />}
        {section === "agents" && <AgentsSection data={data} onSaved={() => mutate()} />}
        {section === "funnels" && <FunnelsSection data={data} onSaved={() => mutate()} />}
      </div>
    </div>
  )
}

// --- General --------------------------------------------------------------------

function GeneralSection({ data, onSaved }: { data: Snapshot; onSaved: () => void }) {
  const [form, setForm] = useState(data.general)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await saveConfigAction("general", form as unknown as Record<string, unknown>)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  return (
    <Card className="surface-raised border-0">
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Identity, timezone, and notification behavior across the OS.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={form.displayName}
              placeholder="Operator"
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">In-app notifications</p>
            <p className="text-xs text-muted-foreground">Bell alerts for drafts, reminders, and agent runs</p>
          </div>
          <Switch checked={form.notifyInApp} onCheckedChange={(v) => setForm({ ...form, notifyInApp: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Telegram mirror</p>
            <p className="text-xs text-muted-foreground">
              Mirror notifications to Telegram (requires bot token in Connections)
            </p>
          </div>
          <Switch checked={form.telegramMirror} onCheckedChange={(v) => setForm({ ...form, telegramMirror: v })} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
            {saved ? "Saved" : "Save general settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Model Routing ----------------------------------------------------------------

const ENGINE_PROVIDERS = [
  { id: "gateway", label: "AI Gateway" },
  { id: "moonshot", label: "Kimi" },
  { id: "google", label: "Gemini" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "custom", label: "Custom" },
] as const

type BrainCfg = Snapshot["brainConfig"]
type Strategy = BrainCfg["strategies"][number]

function RoutingStrategiesCard({ data }: { data: Snapshot }) {
  const [strategies, setStrategies] = useState<Strategy[]>(data.brainConfig.strategies ?? [])
  const [defaultStrategy, setDefaultStrategy] = useState(data.brainConfig.defaultStrategy ?? "")
  const [groupStrategies, setGroupStrategies] = useState<Record<string, string>>(data.brainConfig.groupStrategies ?? {})
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState("")

  const newStrategy = (): Strategy => ({
    id: Math.random().toString(36).slice(2, 10),
    name: "New strategy",
    tiers: {
      light: { provider: "gateway", model: "" },
      standard: { provider: "gateway", model: "" },
      heavy: { provider: "gateway", model: "" },
    },
  })
  const patch = (id: string, fn: (s: Strategy) => Strategy) => setStrategies((prev) => prev.map((s) => (s.id === id ? fn(s) : s)))

  async function save() {
    setBusy("save")
    await saveRoutingAction({ strategies, defaultStrategy, groupStrategies })
    setBusy("")
    setMsg("Routing saved.")
    setTimeout(() => setMsg(""), 2500)
  }
  async function applyPlan() {
    setBusy("plan")
    const r = await applyRecommendedRoutingAction()
    setBusy("")
    setMsg(`Seeded ${r.count} strategies · default = ${r.defaultId}. Reload to edit.`)
  }

  return (
    <Card className="surface-raised border-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Routing Strategies</CardTitle>
            <CardDescription>
              Define reusable strategies (basic / standard / complex → engines), pick a global default, and assign a
              different strategy per functional area.
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={applyPlan} disabled={busy !== ""}>
            {busy === "plan" ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
            Seed Gemini&apos;s plan
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Strategy editors */}
        <div className="flex flex-col gap-3">
          {strategies.length === 0 && (
            <p className="text-xs text-muted-foreground">No strategies yet — add one, or seed Gemini&apos;s plan.</p>
          )}
          {strategies.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={s.name}
                  onChange={(e) => patch(s.id, (x) => ({ ...x, name: e.target.value }))}
                  className="h-8 max-w-[220px] font-medium"
                  aria-label="Strategy name"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete strategy"
                  onClick={() => {
                    setStrategies((prev) => prev.filter((x) => x.id !== s.id))
                    if (defaultStrategy === s.id) setDefaultStrategy("")
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["light", "standard", "heavy"] as const).map((tier) => (
                  <div key={tier} className="flex flex-col gap-1 rounded-md border border-border/70 p-2">
                    <span className="text-micro text-muted-foreground">
                      {tier === "light" ? "basic" : tier === "heavy" ? "complex" : "standard"}
                    </span>
                    <Select
                      value={s.tiers[tier].provider}
                      onValueChange={(v) => patch(s.id, (x) => ({ ...x, tiers: { ...x.tiers, [tier]: { ...x.tiers[tier], provider: (v as Strategy["tiers"]["light"]["provider"]) ?? "gateway" } } }))}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ENGINE_PROVIDERS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={s.tiers[tier].model}
                      onChange={(e) => patch(s.id, (x) => ({ ...x, tiers: { ...x.tiers, [tier]: { ...x.tiers[tier], model: e.target.value } } }))}
                      placeholder="model id (blank = default)"
                      className="h-7 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setStrategies((prev) => [...prev, newStrategy()])}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" /> Add strategy
          </Button>
        </div>

        {/* Global default */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <Label className="text-xs">Global default strategy</Label>
          <Select value={defaultStrategy || "__none"} onValueChange={(v) => setDefaultStrategy(v === "__none" ? "" : (v ?? ""))}>
            <SelectTrigger><SelectValue placeholder="Use the global brain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Use the global brain (above)</SelectItem>
              {strategies.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">Applied to every agent unless a functional area overrides it below.</p>
        </div>

        {/* Per-area assignment */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Per-area overrides</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.routingGroups.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
                <span className="text-xs">{g.label}</span>
                <Select
                  value={groupStrategies[g.id] || "__default"}
                  onValueChange={(v) => setGroupStrategies((prev) => {
                    const next = { ...prev }
                    if (v === "__default") delete next[g.id]
                    else next[g.id] = v ?? ""
                    return next
                  })}
                >
                  <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Use default</SelectItem>
                    {strategies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
          <Button onClick={save} disabled={busy !== ""}>
            {busy === "save" ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
            Save routing
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ModelBrainCard({ data }: { data: Snapshot }) {
  const [cfg, setCfg] = useState(data.brainConfig)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const providers = [
    { id: "gateway", label: "Vercel AI Gateway (default)" },
    { id: "moonshot", label: "Kimi (Moonshot)" },
    { id: "google", label: "Gemini (Google AI Studio direct)" },
    { id: "openrouter", label: "OpenRouter (GLM, DeepSeek, …)" },
    { id: "custom", label: "Custom OpenAI-compatible" },
  ] as const
  const keyHint: Record<string, string> = {
    gateway: "Uses AI_GATEWAY_API_KEY (server env).",
    moonshot: "Add a Kimi (Moonshot) key under API Keys. Kimi K3 for deep reasoning.",
    google: "Add a Google AI Studio key under API Keys. Gemini 2.5 Flash — fast + cheap.",
    openrouter: "Add an OpenRouter key under API Keys.",
    custom: "Set the base URL below + an OpenRouter/LLM key under API Keys.",
  }

  async function save() {
    setBusy(true)
    await saveBrainAction(cfg)
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card className="surface-raised border-0 ring-1 ring-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Model Brain</CardTitle>
            <CardDescription>
              Which provider + models power every agent. Now:{" "}
              <span className="font-mono text-foreground">{data.brain.provider}</span> — {data.brain.keySource}
            </CardDescription>
          </div>
          <StatusDot ok={data.brain.configured} okLabel="Ready" badLabel="Not ready" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Provider</Label>
          <Select value={cfg.provider} onValueChange={(v) => setCfg({ ...cfg, provider: (v as typeof cfg.provider) ?? "gateway" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{keyHint[cfg.provider]}</p>
        </div>
        {cfg.provider === "custom" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Base URL</Label>
            <Input placeholder="https://api.example.com/v1" value={cfg.baseUrl} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} />
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {(["light", "standard", "heavy"] as const).map((tier) => (
            <div key={tier} className="flex flex-col gap-1.5">
              <Label className="text-xs capitalize">{tier} model</Label>
              <Input
                placeholder={cfg.provider === "moonshot" ? "kimi-k2-0711-preview" : "provider default"}
                value={cfg.models[tier]}
                onChange={(e) => setCfg({ ...cfg, models: { ...cfg.models, [tier]: e.target.value } })}
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Leave a model blank to use the provider default. Same model on all three tiers is fine.</p>
        <p className="text-[11px] text-muted-foreground">
          This is the global fallback engine. For different models per complexity tier and per functional area, use{" "}
          <span className="text-foreground">Routing Strategies</span> below.
        </p>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
            {saved ? "Saved" : "Set as brain"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RoutingSection({ data }: { data: Snapshot }) {
  const r = data.routing
  const tierMeta: Record<string, { desc: string; envVar: string }> = {
    light: { desc: "Formatting, extraction, filtering — high volume, low stakes", envVar: "LLM_MODEL_LIGHT" },
    standard: { desc: "Drafting, scoring, structured judgment — the workhorse", envVar: "LLM_MODEL_STANDARD" },
    heavy: { desc: "Deep research, evaluation, synthesis — low volume, high stakes", envVar: "LLM_MODEL_HEAVY" },
  }
  return (
    <div className="flex flex-col gap-4">
      <ModelBrainCard data={data} />
      <RoutingStrategiesCard data={data} />
      <Card className="surface-raised border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Model Routing</CardTitle>
              <CardDescription>
                Active provider: <span className="font-mono text-foreground">{r.provider}</span> ·{" "}
                {r.taskCount} routed tasks
              </CardDescription>
            </div>
            <StatusDot ok={r.configured} okLabel="Configured" badLabel="Needs setup" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(["light", "standard", "heavy"] as const).map((tier) => (
            <div key={tier} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-micro text-primary">{tier}</span>
                  <span className="font-mono text-sm">{r.models[tier]}</span>
                </div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {r.tiers[tier].length} tasks
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{tierMeta[tier].desc}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                Override: env <span className="text-foreground">{tierMeta[tier].envVar}</span>
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Routed tasks
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.tiers[tier].map((t) => (
                    <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </details>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-muted-foreground">
            To bring your own provider (GLM, Kimi, etc.): add an OpenRouter key under API Keys, then set{" "}
            <span className="font-mono">LLM_PROVIDER=openrouter</span> and the per-tier model env vars. Model IDs are
            never hardcoded — one env change moves the whole OS.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Connections --------------------------------------------------------------------

function ConnectionsSection({
  data,
  onSaved,
  goToKeys,
}: {
  data: Snapshot
  onSaved: () => void
  goToKeys: () => void
}) {
  const c = data.connections
  const [form, setForm] = useState(data.connectionsForm)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await saveConfigAction("connections", form as unknown as Record<string, unknown>)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="surface-raised border-0">
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>External services wired into the OS — connect or configure each one below.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Google Calendar — real OAuth, connect flow lives on the Jarvis tab */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Jarvis scheduling tools. Needs a Google Cloud OAuth app (GOOGLE_CLIENT_ID/SECRET env) — click Connect
                on the Jarvis tab once that's set up.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusDot
                ok={c.googleCalendar === "connected"}
                okLabel="Connected"
                badLabel={c.googleCalendar === "not_connected" ? "Not connected" : c.googleCalendar}
              />
            </div>
          </div>

          {/* Telegram Bot — token via API Key Vault, allowed user id editable here */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Telegram Bot</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Notification mirror + chat channel. Bot token lives in{" "}
                  <button type="button" onClick={goToKeys} className="underline underline-offset-2 hover:text-foreground">
                    API Keys
                  </button>
                  ; set the allowed Telegram user id below (from @userinfobot).
                </p>
              </div>
              <StatusDot ok={c.telegram} okLabel="Token set" badLabel="No token" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="telegramUserId" className="text-xs">
                  Allowed Telegram user id
                </Label>
                <Input
                  id="telegramUserId"
                  placeholder="123456789"
                  value={form.telegramAllowedUserId}
                  onChange={(e) => setForm({ ...form, telegramAllowedUserId: e.target.value })}
                />
              </div>
              <Button variant="secondary" onClick={goToKeys}>
                Add bot token
              </Button>
            </div>
          </div>

          {/* Search Provider — auto-detected from stored keys, link to Keys */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Search Provider</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Career deep-research + lead-gen discovery.{" "}
                {c.searchProvider ? (
                  <>
                    Active: <span className="font-mono text-foreground">{c.searchProvider}</span>
                  </>
                ) : (
                  <>
                    Add a{" "}
                    <button type="button" onClick={goToKeys} className="underline underline-offset-2 hover:text-foreground">
                      Tavily, Brave, or Serper key
                    </button>{" "}
                    — it activates automatically, no env var needed.
                  </>
                )}
              </p>
            </div>
            <StatusDot ok={Boolean(c.searchProvider)} okLabel="Active" badLabel="Not set" />
          </div>

          {/* Browser Worker — URL editable here, secret via API Key Vault */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Browser Worker</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Portal automation for job applications (PDF render, posting snapshots). Set your worker's URL below;
                  its bearer secret lives in{" "}
                  <button type="button" onClick={goToKeys} className="underline underline-offset-2 hover:text-foreground">
                    API Keys
                  </button>
                  .
                </p>
              </div>
              <StatusDot ok={c.browserWorker} okLabel="Configured" badLabel="Not deployed" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="browserWorkerUrl" className="text-xs">
                Worker URL
              </Label>
              <Input
                id="browserWorkerUrl"
                placeholder="https://your-worker.example.com"
                value={form.browserWorkerUrl}
                onChange={(e) => setForm({ ...form, browserWorkerUrl: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Cron Secret</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Protects the scheduled agents (scanner, lead-gen). Server-side only — set CRON_SECRET in Vercel env vars.
              </p>
            </div>
            <StatusDot ok={c.cronSecret} okLabel="Set" badLabel="Not set" />
          </div>

          {/* LinkedIn publish — token via API Key Vault, person URN editable here */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">LinkedIn Publishing</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Real auto-publish for approved posts (official API, w_member_social). Access token lives in{" "}
                  <button type="button" onClick={goToKeys} className="underline underline-offset-2 hover:text-foreground">
                    API Keys
                  </button>
                  ; set your member URN below.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkedinPersonUrn" className="text-xs">
                LinkedIn person URN
              </Label>
              <Input
                id="linkedinPersonUrn"
                placeholder="urn:li:person:AbC123"
                value={form.linkedinPersonUrn}
                onChange={(e) => setForm({ ...form, linkedinPersonUrn: e.target.value })}
              />
            </div>
          </div>

          {/* n8n — instance URL editable here, API key via vault */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">n8n (Automations)</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Runs workflows imported on the Arsenal page. API key goes in{" "}
                  <button type="button" onClick={goToKeys} className="underline underline-offset-2 hover:text-foreground">
                    API Keys
                  </button>{" "}
                  (create it in n8n: Settings → n8n API).
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="n8nBaseUrl" className="text-xs">
                n8n instance URL
              </Label>
              <Input
                id="n8nBaseUrl"
                placeholder="https://your-n8n.example.com"
                value={form.n8nBaseUrl}
                onChange={(e) => setForm({ ...form, n8nBaseUrl: e.target.value })}
              />
            </div>
          </div>

          {/* crawl4ai — base URL editable here, optional key via API Key Vault */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">crawl4ai (page extraction)</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Self-hosted crawler for JD/page extraction (handles JS-heavy pages better than plain fetch). Optional
                  bearer key goes in API Keys.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crawl4aiBaseUrl" className="text-xs">
                crawl4ai base URL
              </Label>
              <Input
                id="crawl4aiBaseUrl"
                placeholder="https://your-crawl4ai.example.com"
                value={form.crawl4aiBaseUrl}
                onChange={(e) => setForm({ ...form, crawl4aiBaseUrl: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Encryption</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                AES key for tokens + stored API keys. Server-side only — set CREDENTIALS_ENCRYPTION_KEY in Vercel env
                vars (needed before any key above can be saved). This is the bootstrap secret protecting the vault
                itself, so it can never be UI-configurable.
              </p>
            </div>
            <StatusDot ok={c.encryptionReady} okLabel="Ready" badLabel="CREDENTIALS_ENCRYPTION_KEY missing" />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
              {saved ? "Saved" : "Save connection settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-raised border-0">
        <CardHeader>
          <CardTitle>YouTube Channels</CardTitle>
          <CardDescription>Channel OAuth is managed in the YouTube tab; status mirrored here.</CardDescription>
        </CardHeader>
        <CardContent>
          {c.youtubeChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels connected yet — add one in the YouTube tab.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {c.youtubeChannels.map((ch) => (
                <div key={ch.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm">{ch.name}</span>
                  <StatusDot ok={ch.status === "connected"} okLabel="Connected" badLabel={ch.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --- API Keys --------------------------------------------------------------------

function ValidationRow({ v }: { v: KeyValidation }) {
  const map = {
    valid: { icon: CheckCircle2, cls: "text-status-success", ring: "border-status-success/30 bg-status-success/10" },
    invalid: { icon: XCircle, cls: "text-destructive", ring: "border-destructive/30 bg-destructive/10" },
    error: { icon: AlertTriangle, cls: "text-status-pending", ring: "border-status-pending/30 bg-status-pending/10" },
    unverified: { icon: HelpCircle, cls: "text-muted-foreground", ring: "border-border bg-secondary" },
  }[v.status]
  const Icon = map.icon
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${map.ring}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${map.cls}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className={map.cls}>{v.message}</p>
        {v.detail ? <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">{v.detail}</p> : null}
      </div>
    </div>
  )
}

function KeysSection({ data, onSaved }: { data: Snapshot; onSaved: () => void }) {
  const [provider, setProvider] = useState("")
  const [keyValue, setKeyValue] = useState("")
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<KeyValidation | null>(null)
  // Per-stored-key re-verify results, keyed by provider id.
  const [verifyBusy, setVerifyBusy] = useState<string | null>(null)
  const [verifyResults, setVerifyResults] = useState<Record<string, KeyValidation>>({})

  const stored = new Map(data.keys.map((k) => [k.provider, k]))

  async function test() {
    if (!provider || !keyValue) return
    setTesting(true)
    setError("")
    setResult(null)
    try {
      setResult(await validateApiKeyAction(provider, keyValue))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed")
    }
    setTesting(false)
  }

  async function save() {
    if (!provider || !keyValue) return
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const r = await saveApiKeyAction(provider, keyValue, label)
      if (r.ok) {
        setKeyValue("")
        setLabel("")
        setProvider("")
        onSaved()
      } else {
        setError(r.error ?? "Failed to save key")
        if (r.validation) setResult(r.validation)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key")
    }
    setBusy(false)
  }

  async function verify(p: string) {
    setVerifyBusy(p)
    try {
      const v = await verifyStoredKeyAction(p)
      setVerifyResults((r) => ({ ...r, [p]: v }))
    } catch (e) {
      setVerifyResults((r) => ({ ...r, [p]: { status: "error", message: e instanceof Error ? e.message : "Verify failed" } }))
    }
    setVerifyBusy(null)
  }

  async function remove(p: string) {
    setBusy(true)
    await deleteApiKeyAction(p)
    setVerifyResults((r) => {
      const next = { ...r }
      delete next[p]
      return next
    })
    setBusy(false)
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="surface-raised border-0">
        <CardHeader>
          <CardTitle>API Key Vault</CardTitle>
          <CardDescription>
            Bring your own keys — AES-encrypted at rest, never shown again after saving. Resolution order everywhere:
            your stored key first, env var fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v ?? "")
                setKeyValue("") // clear the typed key when switching providers (avoid saving to the wrong one)
                setError("")
              }}
            >
              <SelectTrigger aria-label="Provider">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {data.providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="password"
              placeholder="Paste API key"
              value={keyValue}
              onChange={(e) => {
                setKeyValue(e.target.value)
                setResult(null)
                setError("")
              }}
              aria-label="API key"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={test} disabled={testing || busy || !provider || !keyValue}>
                {testing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Test"}
              </Button>
              <Button onClick={save} disabled={busy || testing || !provider || !keyValue}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Store key"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Store runs a live handshake first — a key the provider rejects is never saved. Use Test to check without storing.
          </p>
          {result ? <ValidationRow v={result} /> : null}
          {error && !result ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-2">
            {data.providers.map((p) => {
              const k = stored.get(p.id)
              const vr = verifyResults[p.id]
              return (
                <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{p.label}</p>
                        <a
                          href={p.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`${p.label} docs`}
                        >
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{p.purpose}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        env fallback: {p.envVar} {p.envConfigured ? "(set)" : "(unset)"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {k ? (
                        <>
                          <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 font-mono text-primary">
                            ····{k.lastFour}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verify(p.id)}
                            disabled={verifyBusy === p.id}
                            aria-label={`Test ${p.label} connection`}
                          >
                            {verifyBusy === p.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Test"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(p.id)}
                            disabled={busy}
                            aria-label={`Delete ${p.label} key`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <StatusDot ok={p.envConfigured} okLabel="Via env" badLabel="No key" />
                      )}
                    </div>
                  </div>
                  {vr ? <ValidationRow v={vr} /> : null}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="surface-raised border-0">
        <CardHeader>
          <CardTitle>Secret Access Log</CardTitle>
          <CardDescription>
            Recent reads/writes/deletes of vaulted keys — values are never logged, only which secret was touched, by
            what, and when.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentSecretAccess.length === 0 ? (
            <p className="text-sm text-muted-foreground">No access recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {data.recentSecretAccess.map((r, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] uppercase ${
                        r.action === "delete"
                          ? "text-destructive"
                          : r.action === "write"
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {r.action}
                    </Badge>
                    <span className="font-mono text-xs">{r.provider}</span>
                    {r.source ? <span className="text-xs text-muted-foreground">via {r.source}</span> : null}
                  </div>
                  <span className="text-micro text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --- Agents (Lead-Gen) --------------------------------------------------------------

function AgentsSection({ data, onSaved }: { data: Snapshot; onSaved: () => void }) {
  const [form, setForm] = useState(data.leadgen)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await saveConfigAction("leadgen", form as unknown as Record<string, unknown>)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  return (
    <Card className="surface-raised border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lead-Gen Agent</CardTitle>
            <CardDescription>
              Discovers businesses via Google Maps / SERP, AI-qualifies them against your ICP, and feeds the Freelance
              Funnel. Runs daily at 9:30 IST when enabled; run manually anytime from the Freelance tab.
            </CardDescription>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            aria-label="Enable lead-gen agent"
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="icp">ICP notes (fed verbatim to the qualifier)</Label>
          <Textarea
            id="icp"
            rows={4}
            value={form.icpNotes}
            onChange={(e) => setForm({ ...form, icpNotes: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="categories">Business categories (comma-separated)</Label>
            <Textarea
              id="categories"
              rows={2}
              value={form.categories}
              onChange={(e) => setForm({ ...form, categories: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="locations">Target locations (comma-separated)</Label>
            <Textarea
              id="locations"
              rows={2}
              value={form.locations}
              onChange={(e) => setForm({ ...form, locations: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Maps: no-website hunt</p>
              <p className="text-xs text-muted-foreground">Businesses with zero web presence</p>
            </div>
            <Switch
              checked={form.sources.maps_no_website}
              onCheckedChange={(v) => setForm({ ...form, sources: { ...form.sources, maps_no_website: v } })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">AI-upgrade prospects</p>
              <p className="text-xs text-muted-foreground">Manual workflows ripe for AI automation</p>
            </div>
            <Switch
              checked={form.sources.ai_upgrade}
              onCheckedChange={(v) => setForm({ ...form, sources: { ...form.sources, ai_upgrade: v } })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="threshold">Qualify threshold (0–100)</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={100}
              value={form.qualifyThreshold}
              onChange={(e) => setForm({ ...form, qualifyThreshold: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxrun">Max prospects per run</Label>
            <Input
              id="maxrun"
              type="number"
              min={1}
              max={20}
              value={form.maxPerRun}
              onChange={(e) => setForm({ ...form, maxPerRun: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Auto-promote</p>
              <p className="text-xs text-muted-foreground">Qualified → funnel automatically</p>
            </div>
            <Switch checked={form.autoPromote} onCheckedChange={(v) => setForm({ ...form, autoPromote: v })} />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Discovery requires a Google Maps Places or Serper key (API Keys section). Without one, runs fail with a clear
          error — the agent never fabricates prospects.
        </p>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
            {saved ? "Saved" : "Save agent config"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Funnels (Meta Ads seam) ----------------------------------------------------------

function FunnelsSection({ data, onSaved }: { data: Snapshot; onSaved: () => void }) {
  const [form, setForm] = useState(data.metaAds)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasToken =
    data.keys.some((k) => k.provider === "meta_ads") ||
    data.providers.find((p) => p.id === "meta_ads")?.envConfigured

  async function save() {
    setSaving(true)
    await saveConfigAction("funnels.meta_ads", form as unknown as Record<string, unknown>)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  return (
    <Card className="surface-raised border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Meta Ads Funnel</CardTitle>
            <CardDescription>
              Configurable seam for pushing Ad Creative Studio output into Meta campaigns. Stub until an access token is
              added — same activation philosophy as the YouTube pipeline.
            </CardDescription>
          </div>
          <StatusDot ok={Boolean(hasToken)} okLabel="Token present" badLabel="Stub mode" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="adAccountId">Ad Account ID</Label>
            <Input
              id="adAccountId"
              placeholder="act_1234567890"
              value={form.adAccountId}
              onChange={(e) => setForm({ ...form, adAccountId: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pageId">Facebook Page ID</Label>
            <Input
              id="pageId"
              placeholder="1234567890"
              value={form.pageId}
              onChange={(e) => setForm({ ...form, pageId: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget">Default daily budget (INR)</Label>
            <Input
              id="budget"
              type="number"
              min={100}
              value={form.dailyBudgetINR}
              onChange={(e) => setForm({ ...form, dailyBudgetINR: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Enable funnel</p>
              <p className="text-xs text-muted-foreground">Activates campaign sync when a token exists</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fnotes">Notes</Label>
          <Textarea
            id="fnotes"
            rows={2}
            placeholder="Campaign strategy, audiences, exclusions..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null}
            {saved ? "Saved" : "Save funnel config"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
