"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addChannel, savePipelineSettings } from "@/app/actions/youtube"
import { useRouter } from "next/navigation"
import { SquarePlay, Loader2, ExternalLink } from "lucide-react"
import type { YoutubeChannel, PipelineSettings } from "@/lib/types"

interface ChannelSettingsProps {
  channels: YoutubeChannel[]
  settings: PipelineSettings | null
}

export function ChannelSettings({ channels, settings }: ChannelSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [stubName, setStubName] = useState("")
  const [form, setForm] = useState({
    contentDomain: settings?.contentDomain ?? "",
    toneVoiceNotes: settings?.toneVoiceNotes ?? "",
    redFlagTerms: settings?.redFlagTerms ?? "",
    defaultBypassApproval: settings?.defaultBypassApproval ?? false,
    videoFormatDefault: settings?.videoFormatDefault ?? "shorts",
  })

  function addStub() {
    if (!stubName.trim()) return
    startTransition(async () => {
      await addChannel(stubName.trim())
      setStubName("")
      router.refresh()
    })
  }

  function saveSettings() {
    startTransition(async () => {
      await savePipelineSettings(form)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">YouTube Channels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {channels.length === 0 && (
            <p className="font-mono text-xs text-muted-foreground">No channels yet.</p>
          )}
          {channels.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <SquarePlay className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">{c.channelName}</span>
                <Badge
                  variant={c.status === "connected" ? "default" : "outline"}
                  className="font-mono text-[10px]"
                >
                  {c.status === "connected" ? "connected" : c.status === "needs_reauth" ? "needs OAuth" : "disabled"}
                </Badge>
              </div>
              {c.status !== "connected" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 font-mono text-[10px]"
                  onClick={() => {
                    window.location.href = `/api/auth/youtube/start?channelId=${c.id}`
                  }}
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                  Connect via Google OAuth
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={stubName}
              onChange={(e) => setStubName(e.target.value)}
              placeholder="Channel name (e.g. AI Shorts Channel)"
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={addStub} disabled={isPending || !stubName.trim()}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Add Channel"}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add the channel first, then connect it via Google OAuth. Until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are
            set, channels stay in stub mode — the pipeline works end to end (script, prompt, generate, review) and only
            the final YouTube upload is skipped.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ps-domain">Content domain</Label>
            <Input
              id="ps-domain"
              value={form.contentDomain}
              onChange={(e) => setForm({ ...form, contentDomain: e.target.value })}
              placeholder="e.g. AI engineering, agentic systems, dev productivity"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ps-tone">Tone & voice notes (fed to Script Composer)</Label>
            <Textarea
              id="ps-tone"
              value={form.toneVoiceNotes}
              onChange={(e) => setForm({ ...form, toneVoiceNotes: e.target.value })}
              rows={3}
              placeholder="Direct, practitioner voice. No hype. Concrete examples over abstractions."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ps-redflags">Red-flag terms (comma separated, sanity floor blocks auto-publish)</Label>
            <Input
              id="ps-redflags"
              value={form.redFlagTerms}
              onChange={(e) => setForm({ ...form, redFlagTerms: e.target.value })}
              placeholder="guaranteed, get rich, secret method"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Default format</Label>
              <Select
                value={form.videoFormatDefault}
                onValueChange={(v) => setForm({ ...form, videoFormatDefault: v ?? "shorts" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shorts">Shorts</SelectItem>
                  <SelectItem value="long_form">Long Form</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox
                id="ps-bypass"
                checked={form.defaultBypassApproval}
                onCheckedChange={(v) => setForm({ ...form, defaultBypassApproval: v === true })}
              />
              <Label htmlFor="ps-bypass" className="text-xs text-muted-foreground">
                Bypass approval by default
              </Label>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={isPending} className="self-start">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
