"use client"

import { useState, useTransition } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAdCreatives, generateAdCreative, markCreativeDelivered } from "@/app/actions/ads"
import { Plus, Loader2, Clapperboard } from "lucide-react"
import type { Deal } from "@/lib/types"

const CREATIVE_TYPES = [
  { value: "ad_video", label: "Ad Video" },
  { value: "ugc_style", label: "UGC Style" },
  { value: "testimonial_style", label: "Testimonial Style" },
] as const

export function AdCreativeStudio({ deals }: { deals: Deal[] }) {
  const { data: creatives, mutate } = useSWR("ad-creatives", () => getAdCreatives())
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ premise: "", creativeType: "ad_video", dealId: "none" })

  function submit() {
    if (!form.premise.trim()) return
    startTransition(async () => {
      await generateAdCreative({
        brief: form.premise,
        creativeType: form.creativeType as "ad_video" | "ugc_style" | "testimonial_style",
        dealId: form.dealId === "none" ? null : form.dealId,
      })
      setForm({ premise: "", creativeType: "ad_video", dealId: "none" })
      setOpen(false)
      mutate()
    })
  }

  function deliver(id: string) {
    startTransition(async () => {
      await markCreativeDelivered(id)
      mutate()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          Client ad creatives — same generation engine as the YouTube pipeline, attached to deals.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" aria-hidden="true" />
            New Creative
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Ad Creative</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ac-premise">Premise / brief</Label>
                <Textarea
                  id="ac-premise"
                  value={form.premise}
                  onChange={(e) => setForm({ ...form, premise: e.target.value })}
                  rows={4}
                  placeholder="30s ad for a dental clinic's AI receptionist: missed calls cost them patients, agent answers 24/7"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Type</Label>
                  <Select
                    value={form.creativeType}
                    onValueChange={(v) => setForm({ ...form, creativeType: v ?? "ad_video" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATIVE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Attach to deal (optional)</Label>
                  <Select value={form.dealId} onValueChange={(v) => setForm({ ...form, dealId: v ?? "none" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No deal</SelectItem>
                      {deals.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.client} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={submit} disabled={isPending || !form.premise.trim()}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : "Generate Script & Video"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!creatives || creatives.length === 0) && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center font-mono text-xs text-muted-foreground">
              No ad creatives yet. Generate one for a client deal or as a portfolio piece.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {creatives?.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clapperboard className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm">{CREATIVE_TYPES.find((t) => t.value === c.creativeType)?.label}</CardTitle>
              </div>
              <Badge
                variant={c.status === "delivered" ? "default" : "outline"}
                className="font-mono text-[10px]"
              >
                {c.status}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="line-clamp-2 text-xs text-muted-foreground">{c.premise}</p>
              {c.outputBlobUrl ? (
                <video src={c.outputBlobUrl} controls className="max-h-56 w-full rounded-md border border-border bg-black" />
              ) : c.script ? (
                <details>
                  <summary className="cursor-pointer font-mono text-xs text-muted-foreground">
                    Script ready — video generating
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed">{c.script}</pre>
                </details>
              ) : (
                <span className="font-mono text-xs text-muted-foreground">Generating script…</span>
              )}
              {c.status === "generated" && (
                <Button size="sm" variant="outline" onClick={() => deliver(c.id)} disabled={isPending} className="self-start">
                  Mark Delivered
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
