"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import type { ScanHistoryEntry } from "@/lib/types"
import { triggerScan, getScanHistory, getScannerConfigAction, saveScannerConfig } from "@/app/actions/career"
import type { TrackedCompany } from "@/lib/career/scanner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react"

const STATUS_LABEL: Record<string, string> = {
  added: "Added",
  skipped_title: "Skipped (title)",
  skipped_dup: "Skipped (duplicate)",
  skipped_expired: "Skipped (expired)",
}

export function ScannerPanel() {
  const { data: config } = useSWR("career-scan-config", () => getScannerConfigAction())
  const { data: history } = useSWR("career-scan-history", () => getScanHistory(50))
  const [busy, setBusy] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [newCompany, setNewCompany] = useState("")
  const [newProvider, setNewProvider] = useState<TrackedCompany["provider"]>("greenhouse")
  const [newSlug, setNewSlug] = useState("")

  const companies = config?.trackedCompanies ?? []

  async function runScan() {
    setBusy(true)
    setScanResult(null)
    try {
      const result = await triggerScan()
      setScanResult(
        `Scan complete: ${result.added} added, ${result.skippedTitle} title-filtered, ${result.skippedDup} duplicates${result.errors.length > 0 ? `. Errors: ${result.errors.join("; ")}` : ""}`,
      )
      mutate("career-scan-history")
      mutate("career-jobs")
    } catch (e) {
      setScanResult(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setBusy(false)
    }
  }

  async function addCompany() {
    if (!newCompany.trim() || !newSlug.trim() || !config) return
    setBusy(true)
    try {
      const updated: TrackedCompany[] = [
        ...companies,
        { name: newCompany.trim(), provider: newProvider, slug: newSlug.trim() },
      ]
      await saveScannerConfig({ trackedCompanies: updated, titleFilters: config.titleFilters })
      setNewCompany("")
      setNewSlug("")
      mutate("career-scan-config")
    } finally {
      setBusy(false)
    }
  }

  async function removeCompany(index: number) {
    if (!config) return
    const updated = companies.filter((_, i) => i !== index)
    await saveScannerConfig({ trackedCompanies: updated, titleFilters: config.titleFilters })
    mutate("career-scan-config")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground text-pretty max-w-xl">
          Zero-token scanner: polls Greenhouse/Lever public JSON APIs directly — no LLM cost. Runs automatically every 4
          hours (cron) and on demand. New matches land in the Pipeline as Discovered.
        </p>
        <Button size="sm" onClick={runScan} disabled={busy || companies.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Scan Now
        </Button>
      </div>

      {scanResult && <p className="text-sm font-mono text-muted-foreground">{scanResult}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tracked Companies ({companies.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Company name" className="max-w-40" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
            <Select value={newProvider} onValueChange={(v) => setNewProvider(v as TrackedCompany["provider"])}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="greenhouse">Greenhouse</SelectItem>
                <SelectItem value="lever">Lever</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Board slug (e.g. vercel)"
              className="max-w-44"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={addCompany} disabled={busy || !newCompany.trim() || !newSlug.trim()}>
              <Plus className="h-4 w-4" />
              Track
            </Button>
          </div>
          {companies.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No companies tracked yet. Add companies with Greenhouse or Lever boards — the slug is the identifier in
              their careers URL (e.g. boards.greenhouse.io/&lt;slug&gt;).
            </p>
          )}
          <div className="flex flex-col gap-1">
            {companies.map((c, i) => (
              <div key={`${c.provider}-${c.slug}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="secondary">{c.provider}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{c.slug}</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeCompany(i)}>
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Stop tracking {c.name}</span>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Scan Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 max-h-96 overflow-y-auto">
          {(!history || history.length === 0) && <p className="text-sm text-muted-foreground">No scan activity yet.</p>}
          {(history as ScanHistoryEntry[] | undefined)?.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border last:border-0">
              <span className="truncate font-mono text-muted-foreground">{h.url}</span>
              <Badge variant={h.status === "added" ? "default" : "outline"} className="shrink-0">
                {STATUS_LABEL[h.status] ?? h.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
