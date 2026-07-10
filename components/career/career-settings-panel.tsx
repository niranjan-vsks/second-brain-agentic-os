"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { CareerSettings, Resume } from "@/lib/types"
import { saveCareerSettings } from "@/app/actions/career"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function CareerSettingsPanel({
  settings,
  masterResumes,
}: {
  settings: CareerSettings | null
  masterResumes: Resume[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    enabledRoleFamilies: settings?.enabledRoleFamilies ?? "fde, ai_pm, genai_arch, solutions",
    enabledGeographies: settings?.enabledGeographies ?? "india, remote_international",
    remotePreferences: settings?.remotePreferences ?? "remote-first, hybrid Bangalore ok",
    compFloorDomesticINR: settings?.compFloorDomesticINR ?? 3000000,
    compStretchDomesticINR: settings?.compStretchDomesticINR ?? 7500000,
    compFloorIntlMonthly: settings?.compFloorIntlMonthly ?? 5000,
    compStretchIntlMonthly: settings?.compStretchIntlMonthly ?? 10000,
    compIntlCurrency: settings?.compIntlCurrency ?? "USD",
    companyAllowlist: settings?.companyAllowlist ?? "",
    companyDenylist: settings?.companyDenylist ?? "",
    portfolioUrl: settings?.portfolioUrl ?? "",
    portfolioLive: settings?.portfolioLive ?? false,
    autoTailorOnMatch: settings?.autoTailorOnMatch ?? false,
    autoShortlistThreshold: settings?.autoShortlistThreshold ?? "3.5",
    batchSizeLimit: settings?.batchSizeLimit ?? 5,
    redFlagTerms: settings?.redFlagTerms ?? "",
    toneVoiceNotes: settings?.toneVoiceNotes ?? "",
  })

  async function save() {
    setBusy(true)
    setSaved(false)
    try {
      await saveCareerSettings(form)
      setSaved(true)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  function num(v: string, fallback: number) {
    const n = Number.parseInt(v, 10)
    return Number.isNaN(n) ? fallback : n
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Targeting</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Role families (comma-separated: fde, ai_pm, genai_arch, solutions)</Label>
            <Input value={form.enabledRoleFamilies} onChange={(e) => setForm({ ...form, enabledRoleFamilies: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Geographies</Label>
            <Input value={form.enabledGeographies} onChange={(e) => setForm({ ...form, enabledGeographies: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Remote preferences</Label>
            <Input value={form.remotePreferences} onChange={(e) => setForm({ ...form, remotePreferences: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Company allowlist (always evaluate)</Label>
              <Textarea rows={2} value={form.companyAllowlist} onChange={(e) => setForm({ ...form, companyAllowlist: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Company denylist (never surface)</Label>
              <Textarea rows={2} value={form.companyDenylist} onChange={(e) => setForm({ ...form, companyDenylist: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Compensation Anchors</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Domestic floor (INR/yr)</Label>
            <Input
              type="number"
              value={form.compFloorDomesticINR}
              onChange={(e) => setForm({ ...form, compFloorDomesticINR: num(e.target.value, 3000000) })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Domestic stretch (INR/yr)</Label>
            <Input
              type="number"
              value={form.compStretchDomesticINR}
              onChange={(e) => setForm({ ...form, compStretchDomesticINR: num(e.target.value, 7500000) })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">International floor (per month)</Label>
            <Input
              type="number"
              value={form.compFloorIntlMonthly}
              onChange={(e) => setForm({ ...form, compFloorIntlMonthly: num(e.target.value, 5000) })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">International stretch (per month)</Label>
            <Input
              type="number"
              value={form.compStretchIntlMonthly}
              onChange={(e) => setForm({ ...form, compStretchIntlMonthly: num(e.target.value, 10000) })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">International currency</Label>
            <Input value={form.compIntlCurrency} onChange={(e) => setForm({ ...form, compIntlCurrency: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Automation & Safety</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Auto-tailor when evaluation score clears threshold</Label>
            <Switch checked={form.autoTailorOnMatch} onCheckedChange={(v) => setForm({ ...form, autoTailorOnMatch: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Auto-shortlist threshold (1.0–5.0)</Label>
              <Input
                value={form.autoShortlistThreshold}
                onChange={(e) => setForm({ ...form, autoShortlistThreshold: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Batch size limit</Label>
              <Input
                type="number"
                value={form.batchSizeLimit}
                onChange={(e) => setForm({ ...form, batchSizeLimit: num(e.target.value, 5) })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Red-flag terms (comma-separated — jobs matching these can never auto-advance)</Label>
            <Textarea rows={2} value={form.redFlagTerms} onChange={(e) => setForm({ ...form, redFlagTerms: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Tone / voice notes for outreach and cover letters</Label>
            <Textarea rows={2} value={form.toneVoiceNotes} onChange={(e) => setForm({ ...form, toneVoiceNotes: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground text-pretty">
            Note: applications are never auto-submitted regardless of these settings — final submission is always
            manual (hard rule from the apply mode).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Portfolio URL (omitted from all documents until marked live)</Label>
            <Input placeholder="https://..." value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Portfolio is live (include in resumes/outreach)</Label>
            <Switch checked={form.portfolioLive} onCheckedChange={(v) => setForm({ ...form, portfolioLive: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        <span className="text-xs text-muted-foreground">
          Master resumes: {masterResumes.length > 0 ? masterResumes.map((r) => r.label).join(", ") : "none uploaded yet"}
        </span>
      </div>
    </div>
  )
}
